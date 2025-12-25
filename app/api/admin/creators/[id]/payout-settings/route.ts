import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import { checkPayoutEligibility, getCreatorAvailableBalance } from '@/lib/payout-eligibility';
import { logTransaction } from '@/lib/logger';
import { TransactionEventType, PayoutMode, PayoutFrequency, EntityType } from '@prisma/client';

/**
 * GET /api/admin/creators/[id]/payout-settings
 * 
 * Get creator's payout settings, eligibility status, and payout history
 * Admin only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin access
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const creatorId = params.id;

    // Get creator
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      select: {
        id: true,
        stripeAccountId: true,
        isStripeOnboarded: true,
        payoutBlocked: true,
        payoutBlockedReason: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    // Get or create payout schedule
    let payoutSchedule = await prisma.payoutScheduleNew.findUnique({
      where: { creatorId },
    });

    if (!payoutSchedule && creator.stripeAccountId) {
      // Create default schedule if missing
      payoutSchedule = await prisma.payoutScheduleNew.create({
        data: {
          creatorId,
          mode: 'AUTOMATIC',
          frequency: 'WEEKLY',
          isActive: true,
          nextPayoutDate: null,
        },
      });
    }

    // Check eligibility
    let eligibility = null;
    let availableBalance = null;

    if (creator.stripeAccountId && creator.isStripeOnboarded) {
      eligibility = await checkPayoutEligibility(creatorId);
      availableBalance = await getCreatorAvailableBalance(creatorId);
    }

    // Get recent payout history (last 10 payouts)
    const payoutHistory = await prisma.payout.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        amount: true,
        status: true,
        stripePayoutId: true,
        failureReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      creator: {
        id: creator.id,
        name: creator.user.name,
        email: creator.user.email,
        stripeAccountId: creator.stripeAccountId,
        isStripeOnboarded: creator.isStripeOnboarded,
        payoutBlocked: creator.payoutBlocked,
        payoutBlockedReason: creator.payoutBlockedReason,
      },
      payoutSchedule,
      eligibility,
      availableBalance,
      payoutHistory,
    });
  } catch (error: any) {
    console.error('Error fetching payout settings:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paramètres de paiement' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/creators/[id]/payout-settings
 * 
 * Update creator's payout schedule settings
 * Admin only
 * 
 * Body:
 * - mode?: PayoutMode (AUTOMATIC | MANUAL)
 * - frequency?: PayoutFrequency (DAILY | WEEKLY | MONTHLY)
 * - isActive?: boolean
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin access
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const creatorId = params.id;
    const body = await request.json();
    const { mode, frequency, isActive } = body;

    // Validate inputs
    if (mode && !['AUTOMATIC', 'MANUAL'].includes(mode)) {
      return NextResponse.json(
        { error: 'Mode de paiement invalide. Doit être AUTOMATIC ou MANUAL.' },
        { status: 400 }
      );
    }

    if (frequency && !['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
      return NextResponse.json(
        { error: 'Fréquence invalide. Doit être DAILY, WEEKLY ou MONTHLY.' },
        { status: 400 }
      );
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive doit être un boolean' },
        { status: 400 }
      );
    }

    // Check if creator exists
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (mode !== undefined) updateData.mode = mode as PayoutMode;
    if (frequency !== undefined) updateData.frequency = frequency as PayoutFrequency;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update or create payout schedule
    const payoutSchedule = await prisma.payoutScheduleNew.upsert({
      where: { creatorId },
      update: updateData,
      create: {
        creatorId,
        mode: mode || 'AUTOMATIC',
        frequency: frequency || 'WEEKLY',
        isActive: isActive !== undefined ? isActive : true,
        nextPayoutDate: null,
      },
    });

    // Log the change
    await logTransaction({
      eventType: TransactionEventType.PAYOUT_CREATED,
      entityType: EntityType.PAYOUT,
      entityId: creatorId,
      amount: 0,
      currency: 'EUR',
      status: 'SETTINGS_UPDATED',
      metadata: {
        action: 'payout_settings_updated',
        adminId: jwtUser.userId,
        creatorId,
        changes: updateData,
        previousSettings: {
          mode: payoutSchedule.mode,
          frequency: payoutSchedule.frequency,
          isActive: payoutSchedule.isActive,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Paramètres de paiement mis à jour avec succès',
      payoutSchedule,
    });
  } catch (error: any) {
    console.error('Error updating payout settings:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des paramètres de paiement' },
      { status: 500 }
    );
  }
}

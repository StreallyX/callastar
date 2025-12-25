import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { PayoutSchedule } from '@prisma/client';

/**
 * GET /api/creators/payout-settings
 * Fetch creator's payout settings
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated as creator
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Get creator
    const creator = await db.creator.findUnique({
      where: { userId: jwtUser.userId },
      select: {
        id: true,
        payoutSchedule: true,
        payoutMinimum: true,
        isPayoutBlocked: true,
        payoutBlockReason: true,
      }
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      settings: {
        payoutSchedule: creator.payoutSchedule,
        payoutMinimum: Number(creator.payoutMinimum),
        isPayoutBlocked: creator.isPayoutBlocked,
        payoutBlockReason: creator.payoutBlockReason,
      }
    });
  } catch (error) {
    console.error('Error fetching payout settings:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paramètres de paiement' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/creators/payout-settings
 * Update creator's payout settings
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify user is authenticated as creator
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Get creator
    const creator = await db.creator.findUnique({
      where: { userId: jwtUser.userId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { payoutSchedule, payoutMinimum } = body;

    // Validation
    const errors: string[] = [];

    // Validate payout schedule
    if (payoutSchedule && !['DAILY', 'WEEKLY', 'MANUAL'].includes(payoutSchedule)) {
      errors.push('Le planning de paiement doit être DAILY, WEEKLY ou MANUAL');
    }

    // Validate payout minimum
    if (payoutMinimum !== undefined) {
      const minimum = Number(payoutMinimum);
      if (isNaN(minimum) || minimum < 10) {
        errors.push('Le montant minimum de paiement doit être au moins 10€');
      }
      if (minimum > 10000) {
        errors.push('Le montant minimum de paiement ne peut pas dépasser 10 000€');
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation échouée', details: errors },
        { status: 400 }
      );
    }

    // Update creator settings
    const updateData: any = {};
    if (payoutSchedule) {
      updateData.payoutSchedule = payoutSchedule as PayoutSchedule;
    }
    if (payoutMinimum !== undefined) {
      updateData.payoutMinimum = Number(payoutMinimum);
    }

    const updatedCreator = await db.creator.update({
      where: { id: creator.id },
      data: updateData,
      select: {
        id: true,
        payoutSchedule: true,
        payoutMinimum: true,
        isPayoutBlocked: true,
        payoutBlockReason: true,
      }
    });

    return NextResponse.json({
      message: 'Paramètres de paiement mis à jour avec succès',
      settings: {
        payoutSchedule: updatedCreator.payoutSchedule,
        payoutMinimum: Number(updatedCreator.payoutMinimum),
        isPayoutBlocked: updatedCreator.isPayoutBlocked,
        payoutBlockReason: updatedCreator.payoutBlockReason,
      }
    });
  } catch (error) {
    console.error('Error updating payout settings:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des paramètres de paiement' },
      { status: 500 }
    );
  }
}

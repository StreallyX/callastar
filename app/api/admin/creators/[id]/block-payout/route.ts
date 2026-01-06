import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import { logTransaction } from '@/lib/logger';
import { TransactionEventType, EntityType } from '@prisma/client';

/**
 * POST /api/admin/creators/[id]/block-payout
 * 
 * Block or unblock payouts for a creator
 * Admin only
 * 
 * Body:
 * - blocked: boolean (true to block, false to unblock)
 * - reason?: string (required when blocking, optional when unblocking)
 */
export async function POST(
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
    const { blocked, reason } = body;

    // Validate inputs
    if (typeof blocked !== 'boolean') {
      return NextResponse.json(
        { error: 'blocked doit être un boolean' },
        { status: 400 }
      );
    }

    if (blocked && !reason) {
      return NextResponse.json(
        { error: 'Une raison est requise pour bloquer les paiements' },
        { status: 400 }
      );
    }

    // Check if creator exists
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      select: {
        id: true,
        payoutBlocked: true,
        payoutBlockReason: true,
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

    // Update creator payout block status
    const updatedCreator = await prisma.creator.update({
      where: { id: creatorId },
      data: {
        payoutBlocked: blocked,
        payoutBlockReason: blocked ? reason : null,
      },
    });

    // Log the action
    await logTransaction({
      eventType: blocked ? TransactionEventType.PAYOUT_CREATED : TransactionEventType.PAYOUT_CREATED,
      entityType: EntityType.PAYOUT,
      entityId: creatorId,
      amount: 0,
      currency: 'EUR',
      status: blocked ? 'BLOCKED' : 'UNBLOCKED',
      metadata: {
        action: blocked ? 'payout_blocked' : 'payout_unblocked',
        adminId: jwtUser.userId,
        creatorId,
        reason: reason || 'N/A',
        previousStatus: {
          payoutBlocked: creator.payoutBlocked,
          payoutBlockReason: creator.payoutBlockReason,
        },
      },
    });

    console.log(
      `${blocked ? '🚫' : '✅'} Payout ${blocked ? 'blocked' : 'unblocked'} for creator ${creatorId} by admin ${jwtUser.userId}`
    );

    return NextResponse.json({
      success: true,
      message: blocked
        ? `Paiements bloqués pour ${creator.user.name || creator.user.email}`
        : `Paiements débloqués pour ${creator.user.name || creator.user.email}`,
      creator: {
        id: updatedCreator.id,
        payoutBlocked: updatedCreator.payoutBlocked,
        payoutBlockReason: updatedCreator.payoutBlockReason,
      },
    });
  } catch (error: any) {
    console.error('Error blocking/unblocking payout:', error);
    return NextResponse.json(
      { error: 'Erreur lors du blocage/déblocage des paiements' },
      { status: 500 }
    );
  }
}

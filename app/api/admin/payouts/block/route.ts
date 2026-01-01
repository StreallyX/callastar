import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { logAdminAction, logError, logApiError, logWarning } from '@/lib/system-logger';
import { PayoutAction, LogStatus, LogActor } from '@prisma/client';

/**
 * POST /api/admin/payouts/block
 * Block payouts for a creator (Admin only)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify user is authenticated as admin
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      await logError(
        'PAYOUT_BLOCK_UNAUTHORIZED',
        LogActor.GUEST,
        'Tentative de blocage de payout sans autorisation admin',
        undefined,
        { endpoint: '/api/admin/payouts/block' }
      );
      
      return NextResponse.json(
        { error: 'Non autorisé - Accès administrateur requis' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { creatorId, reason } = body;

    // Log initiation
    await logAdminAction(
      'PAYOUT_BLOCK_INITIATED',
      jwtUser.userId,
      'Blocage de payout initié par administrateur',
      LogStatus.SUCCESS,
      {
        adminId: jwtUser.userId,
        adminEmail: jwtUser.email,
        creatorId,
        reason,
      }
    );

    // Validation
    if (!creatorId) {
      await logError(
        'PAYOUT_BLOCK_VALIDATION_ERROR',
        LogActor.ADMIN,
        'ID du créateur manquant pour blocage de payout',
        jwtUser.userId,
        { error: 'missing_creator_id' }
      );
      
      return NextResponse.json(
        { error: 'L\'ID du créateur est requis' },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length === 0) {
      await logError(
        'PAYOUT_BLOCK_VALIDATION_ERROR',
        LogActor.ADMIN,
        'Raison manquante pour blocage de payout',
        jwtUser.userId,
        { creatorId, error: 'missing_reason' }
      );
      
      return NextResponse.json(
        { error: 'Une raison pour le blocage est requise' },
        { status: 400 }
      );
    }

    // Get creator
    const creator = await db.creator.findUnique({
      where: { id: creatorId },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    if (!creator) {
      await logError(
        'PAYOUT_BLOCK_CREATOR_NOT_FOUND',
        LogActor.ADMIN,
        'Créateur introuvable pour blocage de payout',
        jwtUser.userId,
        { creatorId }
      );
      
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    // Check if already blocked
    if (creator.isPayoutBlocked) {
      await logWarning(
        'PAYOUT_BLOCK_ALREADY_BLOCKED',
        LogActor.ADMIN,
        'Tentative de blocage pour un créateur déjà bloqué',
        jwtUser.userId,
        {
          creatorId,
          creatorName: creator.user.name,
          creatorEmail: creator.user.email,
          currentReason: creator.payoutBlockReason,
        }
      );
      
      return NextResponse.json(
        { 
          error: 'Déjà bloqué',
          message: 'Les paiements pour ce créateur sont déjà bloqués',
          currentReason: creator.payoutBlockReason
        },
        { status: 400 }
      );
    }

    // Update creator - block payouts
    const updatedCreator = await db.creator.update({
      where: { id: creatorId },
      data: {
        isPayoutBlocked: true,
        payoutBlockReason: reason,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    // Create audit log entry
    const auditLog = await db.payoutAuditLog.create({
      data: {
        creatorId: creator.id,
        action: PayoutAction.BLOCKED,
        adminId: jwtUser.userId,
        reason: reason,
        metadata: JSON.stringify({
          adminEmail: jwtUser.email,
          timestamp: new Date().toISOString(),
        })
      }
    });

    const processingTime = Date.now() - startTime;

    // Log success
    await logAdminAction(
      'CREATOR_PAYOUT_BLOCKED',
      jwtUser.userId,
      `Payouts bloqués avec succès pour le créateur ${creator.user.name || creator.user.email}`,
      LogStatus.SUCCESS,
      {
        creatorId,
        creatorName: creator.user.name,
        creatorEmail: creator.user.email,
        blockReason: reason,
        adminId: jwtUser.userId,
        adminEmail: jwtUser.email,
        processingTimeMs: processingTime,
        auditLogId: auditLog.id,
      }
    );

    return NextResponse.json({
      message: 'Paiements bloqués avec succès',
      creator: {
        id: updatedCreator.id,
        name: updatedCreator.user.name,
        email: updatedCreator.user.email,
        isPayoutBlocked: updatedCreator.isPayoutBlocked,
        payoutBlockReason: updatedCreator.payoutBlockReason,
      },
      auditLog: {
        id: auditLog.id,
        action: auditLog.action,
        createdAt: auditLog.createdAt,
      }
    });
  } catch (error) {
    console.error('Error blocking payouts:', error);

    // Log API error
    const jwtUser = await getUserFromRequest(request).catch(() => null);
    await logApiError(
      '/api/admin/payouts/block',
      error instanceof Error ? error : 'Unknown error',
      {
        actor: LogActor.ADMIN,
        actorId: jwtUser?.userId,
        action: 'BLOCK_PAYOUT',
        processingTimeMs: Date.now() - startTime,
      }
    );

    return NextResponse.json(
      { error: 'Erreur lors du blocage des paiements' },
      { status: 500 }
    );
  }
}

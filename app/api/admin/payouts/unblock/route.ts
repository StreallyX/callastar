import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { logAdminAction, logError, logApiError, logWarning, logInfo } from '@/lib/system-logger';
import { PayoutAction, LogStatus, LogActor } from '@prisma/client';

/**
 * POST /api/admin/payouts/unblock
 * Unblock payouts for a creator (Admin only)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify user is authenticated as admin
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      await logError(
        'PAYOUT_UNBLOCK_UNAUTHORIZED',
        LogActor.GUEST,
        'Tentative de déblocage de payout sans autorisation admin',
        undefined,
        { endpoint: '/api/admin/payouts/unblock' }
      );
      
      return NextResponse.json(
        { error: 'Non autorisé - Accès administrateur requis' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { creatorId } = body;

    // Log initiation
    await logAdminAction(
      'PAYOUT_UNBLOCK_INITIATED',
      jwtUser.userId,
      'Déblocage de payout initié par administrateur',
      LogStatus.SUCCESS,
      {
        adminId: jwtUser.userId,
        adminEmail: jwtUser.email,
        creatorId,
      }
    );

    // Validation
    if (!creatorId) {
      await logError(
        'PAYOUT_UNBLOCK_VALIDATION_ERROR',
        LogActor.ADMIN,
        'ID du créateur manquant pour déblocage de payout',
        jwtUser.userId,
        { error: 'missing_creator_id' }
      );
      
      return NextResponse.json(
        { error: 'L\'ID du créateur est requis' },
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
        'PAYOUT_UNBLOCK_CREATOR_NOT_FOUND',
        LogActor.ADMIN,
        'Créateur introuvable pour déblocage de payout',
        jwtUser.userId,
        { creatorId }
      );
      
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    // Check if not blocked
    if (!creator.isPayoutBlocked) {
      await logWarning(
        'PAYOUT_UNBLOCK_NOT_BLOCKED',
        LogActor.ADMIN,
        'Tentative de déblocage pour un créateur non bloqué',
        jwtUser.userId,
        {
          creatorId,
          creatorName: creator.user.name,
          creatorEmail: creator.user.email,
        }
      );
      
      return NextResponse.json(
        { 
          error: 'Pas bloqué',
          message: 'Les paiements pour ce créateur ne sont pas bloqués'
        },
        { status: 400 }
      );
    }

    // Update creator - unblock payouts
    const updatedCreator = await db.creator.update({
      where: { id: creatorId },
      data: {
        isPayoutBlocked: false,
        payoutBlockReason: null,
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
        action: PayoutAction.UNBLOCKED,
        adminId: jwtUser.userId,
        reason: 'Paiements débloqués par un administrateur',
        metadata: JSON.stringify({
          adminEmail: jwtUser.email,
          timestamp: new Date().toISOString(),
          previousBlockReason: creator.payoutBlockReason,
        })
      }
    });

    const processingTime = Date.now() - startTime;

    // Log success
    await logAdminAction(
      'CREATOR_PAYOUT_UNBLOCKED',
      jwtUser.userId,
      `Payouts débloqués avec succès pour le créateur ${creator.user.name || creator.user.email}`,
      LogStatus.SUCCESS,
      {
        creatorId,
        creatorName: creator.user.name,
        creatorEmail: creator.user.email,
        previousBlockReason: creator.payoutBlockReason,
        adminId: jwtUser.userId,
        adminEmail: jwtUser.email,
        processingTimeMs: processingTime,
        auditLogId: auditLog.id,
      }
    );

    return NextResponse.json({
      message: 'Paiements débloqués avec succès',
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
    console.error('Error unblocking payouts:', error);

    // Log API error
    const jwtUser = await getUserFromRequest(request).catch(() => null);
    await logApiError(
      '/api/admin/payouts/unblock',
      error instanceof Error ? error : 'Unknown error',
      LogActor.ADMIN,
      jwtUser?.userId,
      {
        action: 'UNBLOCK_PAYOUT',
        processingTimeMs: Date.now() - startTime,
      }
    );

    return NextResponse.json(
      { error: 'Erreur lors du déblocage des paiements' },
      { status: 500 }
    );
  }
}

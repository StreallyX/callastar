import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import { logPayout } from '@/lib/logger';
import { TransactionEventType, PayoutStatus, LogStatus, LogActor } from '@prisma/client';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';
import { logAdminAction, logPayoutEvent, logError as logSystemError } from '@/lib/system-logger';

/**
 * POST /api/admin/payouts/[id]/reject
 * Admin endpoint to reject a payout request
 * 
 * This will:
 * 1. Verify the payout exists and is PENDING_APPROVAL
 * 2. Change status to REJECTED
 * 3. Record the rejection reason
 * 4. Send notification to creator
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rejectionStartTime = Date.now();
  
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      // Log unauthorized rejection attempt
      await logSystemError(
        'PAYOUT_REJECTION_UNAUTHORIZED',
        LogActor.GUEST,
        'Tentative de rejet de payout non autorisée',
        undefined,
        {
          endpoint: '/api/admin/payouts/[id]/reject',
          payoutId: params.id,
          hasAuth: !!jwtUser,
          role: jwtUser?.role,
        }
      );
      
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const payoutId = params.id;
    
    // Parse request body for rejection reason
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    if (!reason || reason.trim() === '') {
      // Log missing rejection reason
      await logSystemError(
        'PAYOUT_REJECTION_NO_REASON',
        LogActor.ADMIN,
        'Tentative de rejet de payout sans raison fournie',
        jwtUser.userId,
        {
          payoutId: payoutId,
          adminId: jwtUser.userId,
        }
      );
      
      return NextResponse.json(
        { error: 'La raison du rejet est requise' },
        { status: 400 }
      );
    }
    
    // Log rejection initiation
    await logAdminAction(
      'PAYOUT_REJECTION_INITIATED',
      jwtUser.userId,
      `Rejet de payout initiée par l'administrateur`,
      LogStatus.SUCCESS,
      {
        payoutId: payoutId,
        adminId: jwtUser.userId,
        adminEmail: jwtUser.email,
        rejectionReason: reason,
      }
    );

    // Get the payout
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        creator: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!payout) {
      // Log payout not found
      await logSystemError(
        'PAYOUT_REJECTION_NOT_FOUND',
        LogActor.ADMIN,
        'Paiement introuvable lors du rejet',
        jwtUser.userId,
        {
          payoutId: payoutId,
          adminId: jwtUser.userId,
        }
      );
      
      return NextResponse.json(
        { error: 'Paiement introuvable' },
        { status: 404 }
      );
    }

    // ✅ PHASE 3: Verify status is REQUESTED
    if (payout.status !== PayoutStatus.REQUESTED) {
      // Log invalid status
      await logSystemError(
        'PAYOUT_REJECTION_INVALID_STATUS',
        LogActor.ADMIN,
        `Tentative de rejet d'un payout avec un statut invalide: ${payout.status}`,
        jwtUser.userId,
        {
          payoutId: payoutId,
          adminId: jwtUser.userId,
          currentStatus: payout.status,
          expectedStatus: PayoutStatus.REQUESTED,
          creatorId: payout.creatorId,
          amount: Number(payout.amount),
        }
      );
      
      return NextResponse.json(
        { error: `Ce paiement ne peut pas être rejeté. Statut actuel: ${payout.status}` },
        { status: 400 }
      );
    }

    const payoutAmountEur = Number(payout.amount);
    const stripeCurrency = payout.currency || 'EUR';

    // ✅ PHASE 3: Update payout to REJECTED with rejectedAt
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.REJECTED,
        rejectionReason: reason,
        approvedById: jwtUser.userId, // Admin who rejected
        rejectedAt: new Date(), // ✅ PHASE 3: New field
      },
    });
    
    // Log rejection with full details
    await logPayoutEvent(
      'REJECTED',
      payout.id,
      payout.creatorId,
      payoutAmountEur,
      stripeCurrency,
      LogStatus.SUCCESS,
      {
        payoutId: payout.id,
        adminId: jwtUser.userId,
        creatorId: payout.creatorId,
        creatorEmail: payout.creator.user.email,
        rejectionReason: reason,
        previousStatus: PayoutStatus.REQUESTED,
        newStatus: PayoutStatus.REJECTED,
        rejectedAt: new Date().toISOString(),
      }
    );

    // Log rejection
    await logPayout(TransactionEventType.PAYOUT_FAILED, {
      payoutId: payout.id,
      creatorId: payout.creatorId,
      amount: payoutAmountEur,
      currency: 'EUR',
      status: PayoutStatus.REJECTED,
      errorMessage: reason,
      metadata: {
        rejectedBy: jwtUser.userId,
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason,
      },
    });

    // ✅ PHASE 3: Create audit log entry with payoutId
    await prisma.payoutAuditLog.create({
      data: {
        creatorId: payout.creator.id,
        payoutId: payout.id,
        action: 'FAILED',
        amount: payoutAmountEur,
        status: PayoutStatus.REJECTED,
        adminId: jwtUser.userId,
        reason: `Paiement rejeté par l'administrateur: ${reason}`,
        metadata: JSON.stringify({
          rejectedBy: jwtUser.userId,
          rejectedAt: new Date().toISOString(),
          rejectionReason: reason,
        }),
      },
    });

    // Send notification to creator
    try {
      await createNotification({
        userId: payout.creator.userId,
        type: 'SYSTEM',
        title: '❌ Demande de paiement rejetée',
        message: `Votre demande de paiement de ${payoutAmountEur.toFixed(2)} ${stripeCurrency} a été rejetée. Raison: ${reason}`,
        link: '/dashboard/creator',
      });

      // Send email
      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .alert { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
              .amount { font-size: 24px; font-weight: bold; color: #ef4444; text-align: center; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>❌ Paiement rejeté</h1>
              </div>
              <div class="content">
                <p>Bonjour ${payout.creator.user.name},</p>
                <p>Votre demande de paiement a été rejetée par l'administrateur.</p>
                <div class="amount">${payoutAmountEur.toFixed(2)} ${stripeCurrency}</div>
                <div class="alert">
                  <strong>Raison du rejet:</strong><br>
                  ${reason}
                </div>
                <p>Si vous avez des questions concernant ce rejet, veuillez contacter l'équipe support.</p>
                <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
                  Call a Star - Équipe Support
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

      await sendEmail({
        to: payout.creator.user.email,
        subject: '❌ Demande de paiement rejetée - Call a Star',
        html: emailHtml,
      });
    } catch (error) {
      console.error('Error sending creator notification:', error);
      // Non-critical, continue
    }

    // Log successful rejection completion
    const rejectionDuration = Date.now() - rejectionStartTime;
    await logAdminAction(
      'PAYOUT_REJECTION_SUCCESS',
      jwtUser.userId,
      `Payout rejeté avec succès par l'administrateur`,
      LogStatus.SUCCESS,
      {
        payoutId: payout.id,
        adminId: jwtUser.userId,
        creatorId: payout.creatorId,
        creatorEmail: payout.creator.user.email,
        amount: payoutAmountEur,
        currency: stripeCurrency,
        rejectionReason: reason,
        processingTimeMs: rejectionDuration,
      }
    );
    
    return NextResponse.json({
      success: true,
      message: 'Paiement rejeté',
      payout: {
        id: payout.id,
        amountEur: payoutAmountEur,
        currency: stripeCurrency,
        status: 'rejected',
        rejectionReason: reason,
      },
    });
  } catch (error) {
    console.error('Error rejecting payout:', error);
    
    // Log fatal error
    const rejectionDuration = Date.now() - rejectionStartTime;
    await logSystemError(
      'PAYOUT_REJECTION_FATAL_ERROR',
      LogActor.SYSTEM,
      `Erreur fatale lors du rejet de payout: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: rejectionDuration,
      }
    );
    
    return NextResponse.json(
      { error: 'Erreur lors du rejet du paiement' },
      { status: 500 }
    );
  }
}

/**
 * Helper functions for managing creator debts in Separate Charges and Transfers model
 * 
 * When a refund or dispute occurs, the creator has already received their payment (85%).
 * We need to recover this amount through:
 * 1. Transfer Reversal (if within 180 days)
 * 2. Payout deduction (automatic from future payouts)
 * 3. Manual reconciliation (admin intervention)
 */

import { stripe } from '@/lib/stripe';
import prisma from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';

/**
 * Calculate creator debt based on refund/dispute amount
 * Platform absorbs Stripe fees, so we need to recover 85% from creator
 */
export function calculateCreatorDebt(amount: number): number {
  // Creator received 85% of the payment, so they owe 85% of the refund
  return amount * 0.85;
}

/**
 * Attempt Transfer Reversal to recover creator debt
 * Only possible within 180 days of the original transfer
 * 
 * @param transferId - Stripe Transfer ID
 * @param amountInCents - Amount to reverse in cents
 * @returns Success status and reversal ID if successful
 */
export async function attemptTransferReversal(
  transferId: string,
  amountInCents: number
): Promise<{ success: boolean; reversalId?: string; error?: string }> {
  try {
    console.log(`[Creator Debt] Attempting transfer reversal:`, {
      transferId,
      amountInCents,
    });

    // Create Transfer Reversal
    const reversal = await stripe.transfers.createReversal(transferId, {
      amount: amountInCents,
      metadata: {
        reason: 'Refund/Dispute recovery',
        createdAt: new Date().toISOString(),
      },
    });

    console.log(`[Creator Debt] ✅ Transfer reversal successful:`, {
      reversalId: reversal.id,
      amount: reversal.amount / 100,
    });

    return {
      success: true,
      reversalId: reversal.id,
    };
  } catch (error: any) {
    console.error(`[Creator Debt] ❌ Transfer reversal failed:`, {
      transferId,
      error: error.message,
      code: error.code,
    });

    // Common error codes:
    // - transfer_already_reversed: Transfer has already been reversed
    // - transfer_source_balance_insufficient: Not enough balance in connected account
    // - transfer_reversals_disabled: Transfer reversals are not supported for this transfer
    // - transfer_too_old: Transfer is older than 180 days

    return {
      success: false,
      error: error.message || 'Transfer reversal failed',
    };
  }
}

/**
 * Get total unreconciled debt for a creator
 * Includes both refunds and disputes
 */
export async function getCreatorUnreconciledDebt(creatorId: string): Promise<{
  totalDebt: number;
  refundDebt: number;
  disputeDebt: number;
  refunds: any[];
  disputes: any[];
}> {
  // Find all payments for this creator
  const payments = await prisma.payment.findMany({
    where: {
      booking: {
        callOffer: {
          creatorId: creatorId,
        },
      },
    },
    select: { id: true },
  });

  const paymentIds = payments.map((p) => p.id);

  // Get unreconciled refunds
  const refunds = await prisma.refund.findMany({
    where: {
      paymentId: { in: paymentIds },
      reconciled: false,
      status: 'SUCCEEDED', // Only count successful refunds
    },
    include: {
      payment: {
        include: {
          booking: {
            include: {
              callOffer: {
                select: { title: true },
              },
              user: {
                select: { name: true, email: true },
              },
            },
          },
        },
      },
    },
  });

  // Get unreconciled disputes
  const disputes = await prisma.dispute.findMany({
    where: {
      paymentId: { in: paymentIds },
      reconciled: false,
      status: { in: ['LOST', 'CHARGE_REFUNDED'] }, // Only count lost disputes
    },
    include: {
      payment: {
        include: {
          booking: {
            include: {
              callOffer: {
                select: { title: true },
              },
              user: {
                select: { name: true, email: true },
              },
            },
          },
        },
      },
    },
  });

  const refundDebt = refunds.reduce((sum, r) => sum + Number(r.creatorDebt), 0);
  const disputeDebt = disputes.reduce((sum, d) => sum + Number(d.creatorDebt), 0);
  const totalDebt = refundDebt + disputeDebt;

  return {
    totalDebt,
    refundDebt,
    disputeDebt,
    refunds,
    disputes,
  };
}

/**
 * Mark a refund as reconciled
 */
export async function markRefundAsReconciled(
  refundId: string,
  reconciledBy: 'TRANSFER_REVERSAL' | 'PAYOUT_DEDUCTION' | 'MANUAL',
  reversalId?: string
): Promise<void> {
  await prisma.refund.update({
    where: { id: refundId },
    data: {
      reconciled: true,
      reconciledAt: new Date(),
      reconciledBy,
      reversalId,
    },
  });

  console.log(`[Creator Debt] Refund ${refundId} marked as reconciled via ${reconciledBy}`);
}

/**
 * Mark a dispute as reconciled
 */
export async function markDisputeAsReconciled(
  disputeId: string,
  reconciledBy: 'TRANSFER_REVERSAL' | 'PAYOUT_DEDUCTION' | 'MANUAL',
  reversalId?: string
): Promise<void> {
  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      reconciled: true,
      reconciledAt: new Date(),
      reconciledBy,
      reversalId,
    },
  });

  console.log(`[Creator Debt] Dispute ${disputeId} marked as reconciled via ${reconciledBy}`);
}

/**
 * Block creator payouts if debt exceeds threshold
 * Default threshold: 100 EUR
 */
export async function checkAndBlockPayouts(
  creatorId: string,
  threshold: number = 100
): Promise<void> {
  const debtInfo = await getCreatorUnreconciledDebt(creatorId);

  if (debtInfo.totalDebt >= threshold) {
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      include: { user: true },
    });

    if (!creator) return;

    // Block payouts if not already blocked
    if (!creator.payoutBlocked) {
      await prisma.creator.update({
        where: { id: creatorId },
        data: {
          payoutBlocked: true,
          payoutBlockedReason: `Dette impayée de ${debtInfo.totalDebt.toFixed(2)} EUR (remboursements: ${debtInfo.refundDebt.toFixed(2)} EUR, contestations: ${debtInfo.disputeDebt.toFixed(2)} EUR)`,
        },
      });

      // Notify creator
      await createNotification({
        userId: creator.userId,
        type: 'SYSTEM',
        title: '⚠️ Paiements bloqués',
        message: `Vos paiements ont été temporairement bloqués en raison d'une dette impayée de ${debtInfo.totalDebt.toFixed(2)} EUR. Cette dette sera automatiquement déduite de vos prochains paiements.`,
        link: '/dashboard/creator',
      });

      // Send email to creator
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
            .debt-box { background: #fff; border: 1px solid #e5e5e5; padding: 15px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Paiements temporairement bloqués</h1>
            </div>
            <div class="content">
              <p>Bonjour ${creator.user.name},</p>
              <p>Vos paiements ont été temporairement bloqués en raison d'une dette impayée liée à des remboursements ou contestations.</p>
              
              <div class="debt-box">
                <h3>Détails de la dette</h3>
                <p><strong>Dette totale:</strong> ${debtInfo.totalDebt.toFixed(2)} EUR</p>
                <p><strong>Remboursements:</strong> ${debtInfo.refundDebt.toFixed(2)} EUR</p>
                <p><strong>Contestations:</strong> ${debtInfo.disputeDebt.toFixed(2)} EUR</p>
              </div>
              
              <div class="alert">
                <strong>Action requise:</strong> Cette dette sera automatiquement déduite de vos prochains paiements. Une fois la dette remboursée, vos paiements seront automatiquement débloqués.
              </div>
              
              <p>Si vous avez des questions, veuillez contacter le support.</p>
              
              <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
                Call a Star - Service financier
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: creator.user.email,
        subject: '⚠️ Paiements temporairement bloqués - Call a Star',
        html: emailHtml,
      });

      // Notify admins
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, email: true },
      });

      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: 'SYSTEM',
          title: '🚨 Créateur bloqué pour dette',
          message: `Le créateur ${creator.user.name} a été bloqué en raison d'une dette de ${debtInfo.totalDebt.toFixed(2)} EUR.`,
          link: '/dashboard/admin/refunds-disputes',
        });
      }

      console.log(`[Creator Debt] Payouts blocked for creator ${creatorId} due to debt of ${debtInfo.totalDebt.toFixed(2)} EUR`);
    }
  }
}

/**
 * Unblock creator payouts if debt is cleared
 */
export async function checkAndUnblockPayouts(creatorId: string): Promise<void> {
  const debtInfo = await getCreatorUnreconciledDebt(creatorId);

  if (debtInfo.totalDebt === 0) {
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      include: { user: true },
    });

    if (!creator) return;

    // Unblock payouts if currently blocked
    if (creator.payoutBlocked) {
      await prisma.creator.update({
        where: { id: creatorId },
        data: {
          payoutBlocked: false,
          payoutBlockedReason: null,
        },
      });

      // Notify creator
      await createNotification({
        userId: creator.userId,
        type: 'SYSTEM',
        title: '✅ Paiements débloqués',
        message: 'Vos paiements ont été débloqués. Vous pouvez maintenant demander des paiements normalement.',
        link: '/dashboard/creator',
      });

      console.log(`[Creator Debt] Payouts unblocked for creator ${creatorId}`);
    }
  }
}

/**
 * Notify creator and admin about a new debt
 */
export async function notifyDebt(
  creatorId: string,
  type: 'REFUND' | 'DISPUTE',
  amount: number,
  reason: string
): Promise<void> {
  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: { user: true },
  });

  if (!creator) return;

  const creatorDebt = calculateCreatorDebt(amount);
  const typeLabel = type === 'REFUND' ? 'remboursement' : 'contestation';

  // Notify creator
  await createNotification({
    userId: creator.userId,
    type: 'SYSTEM',
    title: `⚠️ ${type === 'REFUND' ? 'Remboursement' : 'Contestation'} enregistré`,
    message: `Un ${typeLabel} de ${amount.toFixed(2)} EUR a été enregistré. Vous devez ${creatorDebt.toFixed(2)} EUR qui sera automatiquement déduit de vos prochains paiements.`,
    link: '/dashboard/creator',
  });

  // Send email to creator
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .info-box { background: #fff; border: 1px solid #e5e5e5; padding: 15px; border-radius: 8px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ ${type === 'REFUND' ? 'Remboursement' : 'Contestation'} enregistré</h1>
        </div>
        <div class="content">
          <p>Bonjour ${creator.user.name},</p>
          <p>Un ${typeLabel} a été enregistré pour un de vos paiements.</p>
          
          <div class="info-box">
            <h3>Détails</h3>
            <p><strong>Montant du ${typeLabel}:</strong> ${amount.toFixed(2)} EUR</p>
            <p><strong>Montant que vous devez:</strong> ${creatorDebt.toFixed(2)} EUR</p>
            <p><strong>Raison:</strong> ${reason}</p>
          </div>
          
          <p>Ce montant sera automatiquement déduit de vos prochains paiements. Si vous avez des questions, veuillez contacter le support.</p>
          
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
            Call a Star - Service financier
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: creator.user.email,
    subject: `⚠️ ${type === 'REFUND' ? 'Remboursement' : 'Contestation'} enregistré - Call a Star`,
    html: emailHtml,
  });

  // Notify admins
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true },
  });

  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: 'SYSTEM',
      title: `🚨 ${type === 'REFUND' ? 'Remboursement' : 'Contestation'} - Dette créateur`,
      message: `${creator.user.name} doit ${creatorDebt.toFixed(2)} EUR suite à un ${typeLabel} de ${amount.toFixed(2)} EUR.`,
      link: '/dashboard/admin/refunds-disputes',
    });
  }
}

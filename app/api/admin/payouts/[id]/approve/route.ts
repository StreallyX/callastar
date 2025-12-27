import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import { createConnectPayout } from '@/lib/stripe';
import { logPayout } from '@/lib/logger';
import { TransactionEventType, PayoutStatus } from '@prisma/client';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';

/**
 * POST /api/admin/payouts/[id]/approve
 * Admin endpoint to approve a payout request
 * 
 * This will:
 * 1. Verify the payout exists and is PENDING_APPROVAL
 * 2. Change status to APPROVED
 * 3. Trigger the actual Stripe payout
 * 4. Record the stripePayoutId
 * 5. Send notification to creator
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const payoutId = params.id;

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
      return NextResponse.json(
        { error: 'Paiement introuvable' },
        { status: 404 }
      );
    }

    // Verify status
    if (payout.status !== PayoutStatus.PENDING_APPROVAL) {
      return NextResponse.json(
        { error: `Ce paiement ne peut pas être approuvé. Statut actuel: ${payout.status}` },
        { status: 400 }
      );
    }

    // Verify creator has Stripe account
    if (!payout.creator.stripeAccountId || !payout.creator.isStripeOnboarded) {
      return NextResponse.json(
        { error: 'Le créateur n\'a pas configuré son compte Stripe' },
        { status: 400 }
      );
    }

    // Get payment amount details
    const payoutAmountEur = Number(payout.amount);
    const stripeCurrency = payout.currency || 'EUR';
    const payoutAmountInStripeCurrency = payout.amountPaid ? Number(payout.amountPaid) : payoutAmountEur;

    // Update payout to APPROVED (temporarily, will be PROCESSING after Stripe call)
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.APPROVED,
        approvedById: jwtUser.userId,
        approvedAt: new Date(),
      },
    });

    // Log approval
    await logPayout(TransactionEventType.PAYOUT_CREATED, {
      payoutId: payout.id,
      creatorId: payout.creatorId,
      amount: payoutAmountEur,
      currency: 'EUR',
      status: PayoutStatus.APPROVED,
      metadata: {
        approvedBy: jwtUser.userId,
        approvedAt: new Date().toISOString(),
      },
    });

    try {
      // Create payout from Stripe Connect account to bank account
      const stripePayout = await createConnectPayout({
        amount: payoutAmountInStripeCurrency,
        currency: stripeCurrency.toLowerCase(),
        stripeAccountId: payout.creator.stripeAccountId,
        metadata: {
          creatorId: payout.creator.id,
          payoutId: payout.id,
          manual: 'true',
          approvedBy: jwtUser.userId,
          amountEur: String(payoutAmountEur),
          stripeCurrency: stripeCurrency,
          ...(payout.conversionRate && { conversionRate: String(payout.conversionRate) }),
        },
      });

      // Update payout with Stripe payout ID and PROCESSING status
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          stripePayoutId: stripePayout.id,
          status: PayoutStatus.PROCESSING,
        },
      });

      // Log payout initiated
      await logPayout(TransactionEventType.PAYOUT_CREATED, {
        payoutId: payout.id,
        creatorId: payout.creator.id,
        amount: payoutAmountEur,
        currency: 'EUR',
        status: PayoutStatus.PROCESSING,
        stripePayoutId: stripePayout.id,
        metadata: {
          stripePayoutId: stripePayout.id,
          approvedBy: jwtUser.userId,
          estimatedArrival: stripePayout.arrival_date
            ? new Date(stripePayout.arrival_date * 1000).toISOString()
            : null,
          stripeCurrency: stripeCurrency,
          amountInStripeCurrency: payoutAmountInStripeCurrency,
          conversionRate: payout.conversionRate ? Number(payout.conversionRate) : null,
          currencyConverted: stripeCurrency !== 'EUR',
        },
      });

      // Create audit log entry
      await prisma.payoutAuditLog.create({
        data: {
          creatorId: payout.creator.id,
          action: 'TRIGGERED',
          amount: payoutAmountEur,
          status: PayoutStatus.PROCESSING,
          stripePayoutId: stripePayout.id,
          adminId: jwtUser.userId,
          reason: `Paiement approuvé par l'administrateur et déclenché sur Stripe`,
          metadata: JSON.stringify({
            approvedBy: jwtUser.userId,
            approvedAt: new Date().toISOString(),
            estimatedArrival: stripePayout.arrival_date
              ? new Date(stripePayout.arrival_date * 1000).toISOString()
              : null,
            stripeCurrency: stripeCurrency,
            amountInStripeCurrency: payoutAmountInStripeCurrency,
            conversionRate: payout.conversionRate ? Number(payout.conversionRate) : null,
            currencyConverted: stripeCurrency !== 'EUR',
          }),
        },
      });

      // Send notification to creator
      try {
        await createNotification({
          userId: payout.creator.userId,
          type: 'PAYOUT_COMPLETED',
          title: '✅ Demande de paiement approuvée',
          message: stripeCurrency !== 'EUR'
            ? `Votre demande de paiement de ${payoutAmountEur.toFixed(2)} EUR (≈ ${payoutAmountInStripeCurrency.toFixed(2)} ${stripeCurrency}) a été approuvée et le transfert est en cours.`
            : `Votre demande de paiement de ${payoutAmountEur.toFixed(2)} EUR a été approuvée et le transfert est en cours.`,
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
                .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .amount { font-size: 32px; font-weight: bold; color: #10b981; text-align: center; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✅ Paiement approuvé</h1>
                </div>
                <div class="content">
                  <p>Bonjour ${payout.creator.user.name},</p>
                  <p>Votre demande de paiement a été approuvée par l'administrateur.</p>
                  <div class="amount">${payoutAmountEur.toFixed(2)} EUR${stripeCurrency !== 'EUR' ? ` (≈ ${payoutAmountInStripeCurrency.toFixed(2)} ${stripeCurrency})` : ''}</div>
                  <p>Le transfert est en cours et les fonds devraient apparaître sur votre compte bancaire dans les prochains jours ouvrables.</p>
                  ${stripePayout.arrival_date ? `<p><strong>Date d'arrivée estimée:</strong> ${new Date(stripePayout.arrival_date * 1000).toLocaleDateString('fr-FR')}</p>` : ''}
                  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
                    Merci d'utiliser Call a Star !
                  </p>
                </div>
              </div>
            </body>
          </html>
        `;

        await sendEmail({
          to: payout.creator.user.email,
          subject: '✅ Paiement approuvé - Call a Star',
          html: emailHtml,
        });
      } catch (error) {
        console.error('Error sending creator notification:', error);
        // Non-critical, continue
      }

      return NextResponse.json({
        success: true,
        message: 'Paiement approuvé et transfert Stripe déclenché',
        payout: {
          id: payout.id,
          amountEur: payoutAmountEur,
          amountPaid: payoutAmountInStripeCurrency,
          currency: stripeCurrency,
          stripePayoutId: stripePayout.id,
          status: 'processing',
          estimatedArrival: stripePayout.arrival_date
            ? new Date(stripePayout.arrival_date * 1000)
            : null,
        },
      });
    } catch (error: any) {
      console.error('Error creating Stripe payout:', error);

      // Revert payout status to PENDING_APPROVAL
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.PENDING_APPROVAL,
          approvedById: null,
          approvedAt: null,
        },
      });

      // Log failed payout
      await logPayout(TransactionEventType.PAYOUT_FAILED, {
        payoutId: payout.id,
        creatorId: payout.creator.id,
        amount: payoutAmountEur,
        currency: 'EUR',
        status: PayoutStatus.FAILED,
        errorMessage: error.message || 'Payout failed',
      });

      // Create audit log for failed approval
      await prisma.payoutAuditLog.create({
        data: {
          creatorId: payout.creator.id,
          action: 'FAILED',
          amount: payoutAmountEur,
          status: PayoutStatus.FAILED,
          adminId: jwtUser.userId,
          reason: `Échec du transfert Stripe après approbation: ${error.message || 'Erreur inconnue'}`,
        },
      });

      return NextResponse.json(
        {
          error: 'Erreur lors du transfert Stripe: ' + (error.message || 'Erreur inconnue'),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error approving payout:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'approbation du paiement' },
      { status: 500 }
    );
  }
}

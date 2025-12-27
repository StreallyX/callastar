import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  createPayout,
  createConnectPayout,
  getConnectAccountDetails,
  getConnectAccountBalance,
} from '@/lib/stripe';
import { getPlatformSettings } from '@/lib/settings';
import { logPayout } from '@/lib/logger';
import { TransactionEventType, PayoutStatus } from '@prisma/client';
import { checkPayoutEligibility, clearBalanceCache } from '@/lib/payout-eligibility';
import { getStripeAccountStatus } from '@/lib/stripe-account-validator';
import { getStripeCurrency, convertEurToStripeCurrency } from '@/lib/currency-converter';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';

/**
 * POST /api/payouts/request
 * Request payout from Stripe Connect account balance
 * 
 * Body parameters:
 * - amount: number (optional) - Specific amount to withdraw, defaults to full available balance
 * - adminOverride: boolean (admin only) - Skip eligibility checks
 * 
 * Supports OnlyFans-style routing where funds are already in creator's Stripe balance
 */
export async function POST(request: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { adminOverride = false, amount: requestedAmount } = body;

    // Check if user is admin (for admin override)
    const isAdmin = jwtUser.role === 'ADMIN';
    const isCreator = jwtUser.role === 'CREATOR';

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Get creator ID (either from JWT for creators or from body for admins)
    let creatorId: string;
    if (isCreator) {
      const creator = await prisma.creator.findUnique({
        where: { userId: jwtUser.userId },
        select: { id: true },
      });
      if (!creator) {
        return NextResponse.json(
          { error: 'Créateur introuvable' },
          { status: 404 }
        );
      }
      creatorId = creator.id;
    } else {
      // Admin can specify creator ID in body
      creatorId = body.creatorId;
      if (!creatorId) {
        return NextResponse.json(
          { error: 'creatorId required for admin payout' },
          { status: 400 }
        );
      }
    }

    // Get creator details with user relation
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      include: {
        user: {
          select: {
            id: true,
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

    // Basic check: Stripe account must exist
    if (!creator.stripeAccountId || !creator.isStripeOnboarded) {
      return NextResponse.json(
        { error: 'Vous devez compléter votre configuration Stripe Connect pour demander un paiement' },
        { status: 400 }
      );
    }

    // Get platform settings
    const settings = await getPlatformSettings();
    const minimumPayoutAmount = Number(settings.minimumPayoutAmount);

    // Check Stripe account status
    const accountStatus = await getStripeAccountStatus(creator.stripeAccountId);
    if (!accountStatus.canReceivePayouts && !adminOverride) {
      return NextResponse.json(
        {
          error: 'Compte Stripe non prêt pour les paiements',
          issues: accountStatus.issues,
          requirements: accountStatus.requirements,
        },
        { status: 400 }
      );
    }

    // Get Stripe Connect account balance
    let stripeBalance;
    try {
      stripeBalance = await getConnectAccountBalance(creator.stripeAccountId);
    } catch (error: any) {
      console.error('Error getting Stripe balance:', error);
      return NextResponse.json(
        { error: 'Impossible de récupérer le solde Stripe' },
        { status: 500 }
      );
    }

    // Calculate available balance in EUR
    const availableInCents = stripeBalance.available.reduce((sum, b) => {
      if (b.currency === 'eur') {
        return sum + b.amount;
      }
      return sum;
    }, 0);

    const availableBalance = availableInCents / 100; // Convert from cents

    // Check if there's available balance
    if (availableBalance <= 0) {
      return NextResponse.json(
        { error: 'Aucun solde disponible pour le moment' },
        { status: 400 }
      );
    }

    // Determine payout amount in EUR (database currency)
    let payoutAmountEur = requestedAmount ? Number(requestedAmount) : availableBalance;

    // Validate requested amount
    if (requestedAmount) {
      if (payoutAmountEur > availableBalance) {
        return NextResponse.json(
          {
            error: `Solde disponible insuffisant. Vous avez ${availableBalance.toFixed(2)} ${settings.currency} disponibles.`,
          },
          { status: 400 }
        );
      }

      if (payoutAmountEur < minimumPayoutAmount) {
        return NextResponse.json(
          {
            error: `Le montant minimum de paiement est de ${minimumPayoutAmount.toFixed(2)} ${settings.currency}.`,
          },
          { status: 400 }
        );
      }
    } else {
      // No specific amount requested, check minimum
      if (availableBalance < minimumPayoutAmount) {
        return NextResponse.json(
          {
            error: `Le montant minimum de paiement est de ${minimumPayoutAmount.toFixed(2)} ${settings.currency}. Vous avez actuellement ${availableBalance.toFixed(2)} ${settings.currency}.`,
          },
          { status: 400 }
        );
      }
    }

    // ✅ NEW: Get Stripe account currency and handle conversion
    const stripeCurrency = await getStripeCurrency(creator.stripeAccountId);
    let payoutAmountInStripeCurrency = payoutAmountEur;
    let conversionRate: number | null = null;
    let conversionDate: Date | null = null;

    // Convert if Stripe currency is different from EUR
    if (stripeCurrency !== 'EUR') {
      try {
        const conversion = await convertEurToStripeCurrency(payoutAmountEur, stripeCurrency);
        payoutAmountInStripeCurrency = conversion.toAmount;
        conversionRate = conversion.rate;
        conversionDate = conversion.timestamp;

        console.log(`[Payout] Currency conversion: ${payoutAmountEur} EUR -> ${payoutAmountInStripeCurrency} ${stripeCurrency} (rate: ${conversionRate})`);
      } catch (error: any) {
        console.error('[Payout] Currency conversion failed:', error);
        return NextResponse.json(
          {
            error: `Erreur de conversion de devise: ${error.message || 'Erreur inconnue'}`,
          },
          { status: 500 }
        );
      }
    }

    // ✅ PHASE 1.2: Check for unreconciled debts and deduct automatically
    const { getCreatorUnreconciledDebt, markRefundAsReconciled, markDisputeAsReconciled } = await import('@/lib/creator-debt');
    const debtInfo = await getCreatorUnreconciledDebt(creator.id);
    
    let debtDeducted = 0;
    let payoutAmountAfterDebt = payoutAmountEur;
    const debtDeductions: { type: string; id: string; amount: number }[] = [];

    if (debtInfo.totalDebt > 0) {
      console.log('[Payout] Creator has unreconciled debt:', {
        totalDebt: debtInfo.totalDebt,
        refundDebt: debtInfo.refundDebt,
        disputeDebt: debtInfo.disputeDebt,
        payoutAmount: payoutAmountEur,
      });

      // Deduct from refunds first
      for (const refund of debtInfo.refunds) {
        const refundDebt = Number(refund.creatorDebt);
        if (payoutAmountAfterDebt >= refundDebt) {
          // Full refund debt can be deducted
          payoutAmountAfterDebt -= refundDebt;
          debtDeducted += refundDebt;
          debtDeductions.push({ type: 'REFUND', id: refund.id, amount: refundDebt });
          
          // Mark refund as reconciled
          await markRefundAsReconciled(refund.id, 'PAYOUT_DEDUCTION');
        } else if (payoutAmountAfterDebt > 0) {
          // Partial deduction
          const partialDeduction = payoutAmountAfterDebt;
          debtDeducted += partialDeduction;
          debtDeductions.push({ type: 'REFUND', id: refund.id, amount: partialDeduction });
          
          // Update refund debt (partial reconciliation)
          await prisma.refund.update({
            where: { id: refund.id },
            data: { creatorDebt: refundDebt - partialDeduction },
          });
          
          payoutAmountAfterDebt = 0;
          break;
        } else {
          break;
        }
      }

      // Deduct from disputes if there's still payout amount left
      for (const dispute of debtInfo.disputes) {
        if (payoutAmountAfterDebt <= 0) break;

        const disputeDebt = Number(dispute.creatorDebt);
        if (payoutAmountAfterDebt >= disputeDebt) {
          // Full dispute debt can be deducted
          payoutAmountAfterDebt -= disputeDebt;
          debtDeducted += disputeDebt;
          debtDeductions.push({ type: 'DISPUTE', id: dispute.id, amount: disputeDebt });
          
          // Mark dispute as reconciled
          await markDisputeAsReconciled(dispute.id, 'PAYOUT_DEDUCTION');
        } else if (payoutAmountAfterDebt > 0) {
          // Partial deduction
          const partialDeduction = payoutAmountAfterDebt;
          debtDeducted += partialDeduction;
          debtDeductions.push({ type: 'DISPUTE', id: dispute.id, amount: partialDeduction });
          
          // Update dispute debt (partial reconciliation)
          await prisma.dispute.update({
            where: { id: dispute.id },
            data: { creatorDebt: disputeDebt - partialDeduction },
          });
          
          payoutAmountAfterDebt = 0;
          break;
        }
      }

      console.log('[Payout] Debt deduction summary:', {
        originalAmount: payoutAmountEur,
        debtDeducted,
        amountAfterDebt: payoutAmountAfterDebt,
        deductions: debtDeductions,
      });

      // Check if we can unblock payouts now
      const { checkAndUnblockPayouts } = await import('@/lib/creator-debt');
      await checkAndUnblockPayouts(creator.id);
    }

    // ✅ NEW: Create payout record with PENDING_APPROVAL status (NO Stripe payout yet)
    // Use the amount after debt deduction
    const payout = await prisma.payout.create({
      data: {
        creatorId: creator.id,
        amount: payoutAmountAfterDebt, // Amount after debt deduction
        amountPaid: stripeCurrency !== 'EUR' ? payoutAmountInStripeCurrency * (payoutAmountAfterDebt / payoutAmountEur) : null,
        currency: stripeCurrency,
        conversionRate: conversionRate,
        conversionDate: conversionDate,
        status: PayoutStatus.PENDING_APPROVAL, // ✅ Wait for admin approval
      },
    });

    // Log payout request creation
    await logPayout(TransactionEventType.PAYOUT_CREATED, {
      payoutId: payout.id,
      creatorId: creator.id,
      amount: payoutAmountEur,
      currency: 'EUR',
      status: PayoutStatus.PENDING_APPROVAL,
      metadata: {
        availableBalance,
        requestedAmount: requestedAmount || null,
        fromStripeBalance: true,
        stripeCurrency: stripeCurrency,
        amountInStripeCurrency: payoutAmountInStripeCurrency,
        conversionRate: conversionRate,
        currencyConverted: stripeCurrency !== 'EUR',
        awaitingAdminApproval: true,
      },
    });

    // Create audit log entry
    await prisma.payoutAuditLog.create({
      data: {
        creatorId: creator.id,
        action: 'TRIGGERED',
        amount: payoutAmountEur,
        status: PayoutStatus.PENDING_APPROVAL,
        adminId: isAdmin ? jwtUser.userId : null,
        reason: stripeCurrency !== 'EUR'
          ? `Demande de paiement de ${payoutAmountEur.toFixed(2)} EUR (${payoutAmountInStripeCurrency.toFixed(2)} ${stripeCurrency}) en attente d'approbation`
          : requestedAmount
            ? `Demande de paiement de ${payoutAmountEur.toFixed(2)} EUR en attente d'approbation`
            : `Demande de paiement complet de ${payoutAmountEur.toFixed(2)} EUR en attente d'approbation`,
        metadata: JSON.stringify({
          availableBalance,
          requestedAmount: requestedAmount || null,
          stripeCurrency: stripeCurrency,
          amountInStripeCurrency: payoutAmountInStripeCurrency,
          conversionRate: conversionRate,
          currencyConverted: stripeCurrency !== 'EUR',
          awaitingAdminApproval: true,
        }),
      },
    });

    // ✅ NEW: Send notification to admins (in-app + email)
    try {
      console.log('[Payout] Notifying admins of new payout request...');
      
      // Find all admin users
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, name: true, email: true },
      });

      console.log(`[Payout] Found ${admins.length} admin(s) to notify`);

      // Send notification to each admin
      for (const admin of admins) {
        // Create in-app notification
        try {
          await createNotification({
            userId: admin.id,
            type: 'SYSTEM',
            title: '💰 Nouvelle demande de paiement',
            message: `${creator.user.name} a demandé un paiement de ${payoutAmountEur.toFixed(2)} EUR. Veuillez approuver ou rejeter la demande.`,
            link: '/dashboard/admin/payouts',
          });
          console.log(`[Payout] In-app notification sent to admin ${admin.id}`);
        } catch (notifError) {
          console.error(`[Payout] Error creating in-app notification for admin ${admin.id}:`, notifError);
        }

        // Send email notification
        try {
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Nouvelle demande de paiement</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                      <!-- Header -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                          <h1 style="margin: 0; color: #ffffff; font-size: 28px;">💰 Nouvelle demande de paiement</h1>
                        </td>
                      </tr>
                      
                      <!-- Content -->
                      <tr>
                        <td style="padding: 40px 30px;">
                          <p style="margin: 0 0 20px; font-size: 16px; color: #333333;">Bonjour ${admin.name || 'Admin'},</p>
                          
                          <p style="margin: 0 0 30px; font-size: 16px; color: #333333;">
                            Un créateur a demandé un paiement. Veuillez vérifier et approuver ou rejeter cette demande.
                          </p>
                          
                          <!-- Payout Details Box -->
                          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                            <tr>
                              <td style="padding: 20px;">
                                <h2 style="margin: 0 0 15px; font-size: 20px; color: #667eea;">Détails de la demande</h2>
                                
                                <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">
                                  <strong>👤 Créateur :</strong> ${creator.user.name}<br>
                                  <small>${creator.user.email}</small>
                                </p>
                                
                                <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">
                                  <strong>💰 Montant :</strong> <span style="color: #22c55e; font-size: 18px; font-weight: bold;">${payoutAmountEur.toFixed(2)} EUR</span>
                                </p>
                                
                                ${stripeCurrency !== 'EUR' ? `
                                <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">
                                  <strong>💱 Montant converti :</strong> ${payoutAmountInStripeCurrency.toFixed(2)} ${stripeCurrency}
                                </p>
                                ` : ''}
                                
                                <p style="margin: 0; font-size: 14px; color: #666666;">
                                  <strong>📅 Date de demande :</strong> ${new Date().toLocaleString('fr-FR')}
                                </p>
                              </td>
                            </tr>
                          </table>
                          
                          <!-- CTA Button -->
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td align="center" style="padding: 20px 0;">
                                <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://callastar.fr'}/dashboard/admin/payouts" 
                                   style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                                  Gérer la demande
                                </a>
                              </td>
                            </tr>
                          </table>
                          
                          <p style="margin: 20px 0 0; font-size: 14px; color: #999999; text-align: center;">
                            Veuillez traiter cette demande rapidement pour garantir une bonne expérience créateur.
                          </p>
                        </td>
                      </tr>
                      
                      <!-- Footer -->
                      <tr>
                        <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center;">
                          <p style="margin: 0; font-size: 12px; color: #999999;">
                            Call a Star - Administration<br>
                            Cet email a été envoyé automatiquement depuis le système de paiements.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `;

          await sendEmail({
            to: admin.email,
            subject: `💰 Nouvelle demande de paiement - ${creator.user.name} (${payoutAmountEur.toFixed(2)} EUR)`,
            html: emailHtml,
          });
          console.log(`[Payout] Email notification sent to admin ${admin.email}`);
        } catch (emailError) {
          console.error(`[Payout] Error sending email to admin ${admin.email}:`, emailError);
          // Don't block the payout creation if email fails
        }
      }

      console.log('[Payout] Admin notifications completed');
    } catch (error) {
      console.error('[Payout] Error sending admin notifications:', error);
      // Non-critical error, continue with payout creation
    }

    // Build response message
    let responseMessage = '';
    if (debtDeducted > 0) {
      responseMessage = `Demande de paiement envoyée. Montant demandé: ${payoutAmountEur.toFixed(2)} EUR. Dette déduite: ${debtDeducted.toFixed(2)} EUR. Montant final: ${payoutAmountAfterDebt.toFixed(2)} EUR. En attente d'approbation par l'administrateur.`;
    } else {
      responseMessage = stripeCurrency !== 'EUR'
        ? `Demande de paiement de ${payoutAmountEur.toFixed(2)} EUR (≈ ${payoutAmountInStripeCurrency.toFixed(2)} ${stripeCurrency}) envoyée. En attente d'approbation par l'administrateur.`
        : `Demande de paiement de ${payoutAmountEur.toFixed(2)} EUR envoyée. En attente d'approbation par l'administrateur.`;
    }

    return NextResponse.json({
      success: true,
      message: responseMessage,
      payout: {
        id: payout.id,
        amountRequested: payoutAmountEur,
        amountEur: payoutAmountAfterDebt,
        amountPaid: stripeCurrency !== 'EUR' ? payoutAmountInStripeCurrency * (payoutAmountAfterDebt / payoutAmountEur) : payoutAmountAfterDebt,
        currency: stripeCurrency,
        conversionRate: conversionRate,
        status: 'pending_approval',
        debtDeducted: debtDeducted > 0 ? debtDeducted : undefined,
        debtDeductions: debtDeductions.length > 0 ? debtDeductions : undefined,
      },
    });
  } catch (error) {
    console.error('Error requesting payout:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la demande de paiement' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/db';
import { verifyWebhookSignature, calculatePayoutReleaseDate } from '@/lib/stripe';
import { getStripeAccountStatus } from '@/lib/stripe-account-validator';
import { createDailyRoom } from '@/lib/daily';
import { sendEmail, generateBookingConfirmationEmail } from '@/lib/email';
import { createNotification } from '@/lib/notifications';
import { logWebhook, logPayment, logPayout, logRefund, logDispute } from '@/lib/logger';
import { TransactionEventType, EntityType, RefundStatus, PaymentStatus, PayoutStatus } from '@prisma/client';
import Stripe from 'stripe';

/**
 * POST /api/payments/webhook
 * Comprehensive Stripe webhook handler
 * 
 * Handles all critical Stripe events with idempotency and proper logging
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not defined');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(body, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Check idempotency - have we already processed this event?
    const existingLog = await prisma.transactionLog.findFirst({
      where: { stripeEventId: event.id },
    });

    if (existingLog) {
      console.log(`[Webhook] Event ${event.id} already processed. Skipping.`);
      return NextResponse.json({ received: true, skipped: true }, { status: 200 });
    }

    // ✅ FIX: Enhanced webhook logging for debugging
    const timestamp = new Date().toISOString();
    console.log(`[Webhook] ============================================`);
    console.log(`[Webhook] Received at: ${timestamp}`);
    console.log(`[Webhook] Event Type: ${event.type}`);
    console.log(`[Webhook] Event ID: ${event.id}`);
    console.log(`[Webhook] Livemode: ${event.livemode}`);
    console.log(`[Webhook] API Version: ${event.api_version}`);
    console.log(`[Webhook] Object Type: ${event.data.object.object}`);
    
    // Log relevant object data based on event type
    if (event.type.startsWith('account.')) {
      const account = event.data.object as any;
      console.log(`[Webhook] Account ID: ${account.id}`);
      console.log(`[Webhook] Charges Enabled: ${account.charges_enabled}`);
      console.log(`[Webhook] Payouts Enabled: ${account.payouts_enabled}`);
      console.log(`[Webhook] Details Submitted: ${account.details_submitted}`);
      if (account.requirements) {
        console.log(`[Webhook] Currently Due: ${JSON.stringify(account.requirements.currently_due)}`);
        console.log(`[Webhook] Past Due: ${JSON.stringify(account.requirements.past_due)}`);
      }
    }
    console.log(`[Webhook] ============================================`);

    // Process webhook event
    console.log(`[Webhook] Processing event: ${event.type} (${event.id})`);

    try {
      await processWebhookEvent(event);
    } catch (processingError) {
      // Log the error but return 200 to prevent Stripe retries for non-retryable errors
      console.error(`[Webhook] Error processing event ${event.type}:`, processingError);
      console.error(`[Webhook] Error stack:`, processingError instanceof Error ? processingError.stack : 'No stack trace');
      
      // Log the error to database
      await logWebhook({
        stripeEventId: event.id,
        eventType: event.type,
        entityType: EntityType.PAYMENT,
        metadata: { event: event.data.object },
        errorMessage: processingError instanceof Error ? processingError.message : String(processingError),
      });
    }

    // Handle payout.created event
    if (event.type === 'payout.created') {
      const payout = event.data.object as any;
      const creatorId = payout.metadata?.creatorId;

      if (creatorId) {
        console.log('Payout created:', {
          payoutId: payout.id,
          creatorId,
          amount: payout.amount / 100,
          status: payout.status,
        });

        // Update audit log if exists
        await prisma.payoutAuditLog.updateMany({
          where: {
            creatorId,
            stripePayoutId: payout.id,
          },
          data: {
            status: 'PROCESSING',
            metadata: JSON.stringify({
              stripeStatus: payout.status,
              arrivalDate: new Date(payout.arrival_date * 1000),
              updatedAt: new Date().toISOString(),
            }),
          },
        });
      }
    }

    // Handle payout.paid event
    if (event.type === 'payout.paid') {
      const payout = event.data.object as any;
      const creatorId = payout.metadata?.creatorId;

      if (creatorId) {
        console.log('Payout paid successfully:', {
          payoutId: payout.id,
          creatorId,
          amount: payout.amount / 100,
        });

        // Update audit log status to COMPLETED
        const updatedLogs = await prisma.payoutAuditLog.updateMany({
          where: {
            creatorId,
            stripePayoutId: payout.id,
          },
          data: {
            status: 'PAID',
            metadata: JSON.stringify({
              stripeStatus: payout.status,
              arrivalDate: new Date(payout.arrival_date * 1000),
              paidAt: new Date().toISOString(),
            }),
          },
        });

        // Send notification to creator
        try {
          const creator = await prisma.creator.findUnique({
            where: { id: creatorId },
            include: { user: true },
          });

          if (creator) {
            await createNotification({
              userId: creator.userId,
              type: 'PAYOUT_COMPLETED',
              title: 'Paiement effectué',
              message: `Un paiement de ${(payout.amount / 100).toFixed(2)} € a été transféré sur votre compte bancaire.`,
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
                      <h1>💰 Paiement effectué</h1>
                    </div>
                    <div class="content">
                      <p>Bonjour ${creator.user.name},</p>
                      <p>Votre paiement a été transféré avec succès sur votre compte bancaire.</p>
                      <div class="amount">${(payout.amount / 100).toFixed(2)} €</div>
                      <p>Les fonds devraient apparaître sur votre compte dans les prochains jours ouvrables.</p>
                      <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
                        Merci d'utiliser Call a Star !
                      </p>
                    </div>
                  </div>
                </body>
              </html>
            `;

            await sendEmail({
              to: creator.user.email,
              subject: '💰 Paiement effectué - Call a Star',
              html: emailHtml,
            });
          }
        } catch (error) {
          console.error('Error sending payout notification:', error);
        }
      }
    }

    // Handle payout.failed event
    if (event.type === 'payout.failed') {
      const payout = event.data.object as any;
      const creatorId = payout.metadata?.creatorId;

      if (creatorId) {
        console.error('Payout failed:', {
          payoutId: payout.id,
          creatorId,
          amount: payout.amount / 100,
          failureCode: payout.failure_code,
          failureMessage: payout.failure_message,
        });

        // Update audit log status to FAILED
        await prisma.payoutAuditLog.updateMany({
          where: {
            creatorId,
            stripePayoutId: payout.id,
          },
          data: {
            status: 'FAILED',
            reason: `Échec du paiement: ${payout.failure_message || payout.failure_code || 'Raison inconnue'}`,
            metadata: JSON.stringify({
              stripeStatus: payout.status,
              failureCode: payout.failure_code,
              failureMessage: payout.failure_message,
              failedAt: new Date().toISOString(),
            }),
          },
        });

        // Send notification to creator
        try {
          const creator = await prisma.creator.findUnique({
            where: { id: creatorId },
            include: { user: true },
          });

          if (creator) {
            await createNotification({
              userId: creator.userId,
              type: 'SYSTEM',
              title: 'Échec du paiement',
              message: `Le paiement de ${(payout.amount / 100).toFixed(2)} € a échoué. Veuillez vérifier vos informations bancaires.`,
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
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>⚠️ Échec du paiement</h1>
                    </div>
                    <div class="content">
                      <p>Bonjour ${creator.user.name},</p>
                      <p>Nous n'avons pas pu effectuer le transfert de <strong>${(payout.amount / 100).toFixed(2)} €</strong> sur votre compte bancaire.</p>
                      <div class="alert">
                        <strong>Raison:</strong> ${payout.failure_message || 'Veuillez vérifier vos informations bancaires'}
                      </div>
                      <p>Veuillez vérifier vos informations bancaires dans votre compte Stripe et réessayer.</p>
                      <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
                        Si le problème persiste, contactez le support.
                      </p>
                    </div>
                  </div>
                </body>
              </html>
            `;

            await sendEmail({
              to: creator.user.email,
              subject: '⚠️ Échec du paiement - Call a Star',
              html: emailHtml,
            });
          }
        } catch (error) {
          console.error('Error sending payout failure notification:', error);
        }
      }
    }

    // Handle account.updated event
    if (event.type === 'account.updated') {
      const account = event.data.object as any;
      
      // Find creator with this Stripe account
      const creator = await prisma.creator.findFirst({
        where: { stripeAccountId: account.id },
      });

      if (creator) {
        console.log('Stripe account updated:', {
          accountId: account.id,
          creatorId: creator.id,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
        });

        // ✅ FIX: Use comprehensive validation instead of simplified check
        const accountStatus = await getStripeAccountStatus(account.id);
        const isOnboarded = accountStatus.isFullyOnboarded;
        
        await prisma.creator.update({
          where: { id: creator.id },
          data: {
            isStripeOnboarded: isOnboarded,
          },
        });

        // If payouts were just enabled, send notification
        if (account.payouts_enabled && !creator.isStripeOnboarded && isOnboarded) {
          try {
            const creatorWithUser = await prisma.creator.findUnique({
              where: { id: creator.id },
              include: { user: true },
            });

            if (creatorWithUser) {
              await createNotification({
                userId: creatorWithUser.userId,
                type: 'SYSTEM',
                title: 'Compte Stripe activé',
                message: 'Votre compte Stripe est maintenant complètement configuré et vous pouvez recevoir des paiements.',
                link: '/dashboard/creator',
              });
            }
          } catch (error) {
            console.error('Error sending account activation notification:', error);
          }
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Webhook] Fatal error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}

/**
 * Process webhook event based on type
 */
async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event);
      break;

    case 'charge.refunded':
      await handleChargeRefunded(event);
      break;

    case 'charge.dispute.created':
      await handleDisputeCreated(event);
      break;

    case 'charge.dispute.closed':
      await handleDisputeClosed(event);
      break;

    case 'charge.dispute.funds_withdrawn':
      await handleDisputeFundsWithdrawn(event);
      break;

    case 'charge.dispute.funds_reinstated':
      await handleDisputeFundsReinstated(event);
      break;

    case 'payout.paid':
      await handlePayoutPaid(event);
      break;

    case 'payout.failed':
      await handlePayoutFailed(event);
      break;

    case 'transfer.reversed':
      await handleTransferReversed(event);
      break;

    case 'account.updated':
      await handleAccountUpdated(event);
      break;

    case 'capability.updated':
      await handleCapabilityUpdated(event);
      break;

    case 'account.application.authorized':
      await handleAccountApplicationAuthorized(event);
      break;

    case 'account.application.deauthorized':
      await handleAccountApplicationDeauthorized(event);
      break;

    default:
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
  }
}

/**
 * Handle payment_intent.succeeded
 */
async function handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId) {
    console.error('[Webhook] No bookingId in payment intent metadata');
    return;
  }

  // Get booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      callOffer: {
        include: {
          creator: {
            include: {
              user: true,
            },
          },
        },
      },
      user: true,
    },
  });

  if (!booking) {
    console.error('[Webhook] Booking not found:', bookingId);
    return;
  }

  // Create Daily.co room
  const roomName = `call-${bookingId}`;
  try {
    const room = await createDailyRoom({
      name: roomName,
      properties: {
        exp: Math.floor(new Date(booking.callOffer.dateTime).getTime() / 1000) + 60 * 60 * 24,
        max_participants: 2,
      },
    });

    // Update booking with room info and status
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        dailyRoomUrl: room.url,
        dailyRoomName: room.name,
      },
    });
  } catch (error) {
    console.error('[Webhook] Error creating Daily room:', error);
  }

  // Create or update payment record
  const amount = Number(booking.totalPrice);
  const platformFee = Number(paymentIntent.metadata?.platformFee || 0);
  const creatorAmount = Number(paymentIntent.metadata?.creatorAmount || 0);
  
  const paymentDate = new Date();
  const payoutReleaseDate = calculatePayoutReleaseDate(paymentDate);

  const payment = await prisma.payment.upsert({
    where: { bookingId: booking.id },
    update: {
      status: 'SUCCEEDED',
    },
    create: {
      bookingId: booking.id,
      amount,
      stripePaymentIntentId: paymentIntent.id,
      status: 'SUCCEEDED',
      platformFee,
      creatorAmount,
      payoutStatus: 'HELD',
      payoutReleaseDate,
    },
  });

  // Log payment success
  await logPayment(TransactionEventType.PAYMENT_SUCCEEDED, {
    paymentId: payment.id,
    amount,
    currency: 'EUR',
    status: 'SUCCEEDED',
    stripePaymentIntentId: paymentIntent.id,
    metadata: {
      bookingId: booking.id,
      creatorId: booking.callOffer.creatorId,
    },
  });

  // Log webhook received
  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.PAYMENT,
    entityId: payment.id,
    metadata: { paymentIntentId: paymentIntent.id },
  });

  // Send confirmation emails
  try {
    const callUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/call/${booking.id}`;
    
    const emailHtml = generateBookingConfirmationEmail({
      userName: booking.user.name,
      creatorName: booking.callOffer.creator.user.name,
      callTitle: booking.callOffer.title,
      callDateTime: booking.callOffer.dateTime,
      callDuration: booking.callOffer.duration,
      totalPrice: amount,
      callUrl,
    });

    await sendEmail({
      to: booking.user.email,
      subject: '✨ Confirmation de réservation - Call a Star',
      html: emailHtml,
    });

    // Send receipt
    const receiptHtml = generateReceiptEmail(booking, amount);
    await sendEmail({
      to: booking.user.email,
      subject: '💳 Reçu de paiement - Call a Star',
      html: receiptHtml,
    });
  } catch (error) {
    console.error('[Webhook] Error sending emails to user:', error);
  }

  // Send notification to creator
  try {
    await createNotification({
      userId: booking.callOffer.creator.userId,
      type: 'BOOKING_CONFIRMED',
      title: 'Nouvelle réservation !',
      message: `${booking.user.name} a réservé votre appel "${booking.callOffer.title}".`,
      link: `/dashboard/creator`,
    });

    const creatorEmailHtml = generateCreatorNotificationEmail(booking, creatorAmount, payoutReleaseDate);
    await sendEmail({
      to: booking.callOffer.creator.user.email,
      subject: '🎉 Nouvelle réservation - Call a Star',
      html: creatorEmailHtml,
    });
  } catch (error) {
    console.error('[Webhook] Error sending notifications to creator:', error);
  }
}

/**
 * Handle payment_intent.payment_failed
 */
async function handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId) {
    console.error('[Webhook] No bookingId in payment intent metadata');
    return;
  }

  const payment = await prisma.payment.findUnique({
    where: { bookingId },
  });

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });

    await logPayment(TransactionEventType.PAYMENT_FAILED, {
      paymentId: payment.id,
      amount: Number(payment.amount),
      currency: 'EUR',
      status: 'FAILED',
      stripePaymentIntentId: paymentIntent.id,
      errorMessage: paymentIntent.last_payment_error?.message || 'Payment failed',
    });
  }

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.PAYMENT,
    entityId: payment?.id || bookingId,
    metadata: { paymentIntentId: paymentIntent.id },
    errorMessage: paymentIntent.last_payment_error?.message || 'Payment failed',
  });
}

/**
 * Handle charge.refunded
 */
async function handleChargeRefunded(event: Stripe.Event): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  
  // Get the refund objects from the charge
  const refunds = charge.refunds?.data || [];
  
  for (const stripeRefund of refunds) {
    // Find refund by Stripe refund ID
    const refund = await prisma.refund.findUnique({
      where: { stripeRefundId: stripeRefund.id },
    });

    if (!refund) {
      console.warn('[Webhook] Refund not found for Stripe refund:', stripeRefund.id);
      continue;
    }

    // Update refund status
    await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: RefundStatus.SUCCEEDED,
        updatedAt: new Date(),
      },
    });

    // Update payment refundedAmount
    const payment = await prisma.payment.findUnique({
      where: { id: refund.paymentId },
    });

    if (payment) {
      const newRefundedAmount = Number(payment.refundedAmount) + Number(refund.amount);
      const isFullyRefunded = newRefundedAmount >= Number(payment.amount);

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmount: newRefundedAmount,
          status: isFullyRefunded ? 'FAILED' : payment.status, // Mark as failed if fully refunded
        },
      });

      // Log refund success
      await logRefund(TransactionEventType.REFUND_SUCCEEDED, {
        refundId: refund.id,
        paymentId: refund.paymentId,
        amount: Number(refund.amount),
        currency: refund.currency,
        status: RefundStatus.SUCCEEDED,
        stripeRefundId: stripeRefund.id,
        metadata: {
          isFullyRefunded,
          newRefundedAmount,
        },
      });
    }
  }

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.REFUND,
    metadata: { chargeId: charge.id },
  });
}

/**
 * Handle charge.dispute.created
 */
async function handleDisputeCreated(event: Stripe.Event): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;
  
  // Find payment by charge ID
  const payment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: dispute.payment_intent as string },
  });

  if (!payment) {
    console.error('[Webhook] Payment not found for dispute:', dispute.id);
    return;
  }

  // Create dispute record
  const createdDispute = await prisma.dispute.create({
    data: {
      paymentId: payment.id,
      stripeDisputeId: dispute.id,
      amount: dispute.amount / 100, // Convert from cents
      currency: dispute.currency.toUpperCase(),
      reason: dispute.reason,
      status: 'NEEDS_RESPONSE',
      evidenceDetails: dispute.evidence_details as any,
    },
  });

  // Update payment dispute status
  await prisma.payment.update({
    where: { id: payment.id },
    data: { disputeStatus: 'NEEDS_RESPONSE' },
  });

  // Log dispute
  await logDispute(TransactionEventType.DISPUTE_CREATED, {
    disputeId: createdDispute.id,
    paymentId: payment.id,
    amount: Number(createdDispute.amount),
    currency: createdDispute.currency,
    status: 'NEEDS_RESPONSE',
    stripeDisputeId: dispute.id,
    reason: dispute.reason,
  });

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.DISPUTE,
    entityId: createdDispute.id,
    metadata: { disputeId: dispute.id },
  });

  // TODO: Send critical alert to admin about dispute
  console.error('[CRITICAL] Dispute created:', {
    disputeId: createdDispute.id,
    paymentId: payment.id,
    amount: createdDispute.amount,
    reason: dispute.reason,
  });
}

/**
 * Handle charge.dispute.closed
 */
async function handleDisputeClosed(event: Stripe.Event): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;
  
  const existingDispute = await prisma.dispute.findUnique({
    where: { stripeDisputeId: dispute.id },
  });

  if (!existingDispute) {
    console.warn('[Webhook] Dispute not found:', dispute.id);
    return;
  }

  const status = dispute.status === 'won' ? 'WON' : 'LOST';

  await prisma.dispute.update({
    where: { id: existingDispute.id },
    data: {
      status: status as any,
      evidenceDetails: dispute.evidence_details as any,
    },
  });

  await prisma.payment.update({
    where: { id: existingDispute.paymentId },
    data: { disputeStatus: status },
  });

  await logDispute(TransactionEventType.DISPUTE_CLOSED, {
    disputeId: existingDispute.id,
    paymentId: existingDispute.paymentId,
    amount: Number(existingDispute.amount),
    currency: existingDispute.currency,
    status,
    stripeDisputeId: dispute.id,
  });

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.DISPUTE,
    entityId: existingDispute.id,
    metadata: { disputeId: dispute.id, status },
  });
}

/**
 * Handle charge.dispute.funds_withdrawn
 */
async function handleDisputeFundsWithdrawn(event: Stripe.Event): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;
  
  const existingDispute = await prisma.dispute.findUnique({
    where: { stripeDisputeId: dispute.id },
  });

  if (!existingDispute) {
    console.warn('[Webhook] Dispute not found:', dispute.id);
    return;
  }

  await prisma.dispute.update({
    where: { id: existingDispute.id },
    data: { status: 'UNDER_REVIEW' },
  });

  await logDispute(TransactionEventType.DISPUTE_UPDATED, {
    disputeId: existingDispute.id,
    paymentId: existingDispute.paymentId,
    amount: Number(existingDispute.amount),
    currency: existingDispute.currency,
    status: 'FUNDS_WITHDRAWN',
    stripeDisputeId: dispute.id,
    metadata: { action: 'funds_withdrawn' },
  });

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.DISPUTE,
    entityId: existingDispute.id,
  });
}

/**
 * Handle charge.dispute.funds_reinstated
 */
async function handleDisputeFundsReinstated(event: Stripe.Event): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;
  
  const existingDispute = await prisma.dispute.findUnique({
    where: { stripeDisputeId: dispute.id },
  });

  if (!existingDispute) {
    console.warn('[Webhook] Dispute not found:', dispute.id);
    return;
  }

  await prisma.dispute.update({
    where: { id: existingDispute.id },
    data: { status: 'WON' },
  });

  await prisma.payment.update({
    where: { id: existingDispute.paymentId },
    data: { disputeStatus: 'WON' },
  });

  await logDispute(TransactionEventType.DISPUTE_CLOSED, {
    disputeId: existingDispute.id,
    paymentId: existingDispute.paymentId,
    amount: Number(existingDispute.amount),
    currency: existingDispute.currency,
    status: 'WON',
    stripeDisputeId: dispute.id,
    metadata: { action: 'funds_reinstated' },
  });

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.DISPUTE,
    entityId: existingDispute.id,
  });
}

/**
 * Handle payout.paid
 * 
 * When a payout is paid, update the status and notify the creator
 */
async function handlePayoutPaid(event: Stripe.Event): Promise<void> {
  const stripePayout = event.data.object as Stripe.Payout;
  
  // Find payout by Stripe payout ID
  const payout = await prisma.payout.findFirst({
    where: { stripePayoutId: stripePayout.id },
  });

  if (!payout) {
    // If not found by stripe payout ID, check if it's from metadata
    const creatorId = stripePayout.metadata?.creatorId;
    
    if (creatorId) {
      console.log('[Webhook] Payout paid but not found in DB. Creating record:', stripePayout.id);
      
      // Create payout record from webhook
      const newPayout = await prisma.payout.create({
        data: {
          creatorId,
          amount: stripePayout.amount / 100,
          stripePayoutId: stripePayout.id,
          status: PayoutStatus.PAID,
        },
      });

      // Log the payout
      await logPayout(TransactionEventType.PAYOUT_PAID, {
        payoutId: newPayout.id,
        creatorId,
        amount: stripePayout.amount / 100,
        status: PayoutStatus.PAID,
        stripePayoutId: stripePayout.id,
      });

      // Create audit log
      await prisma.payoutAuditLog.create({
        data: {
          creatorId,
          action: 'COMPLETED',
          amount: stripePayout.amount / 100,
          status: PayoutStatus.PAID,
          stripePayoutId: stripePayout.id,
          reason: 'Paiement confirmé par Stripe webhook',
        },
      });

      // Send notification
      const creator = await prisma.creator.findUnique({
        where: { id: creatorId },
        include: { user: true },
      });

      if (creator) {
        await createNotification({
          userId: creator.userId,
          type: 'PAYOUT_COMPLETED',
          title: 'Paiement effectué',
          message: `Votre paiement de ${(stripePayout.amount / 100).toFixed(2)} EUR a été transféré avec succès.`,
          link: '/dashboard/creator/payouts',
        });
      }
    } else {
      console.warn('[Webhook] Payout paid but not found and no creatorId in metadata:', stripePayout.id);
    }
    
    return;
  }

  // Update existing payout
  await prisma.payout.update({
    where: { id: payout.id },
    data: {
      status: PayoutStatus.PAID,
      updatedAt: new Date(),
    },
  });

  await logPayout(TransactionEventType.PAYOUT_PAID, {
    payoutId: payout.id,
    creatorId: payout.creatorId,
    amount: Number(payout.amount),
    status: PayoutStatus.PAID,
    stripePayoutId: stripePayout.id,
  });

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.PAYOUT,
    entityId: payout.id,
    metadata: { stripePayoutId: stripePayout.id },
  });

  // Create audit log
  await prisma.payoutAuditLog.create({
    data: {
      creatorId: payout.creatorId,
      action: 'COMPLETED',
      amount: Number(payout.amount),
      status: PayoutStatus.PAID,
      stripePayoutId: stripePayout.id,
      reason: 'Paiement confirmé par Stripe',
    },
  });

  // Send notification to creator
  try {
    const creator = await prisma.creator.findUnique({
      where: { id: payout.creatorId },
      include: { user: true },
    });

    if (creator) {
      await createNotification({
        userId: creator.userId,
        type: 'PAYOUT_COMPLETED',
        title: 'Paiement effectué',
        message: `Votre paiement de ${Number(payout.amount).toFixed(2)} EUR a été transféré avec succès.`,
        link: '/dashboard/creator/payouts',
      });
    }
  } catch (error) {
    console.error('[Webhook] Error sending payout notification:', error);
  }
}

/**
 * Handle payout.failed
 */
async function handlePayoutFailed(event: Stripe.Event): Promise<void> {
  const stripePayout = event.data.object as Stripe.Payout;
  
  const payout = await prisma.payout.findFirst({
    where: { stripePayoutId: stripePayout.id },
  });

  if (!payout) {
    console.warn('[Webhook] Payout not found:', stripePayout.id);
    return;
  }

  const failureReason = stripePayout.failure_message || stripePayout.failure_code || 'Payout failed';

  await prisma.payout.update({
    where: { id: payout.id },
    data: {
      status: PayoutStatus.FAILED,
      failureReason,
      retriedCount: payout.retriedCount + 1,
      updatedAt: new Date(),
    },
  });

  await logPayout(TransactionEventType.PAYOUT_FAILED, {
    payoutId: payout.id,
    creatorId: payout.creatorId,
    amount: Number(payout.amount),
    status: PayoutStatus.FAILED,
    stripePayoutId: stripePayout.id,
    errorMessage: failureReason,
  });

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.PAYOUT,
    entityId: payout.id,
    metadata: { stripePayoutId: stripePayout.id },
    errorMessage: failureReason,
  });

  // Create audit log for failed payout
  await prisma.payoutAuditLog.create({
    data: {
      creatorId: payout.creatorId,
      action: 'FAILED',
      amount: Number(payout.amount),
      status: PayoutStatus.FAILED,
      stripePayoutId: stripePayout.id,
      reason: `Échec du paiement: ${failureReason}`,
      metadata: JSON.stringify({
        failureCode: stripePayout.failure_code,
        failureMessage: stripePayout.failure_message,
        failureBalanceTransaction: stripePayout.failure_balance_transaction,
      }),
    },
  });

  // Send notification to creator
  try {
    const creator = await prisma.creator.findUnique({
      where: { id: payout.creatorId },
      include: { user: true },
    });

    if (creator) {
      await createNotification({
        userId: creator.userId,
        type: 'SYSTEM',
        title: 'Échec du paiement',
        message: `Le paiement de ${Number(payout.amount).toFixed(2)} EUR a échoué. Veuillez vérifier vos informations bancaires.`,
        link: '/dashboard/creator/payment-setup',
      });
    }
  } catch (error) {
    console.error('[Webhook] Error sending payout failure notification:', error);
  }

  // Log critical error
  console.error('[CRITICAL] Payout failed:', {
    payoutId: payout.id,
    creatorId: payout.creatorId,
    amount: payout.amount,
    reason: failureReason,
    failureCode: stripePayout.failure_code,
  });
}

/**
 * Handle transfer.reversed
 */
async function handleTransferReversed(event: Stripe.Event): Promise<void> {
  const transfer = event.data.object as Stripe.Transfer;
  
  // Try to find related payment by transfer ID
  const payment = await prisma.payment.findFirst({
    where: { stripeTransferId: transfer.id },
  });

  if (payment) {
    // Revert payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        payoutStatus: 'HELD',
        stripeTransferId: null,
        payoutDate: null,
      },
    });

    await logPayment(TransactionEventType.TRANSFER_FAILED, {
      paymentId: payment.id,
      amount: Number(payment.amount),
      currency: 'EUR',
      status: 'REVERSED',
      metadata: {
        transferId: transfer.id,
        reversalReason: transfer.reversed ? 'Transfer was reversed' : undefined,
      },
    });
  }

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.TRANSFER,
    entityId: payment?.id || transfer.id,
    metadata: { transferId: transfer.id },
  });

  console.error('[CRITICAL] Transfer reversed:', {
    transferId: transfer.id,
    amount: transfer.amount / 100,
  });
}

/**
 * Handle account.updated
 * Enhanced to auto-block payouts when KYC requirements are pending
 * ✅ FIX: Use comprehensive validation for consistent status checks
 */
async function handleAccountUpdated(event: Stripe.Event): Promise<void> {
  const account = event.data.object as Stripe.Account;
  
  const creator = await prisma.creator.findFirst({
    where: { stripeAccountId: account.id },
  });

  if (!creator) {
    console.warn('[Webhook] Creator not found for account:', account.id);
    return;
  }

  // ✅ FIX: Use comprehensive validator for consistent status determination
  const accountStatus = await getStripeAccountStatus(account.id);
  
  const currentlyDue = accountStatus.requirements.currentlyDue;
  const eventuallyDue = accountStatus.requirements.eventuallyDue;
  const pastDue = accountStatus.requirements.pastDue;

  // Determine if payout should be blocked
  let shouldBlockPayout = false;
  let blockReason: string | null = null;

  if (!accountStatus.payoutsEnabled) {
    shouldBlockPayout = true;
    blockReason = accountStatus.disabledReason || 'Payouts not enabled on Stripe account';
  } else if (currentlyDue.length > 0) {
    shouldBlockPayout = true;
    blockReason = `KYC requirements pending: ${currentlyDue.join(', ')}`;
  } else if (pastDue.length > 0) {
    shouldBlockPayout = true;
    blockReason = `Past due requirements: ${pastDue.join(', ')}`;
  }

  // If previously blocked but now requirements are cleared, unblock
  if (creator.payoutBlocked && !shouldBlockPayout && accountStatus.canReceivePayments && accountStatus.canReceivePayouts) {
    shouldBlockPayout = false;
    blockReason = null;
    console.log('[Webhook] ✅ Auto-unblocking payouts for creator:', creator.id);
  }

  await prisma.creator.update({
    where: { id: creator.id },
    data: {
      isStripeOnboarded: accountStatus.isFullyOnboarded,
      payoutBlocked: shouldBlockPayout,
      payoutBlockedReason: blockReason,
    },
  });

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.PAYMENT,
    entityId: creator.id,
    metadata: {
      accountId: account.id,
      chargesEnabled: accountStatus.chargesEnabled,
      payoutsEnabled: accountStatus.payoutsEnabled,
      isFullyOnboarded: accountStatus.isFullyOnboarded,
      disabledReason: accountStatus.disabledReason,
      currentlyDue,
      eventuallyDue,
      pastDue,
      payoutBlocked: shouldBlockPayout,
      payoutBlockedReason: blockReason,
    },
  });

  console.log('[Webhook] Account updated:', {
    creatorId: creator.id,
    chargesEnabled: accountStatus.chargesEnabled,
    payoutsEnabled: accountStatus.payoutsEnabled,
    isFullyOnboarded: accountStatus.isFullyOnboarded,
    payoutBlocked: shouldBlockPayout,
    payoutBlockedReason: blockReason,
    currentlyDue,
  });
}

/**
 * Handle capability.updated
 * When a capability (like transfers or card_payments) changes status
 */
async function handleCapabilityUpdated(event: Stripe.Event): Promise<void> {
  const capability = event.data.object as any;
  
  console.log('[Webhook] Capability updated:', {
    account: capability.account,
    capability: capability.id,
    status: capability.status,
    requirements: capability.requirements,
  });

  // Find creator with this Stripe account
  const creator = await prisma.creator.findFirst({
    where: { stripeAccountId: capability.account },
  });

  if (!creator) {
    console.warn('[Webhook] Creator not found for capability update:', capability.account);
    return;
  }

  // Re-verify account status since capabilities changed
  const accountStatus = await getStripeAccountStatus(capability.account);
  
  await prisma.creator.update({
    where: { id: creator.id },
    data: {
      isStripeOnboarded: accountStatus.isFullyOnboarded,
    },
  });

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.PAYMENT,
    entityId: creator.id,
    metadata: {
      accountId: capability.account,
      capability: capability.id,
      status: capability.status,
      isFullyOnboarded: accountStatus.isFullyOnboarded,
    },
  });

  // If transfers capability is now active, send notification
  if (capability.id === 'transfers' && capability.status === 'active' && accountStatus.isFullyOnboarded) {
    try {
      const creatorWithUser = await prisma.creator.findUnique({
        where: { id: creator.id },
        include: { user: true },
      });

      if (creatorWithUser) {
        await createNotification({
          userId: creatorWithUser.userId,
          type: 'SYSTEM',
          title: '✅ Transferts activés',
          message: 'Votre capacité de transfert est maintenant active. Vous pouvez recevoir des paiements.',
          link: '/dashboard/creator',
        });
      }
    } catch (error) {
      console.error('[Webhook] Error sending capability notification:', error);
    }
  }
}

/**
 * Handle account.application.authorized
 * When a user authorizes the Connect application
 */
async function handleAccountApplicationAuthorized(event: Stripe.Event): Promise<void> {
  const account = event.data.object as any;
  
  console.log('[Webhook] Account application authorized:', {
    account: account.id,
  });

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.PAYMENT,
    metadata: {
      accountId: account.id,
      action: 'authorized',
    },
  });
}

/**
 * Handle account.application.deauthorized
 * When a user deauthorizes the Connect application
 */
async function handleAccountApplicationDeauthorized(event: Stripe.Event): Promise<void> {
  const account = event.data.object as any;
  
  console.log('[Webhook] Account application deauthorized:', {
    account: account.id,
  });

  // Find creator and potentially disable their account
  const creator = await prisma.creator.findFirst({
    where: { stripeAccountId: account.id },
  });

  if (creator) {
    await prisma.creator.update({
      where: { id: creator.id },
      data: {
        isStripeOnboarded: false,
        payoutBlocked: true,
        payoutBlockedReason: 'Application Stripe déconnectée',
      },
    });

    // Send critical notification
    try {
      await createNotification({
        userId: creator.userId,
        type: 'SYSTEM',
        title: '⚠️ Compte Stripe déconnecté',
        message: 'Votre compte Stripe a été déconnecté. Veuillez le reconnecter pour continuer à recevoir des paiements.',
        link: '/dashboard/creator/payment-setup',
      });
    } catch (error) {
      console.error('[Webhook] Error sending deauthorization notification:', error);
    }
  }

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.PAYMENT,
    entityId: creator?.id,
    metadata: {
      accountId: account.id,
      action: 'deauthorized',
    },
  });
}

/**
 * Generate receipt email HTML
 */
function generateReceiptEmail(booking: any, amount: number): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .receipt-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #ddd; }
          .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💳 Reçu de paiement</h1>
          </div>
          <div class="content">
            <p>Bonjour ${booking.user.name},</p>
            <p>Votre paiement a été traité avec succès. Voici le détail de votre transaction :</p>
            
            <div style="margin: 30px 0;">
              <div class="receipt-item">
                <span>Date de paiement:</span>
                <span>${new Date().toLocaleDateString('fr-FR')}</span>
              </div>
              <div class="receipt-item">
                <span>Service:</span>
                <span>${booking.callOffer.title}</span>
              </div>
              <div class="receipt-item">
                <span>Créateur:</span>
                <span>${booking.callOffer.creator.user.name}</span>
              </div>
              <div class="receipt-item">
                <span>Date de l'appel:</span>
                <span>${new Date(booking.callOffer.dateTime).toLocaleDateString('fr-FR', { 
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</span>
              </div>
              <div class="receipt-item total">
                <span>Montant total:</span>
                <span>${amount.toFixed(2)} €</span>
              </div>
            </div>
            
            <p>Ce reçu confirme que votre réservation est bien confirmée. Vous recevrez un rappel avant l'appel.</p>
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
              Merci d'avoir utilisé Call a Star !<br>
              Pour toute question, n'hésitez pas à nous contacter.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate creator notification email HTML
 */
function generateCreatorNotificationEmail(booking: any, creatorAmount: number, payoutReleaseDate: Date): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Nouvelle réservation !</h1>
          </div>
          <div class="content">
            <p>Bonjour ${booking.callOffer.creator.user.name},</p>
            <p>Excellente nouvelle ! Vous avez reçu une nouvelle réservation.</p>
            
            <div class="booking-details">
              <h3 style="margin-top: 0;">Détails de la réservation</h3>
              <div class="detail-row">
                <span><strong>Participant:</strong></span>
                <span>${booking.user.name}</span>
              </div>
              <div class="detail-row">
                <span><strong>Service:</strong></span>
                <span>${booking.callOffer.title}</span>
              </div>
              <div class="detail-row">
                <span><strong>Date et heure:</strong></span>
                <span>${new Date(booking.callOffer.dateTime).toLocaleDateString('fr-FR', { 
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</span>
              </div>
              <div class="detail-row">
                <span><strong>Durée:</strong></span>
                <span>${booking.callOffer.duration} minutes</span>
              </div>
              <div class="detail-row" style="border-bottom: none; font-size: 18px; font-weight: bold; color: #667eea;">
                <span>Montant:</span>
                <span>${creatorAmount.toFixed(2)} €</span>
              </div>
            </div>
            
            <p><strong>💰 Paiement sécurisé:</strong> Le montant de <strong>${creatorAmount.toFixed(2)} €</strong> sera disponible pour transfert le ${payoutReleaseDate.toLocaleDateString('fr-FR')}.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/creator" class="cta-button">
                Voir mes réservations
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

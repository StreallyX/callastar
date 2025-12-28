import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/db';
import { verifyWebhookSignature, calculatePayoutReleaseDate } from '@/lib/stripe';
import { getStripeAccountStatus } from '@/lib/stripe-account-validator';
import { createDailyRoom } from '@/lib/daily';
import { sendEmail, generateBookingConfirmationEmail } from '@/lib/email';
import { createNotification } from '@/lib/notifications';
import { logWebhook, logPayment, logPayout, logRefund, logDispute } from '@/lib/logger';
import { logWebhookEvent } from '@/lib/system-logger';
import { TransactionEventType, EntityType, RefundStatus, PaymentStatus, PayoutStatus } from '@prisma/client';
import { stripeAmountToUnits, formatDbAmount } from '@/lib/currency-utils';
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
      
      // Log successful webhook processing
      await logWebhookEvent('STRIPE', event.type, true, {
        eventId: event.id,
        objectType: event.data.object.object,
      });
    } catch (processingError) {
      // Log the error but return 200 to prevent Stripe retries for non-retryable errors
      console.error(`[Webhook] Error processing event ${event.type}:`, processingError);
      console.error(`[Webhook] Error stack:`, processingError instanceof Error ? processingError.stack : 'No stack trace');
      
      // Log the error to database (TransactionLog)
      await logWebhook({
        stripeEventId: event.id,
        eventType: event.type,
        entityType: EntityType.PAYMENT,
        metadata: { event: event.data.object },
        errorMessage: processingError instanceof Error ? processingError.message : String(processingError),
      });
      
      // Log webhook failure (SystemLog)
      await logWebhookEvent('STRIPE', event.type, false, {
        eventId: event.id,
        objectType: event.data.object.object,
        errorMessage: processingError instanceof Error ? processingError.message : String(processingError),
      });
    }

    // Handle payout.created event
    if (event.type === 'payout.created') {
      const stripePayout = event.data.object as any;
      const creatorId = stripePayout.metadata?.creatorId;

      if (creatorId) {
        // ✅ FIX: stripePayout.amount comes from Stripe API (IN CENTS)
        console.log('Payout created:', {
          payoutId: stripePayout.id,
          creatorId,
          amount: stripeAmountToUnits(stripePayout.amount), // Convert cents to units
          status: stripePayout.status,
        });

        // Update audit log if exists
        await prisma.payoutAuditLog.updateMany({
          where: {
            creatorId,
            stripePayoutId: stripePayout.id,
          },
          data: {
            status: 'PROCESSING',
            metadata: JSON.stringify({
              stripeStatus: stripePayout.status,
              arrivalDate: new Date(stripePayout.arrival_date * 1000),
              updatedAt: new Date().toISOString(),
            }),
          },
        });
      }
    }

    // Handle payout.paid event
    if (event.type === 'payout.paid') {
      const stripePayout = event.data.object as any;
      const creatorId = stripePayout.metadata?.creatorId;

      if (creatorId) {
        // ✅ FIX: stripePayout.amount comes from Stripe API (IN CENTS)
        console.log('Payout paid successfully:', {
          payoutId: stripePayout.id,
          creatorId,
          amount: stripeAmountToUnits(stripePayout.amount), // Convert cents to units
        });

        // Update audit log status to COMPLETED
        const updatedLogs = await prisma.payoutAuditLog.updateMany({
          where: {
            creatorId,
            stripePayoutId: stripePayout.id,
          },
          data: {
            status: 'PAID',
            metadata: JSON.stringify({
              stripeStatus: stripePayout.status,
              arrivalDate: new Date(stripePayout.arrival_date * 1000),
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
            const currency = creator.currency || 'EUR';
            // ✅ FIX: stripePayout.amount from Stripe API (IN CENTS) → convert to units
            const amountInUnits = stripeAmountToUnits(stripePayout.amount);
            
            await createNotification({
              userId: creator.userId,
              type: 'PAYOUT_COMPLETED',
              title: 'Paiement effectué',
              message: `Un paiement de ${amountInUnits.toFixed(2)} ${currency} a été transféré sur votre compte bancaire.`,
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
                      <div class="amount">${amountInUnits.toFixed(2)} ${currency}</div>
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
      const stripePayout = event.data.object as any;
      const creatorId = stripePayout.metadata?.creatorId;

      if (creatorId) {
        // ✅ FIX: stripePayout.amount comes from Stripe API (IN CENTS)
        console.error('Payout failed:', {
          payoutId: stripePayout.id,
          creatorId,
          amount: stripeAmountToUnits(stripePayout.amount), // Convert cents to units
          failureCode: stripePayout.failure_code,
          failureMessage: stripePayout.failure_message,
        });

        // Update audit log status to FAILED
        await prisma.payoutAuditLog.updateMany({
          where: {
            creatorId,
            stripePayoutId: stripePayout.id,
          },
          data: {
            status: 'FAILED',
            reason: `Échec du paiement: ${stripePayout.failure_message || stripePayout.failure_code || 'Raison inconnue'}`,
            metadata: JSON.stringify({
              stripeStatus: stripePayout.status,
              failureCode: stripePayout.failure_code,
              failureMessage: stripePayout.failure_message,
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
            const currency = creator.currency || 'EUR';
            // ✅ FIX: stripePayout.amount from Stripe API (IN CENTS) → convert to units
            const amountInUnits = stripeAmountToUnits(stripePayout.amount);
            
            await createNotification({
              userId: creator.userId,
              type: 'SYSTEM',
              title: 'Échec du paiement',
              message: `Le paiement de ${amountInUnits.toFixed(2)} ${currency} a échoué. Veuillez vérifier vos informations bancaires.`,
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
                      <p>Nous n'avons pas pu effectuer le transfert de <strong>${amountInUnits.toFixed(2)} ${currency}</strong> sur votre compte bancaire.</p>
                      <div class="alert">
                        <strong>Raison:</strong> ${stripePayout.failure_message || 'Veuillez vérifier vos informations bancaires'}
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

    case 'payout.canceled':
      await handlePayoutCanceled(event);
      break;

    case 'transfer.created':
      await handleTransferCreated(event);
      break;

    // Note: transfer.succeeded is not in the Stripe API type, but it exists
    // @ts-ignore
    case 'transfer.succeeded':
      await handleTransferSucceeded(event);
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
            select: {
              id: true,
              userId: true,
              currency: true, // ✅ Include creator's currency
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
  
  // ✅ Get currency from metadata or booking
  const currency = paymentIntent.metadata?.currency || booking.callOffer.creator.currency || 'EUR';

  // ✅ FIX: Always set payoutReleaseDate, even when updating existing payment
  const payment = await prisma.payment.upsert({
    where: { bookingId: booking.id },
    update: {
      status: 'SUCCEEDED',
      currency: currency,
      payoutReleaseDate, // <-- Ensure payoutReleaseDate is set on update too
      payoutStatus: 'REQUESTED',
    },
    create: {
      bookingId: booking.id,
      amount,
      currency: currency,
      stripePaymentIntentId: paymentIntent.id,
      status: 'SUCCEEDED',
      platformFee,
      creatorAmount,
      payoutStatus: 'REQUESTED',
      payoutReleaseDate,
    },
  });

  // ✅ DESTINATION CHARGES: No need to create Transfer manually
  // Stripe handles the transfer automatically via transfer_data in PaymentIntent
  // transferId and transferStatus remain null (Stripe manages the transfer internally)
  
  console.log('✅ Payment successful - Stripe will handle transfer automatically via Destination Charges');
  
  // ✅ Notify creator about received payment
  try {
    const totalAmount = amount;
    
    await createNotification({
      userId: booking.callOffer.creator.userId,
      type: 'PAYMENT_RECEIVED',
      title: 'Paiement reçu',
      message: `Vous avez reçu un paiement de ${totalAmount.toFixed(2)} ${currency}.`,
      link: '/dashboard/creator/payments',
      metadata: {
        paymentId: payment.id,
        bookingId: booking.id,
        amount: totalAmount,
        currency,
      },
    });
  } catch (notifError) {
    console.error('[Webhook] Error sending payment received notification:', notifError);
  }

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
    const currency = booking.callOffer.creator.currency || 'EUR';
    const receiptHtml = generateReceiptEmail(booking, amount, currency);
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

    const currency = booking.callOffer.creator.currency || 'EUR';
    const creatorEmailHtml = generateCreatorNotificationEmail(booking, creatorAmount, payoutReleaseDate, currency);
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
 * ✅ PHASE 1.2: Manage creator debt and Transfer Reversal
 */
async function handleChargeRefunded(event: Stripe.Event): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  
  // Import creator debt functions
  const { 
    calculateCreatorDebt, 
    attemptTransferReversal, 
    markRefundAsReconciled, 
    checkAndBlockPayouts,
    notifyDebt 
  } = await import('@/lib/creator-debt');
  
  // Get the refund objects from the charge
  const refunds = charge.refunds?.data || [];
  
  for (const stripeRefund of refunds) {
    // Find payment by payment intent ID
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: charge.payment_intent as string },
      include: {
        booking: {
          include: {
            callOffer: {
              include: {
                creator: {
                  include: { user: true },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      console.warn('[Webhook] Payment not found for refund:', stripeRefund.id);
      continue;
    }

    // Check if refund already exists
    let refund = await prisma.refund.findUnique({
      where: { stripeRefundId: stripeRefund.id },
    });

    // Calculate creator debt (85% of refund amount)
    const refundAmount = stripeRefund.amount / 100; // Convert cents to units
    const creatorDebt = calculateCreatorDebt(refundAmount);

    console.log('[Webhook] Processing refund:', {
      refundId: stripeRefund.id,
      amount: refundAmount,
      creatorDebt,
      paymentId: payment.id,
      transferId: payment.transferId,
    });

    // Create or update refund record
    if (!refund) {
      refund = await prisma.refund.create({
        data: {
          paymentId: payment.id,
          amount: refundAmount,
          currency: stripeRefund.currency.toUpperCase(),
          reason: stripeRefund.reason || 'Refund requested',
          status: RefundStatus.SUCCEEDED,
          stripeRefundId: stripeRefund.id,
          initiatedById: payment.booking.callOffer.creatorId, // Default to creator
          creatorDebt: creatorDebt,
          reconciled: false,
        },
      });
    } else {
      refund = await prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.SUCCEEDED,
          creatorDebt: creatorDebt,
          updatedAt: new Date(),
        },
      });
    }

    // Update payment refundedAmount
    const newRefundedAmount = Number(payment.refundedAmount) + refundAmount;
    const isFullyRefunded = newRefundedAmount >= Number(payment.amount);

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        refundedAmount: newRefundedAmount,
        status: isFullyRefunded ? 'FAILED' : payment.status,
      },
    });

    // ✅ PHASE 1.2: Attempt Transfer Reversal if transfer exists
    let reconciled = false;
    let reversalId: string | undefined;

    if (payment.transferId) {
      console.log('[Webhook] Attempting transfer reversal for refund...');
      
      const reversalResult = await attemptTransferReversal(
        payment.transferId,
        Math.round(creatorDebt * 100) // Convert to cents
      );

      if (reversalResult.success) {
        console.log('[Webhook] ✅ Transfer reversal successful');
        reconciled = true;
        reversalId = reversalResult.reversalId;

        // Mark refund as reconciled
        await markRefundAsReconciled(refund.id, 'TRANSFER_REVERSAL', reversalId);
      } else {
        console.log('[Webhook] ❌ Transfer reversal failed:', reversalResult.error);
        
        // Transfer reversal failed - record debt for future deduction
        // Check if we should block payouts
        await checkAndBlockPayouts(payment.booking.callOffer.creatorId);
      }
    } else {
      console.warn('[Webhook] ⚠️  No transfer ID found - cannot attempt reversal');
      
      // No transfer to reverse - record debt for future deduction
      await checkAndBlockPayouts(payment.booking.callOffer.creatorId);
    }

    // Notify creator and admin about the debt
    if (!reconciled) {
      await notifyDebt(
        payment.booking.callOffer.creatorId,
        'REFUND',
        refundAmount,
        stripeRefund.reason || 'Refund requested'
      );
    }

    // Log refund success
    await logRefund(TransactionEventType.REFUND_SUCCEEDED, {
      refundId: refund.id,
      paymentId: refund.paymentId,
      amount: refundAmount,
      currency: refund.currency,
      status: RefundStatus.SUCCEEDED,
      stripeRefundId: stripeRefund.id,
      metadata: {
        isFullyRefunded,
        newRefundedAmount,
        creatorDebt,
        reconciled,
        reversalId,
        transferReversalAttempted: !!payment.transferId,
      },
    });

    console.log('[Webhook] Refund processed:', {
      refundId: refund.id,
      reconciled,
      creatorDebt,
    });
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
 * ✅ PHASE 1.2: Manage creator debt for disputes
 */
async function handleDisputeCreated(event: Stripe.Event): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;
  
  // Import creator debt functions
  const { 
    calculateCreatorDebt, 
    checkAndBlockPayouts,
    notifyDebt 
  } = await import('@/lib/creator-debt');
  
  // Find payment by payment intent ID
  const payment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: dispute.payment_intent as string },
    include: {
      booking: {
        include: {
          callOffer: {
            include: {
              creator: {
                include: { user: true },
              },
            },
          },
        },
      },
    },
  });

  if (!payment) {
    console.error('[Webhook] Payment not found for dispute:', dispute.id);
    return;
  }

  // Calculate creator debt (85% of dispute amount)
  const disputeAmount = dispute.amount / 100; // Convert from cents
  const creatorDebt = calculateCreatorDebt(disputeAmount);

  console.log('[Webhook] Dispute created:', {
    disputeId: dispute.id,
    amount: disputeAmount,
    creatorDebt,
    paymentId: payment.id,
    reason: dispute.reason,
  });

  // Create dispute record
  const createdDispute = await prisma.dispute.create({
    data: {
      paymentId: payment.id,
      stripeDisputeId: dispute.id,
      amount: disputeAmount,
      currency: dispute.currency.toUpperCase(),
      reason: dispute.reason,
      status: 'NEEDS_RESPONSE',
      evidenceDetails: dispute.evidence_details as any,
      creatorDebt: creatorDebt,
      reconciled: false,
    },
  });

  // Update payment dispute status
  await prisma.payment.update({
    where: { id: payment.id },
    data: { disputeStatus: 'NEEDS_RESPONSE' },
  });

  // ✅ PHASE 1.2: Block payouts if debt exceeds threshold
  // Note: We don't reverse the transfer yet, only when dispute is lost
  await checkAndBlockPayouts(payment.booking.callOffer.creatorId);

  // Notify creator and admin
  await notifyDebt(
    payment.booking.callOffer.creatorId,
    'DISPUTE',
    disputeAmount,
    dispute.reason
  );

  // Log dispute
  await logDispute(TransactionEventType.DISPUTE_CREATED, {
    disputeId: createdDispute.id,
    paymentId: payment.id,
    amount: disputeAmount,
    currency: createdDispute.currency,
    status: 'NEEDS_RESPONSE',
    stripeDisputeId: dispute.id,
    reason: dispute.reason,
    metadata: {
      creatorDebt,
    },
  });

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.DISPUTE,
    entityId: createdDispute.id,
    metadata: { disputeId: dispute.id },
  });

  // Send critical alert to admins
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true },
  });

  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: 'SYSTEM',
      title: '🚨 ALERTE: Contestation de paiement',
      message: `Une contestation de ${disputeAmount.toFixed(2)} EUR a été créée pour ${payment.booking.callOffer.creator.user.name}. Dette potentielle: ${creatorDebt.toFixed(2)} EUR.`,
      link: '/dashboard/admin/refunds-disputes',
    });
  }

  console.error('[CRITICAL] Dispute created:', {
    disputeId: createdDispute.id,
    paymentId: payment.id,
    amount: disputeAmount,
    creatorDebt,
    reason: dispute.reason,
  });
}

/**
 * Handle charge.dispute.closed
 * ✅ PHASE 1.2: Manage Transfer Reversal for lost disputes
 */
async function handleDisputeClosed(event: Stripe.Event): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;
  
  // Import creator debt functions
  const { 
    attemptTransferReversal, 
    markDisputeAsReconciled,
    checkAndUnblockPayouts,
    checkAndBlockPayouts 
  } = await import('@/lib/creator-debt');
  
  const existingDispute = await prisma.dispute.findUnique({
    where: { stripeDisputeId: dispute.id },
    include: {
      payment: {
        include: {
          booking: {
            include: {
              callOffer: {
                include: {
                  creator: {
                    include: { user: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!existingDispute) {
    console.warn('[Webhook] Dispute not found:', dispute.id);
    return;
  }

  const status = dispute.status === 'won' ? 'WON' : 'LOST';

  console.log('[Webhook] Dispute closed:', {
    disputeId: existingDispute.id,
    status,
    amount: existingDispute.amount,
    creatorDebt: existingDispute.creatorDebt,
  });

  // Update dispute status
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

  // ✅ PHASE 1.2: Handle based on dispute outcome
  if (status === 'WON') {
    // Dispute won - mark as reconciled, no debt owed
    console.log('[Webhook] ✅ Dispute won - marking as reconciled');
    
    await markDisputeAsReconciled(existingDispute.id, 'MANUAL');
    
    // Check if we can unblock payouts
    await checkAndUnblockPayouts(existingDispute.payment.booking.callOffer.creatorId);

    // Notify creator
    await createNotification({
      userId: existingDispute.payment.booking.callOffer.creator.userId,
      type: 'SYSTEM',
      title: '✅ Contestation gagnée',
      message: `La contestation de ${Number(existingDispute.amount).toFixed(2)} EUR a été gagnée. Vous n'avez rien à rembourser.`,
      link: '/dashboard/creator',
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: 'SYSTEM',
        title: '✅ Contestation gagnée',
        message: `La contestation de ${Number(existingDispute.amount).toFixed(2)} EUR pour ${existingDispute.payment.booking.callOffer.creator.user.name} a été gagnée.`,
        link: '/dashboard/admin/refunds-disputes',
      });
    }
  } else {
    // Dispute lost - attempt Transfer Reversal
    console.log('[Webhook] ❌ Dispute lost - attempting transfer reversal');
    
    let reconciled = false;
    let reversalId: string | undefined;

    if (existingDispute.payment.transferId) {
      const reversalResult = await attemptTransferReversal(
        existingDispute.payment.transferId,
        Math.round(Number(existingDispute.creatorDebt) * 100) // Convert to cents
      );

      if (reversalResult.success) {
        console.log('[Webhook] ✅ Transfer reversal successful for lost dispute');
        reconciled = true;
        reversalId = reversalResult.reversalId;

        await markDisputeAsReconciled(existingDispute.id, 'TRANSFER_REVERSAL', reversalId);
        
        // Check if we can unblock payouts
        await checkAndUnblockPayouts(existingDispute.payment.booking.callOffer.creatorId);
      } else {
        console.log('[Webhook] ❌ Transfer reversal failed for lost dispute:', reversalResult.error);
        
        // Transfer reversal failed - record debt for future deduction
        await checkAndBlockPayouts(existingDispute.payment.booking.callOffer.creatorId);
      }
    } else {
      console.warn('[Webhook] ⚠️  No transfer ID found - cannot attempt reversal for lost dispute');
      
      // No transfer to reverse - record debt for future deduction
      await checkAndBlockPayouts(existingDispute.payment.booking.callOffer.creatorId);
    }

    // Notify creator about lost dispute
    await createNotification({
      userId: existingDispute.payment.booking.callOffer.creator.userId,
      type: 'SYSTEM',
      title: '❌ Contestation perdue',
      message: reconciled
        ? `La contestation de ${Number(existingDispute.amount).toFixed(2)} EUR a été perdue. Le montant a été récupéré automatiquement.`
        : `La contestation de ${Number(existingDispute.amount).toFixed(2)} EUR a été perdue. Le montant de ${Number(existingDispute.creatorDebt).toFixed(2)} EUR sera déduit de vos prochains paiements.`,
      link: '/dashboard/creator',
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: 'SYSTEM',
        title: '❌ Contestation perdue',
        message: `La contestation de ${Number(existingDispute.amount).toFixed(2)} EUR pour ${existingDispute.payment.booking.callOffer.creator.user.name} a été perdue. ${reconciled ? 'Réconciliée automatiquement.' : 'Dette enregistrée.'}`,
        link: '/dashboard/admin/refunds-disputes',
      });
    }
  }

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

      // ✅ PHASE 3: Create audit log with payoutId
      await prisma.payoutAuditLog.create({
        data: {
          creatorId,
          payoutId: newPayout.id,
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

  // ✅ PHASE 3: Update existing payout with paidAt
  await prisma.payout.update({
    where: { id: payout.id },
    data: {
      status: PayoutStatus.PAID,
      paidAt: new Date(),
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

  // ✅ PHASE 3: Create audit log with payoutId
  await prisma.payoutAuditLog.create({
    data: {
      creatorId: payout.creatorId,
      payoutId: payout.id,
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

  // ✅ PHASE 3: Update payout with failedAt
  await prisma.payout.update({
    where: { id: payout.id },
    data: {
      status: PayoutStatus.FAILED,
      failureReason,
      failedAt: new Date(),
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

  // ✅ PHASE 3: Create audit log for failed payout with payoutId
  await prisma.payoutAuditLog.create({
    data: {
      creatorId: payout.creatorId,
      payoutId: payout.id,
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
 * Handle payout.canceled
 * When a payout is canceled
 */
async function handlePayoutCanceled(event: Stripe.Event): Promise<void> {
  const stripePayout = event.data.object as Stripe.Payout;
  
  const payout = await prisma.payout.findFirst({
    where: { stripePayoutId: stripePayout.id },
  });

  if (!payout) {
    console.warn('[Webhook] Payout not found for canceled event:', stripePayout.id);
    return;
  }

  await prisma.payout.update({
    where: { id: payout.id },
    data: {
      status: PayoutStatus.CANCELED,
      updatedAt: new Date(),
    },
  });

  await logPayout(TransactionEventType.PAYOUT_FAILED, {
    payoutId: payout.id,
    creatorId: payout.creatorId,
    amount: Number(payout.amount),
    status: PayoutStatus.CANCELED,
    stripePayoutId: stripePayout.id,
    errorMessage: 'Payout canceled',
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
      action: 'FAILED',
      amount: Number(payout.amount),
      status: PayoutStatus.CANCELED,
      stripePayoutId: stripePayout.id,
      reason: 'Paiement annulé',
    },
  });

  console.log('[Webhook] Payout canceled:', {
    payoutId: payout.id,
    stripePayoutId: stripePayout.id,
  });
}

/**
 * Handle transfer.created
 * When a transfer is created (for logging purposes)
 */
async function handleTransferCreated(event: Stripe.Event): Promise<void> {
  const transfer = event.data.object as Stripe.Transfer;
  
  console.log('[Webhook] Transfer created:', {
    transferId: transfer.id,
    amount: transfer.amount / 100,
    destination: transfer.destination,
  });

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.TRANSFER,
    entityId: transfer.id,
    metadata: {
      transferId: transfer.id,
      amount: transfer.amount / 100,
      destination: transfer.destination,
    },
  });
}

/**
 * Handle transfer.succeeded
 * When a transfer succeeds (for logging purposes)
 */
async function handleTransferSucceeded(event: Stripe.Event): Promise<void> {
  const transfer = event.data.object as Stripe.Transfer;
  
  console.log('[Webhook] Transfer succeeded:', {
    transferId: transfer.id,
    amount: transfer.amount / 100,
    destination: transfer.destination,
  });

  await logWebhook({
    stripeEventId: event.id,
    eventType: event.type,
    entityType: EntityType.TRANSFER,
    entityId: transfer.id,
    metadata: {
      transferId: transfer.id,
      amount: transfer.amount / 100,
      destination: transfer.destination,
      status: 'succeeded',
    },
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
        payoutStatus: 'REQUESTED',
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

  // ✅ FIX: Also update creator's currency from Stripe account
  const currency = (account.default_currency || 'eur').toUpperCase();
  
  await prisma.creator.update({
    where: { id: creator.id },
    data: {
      isStripeOnboarded: accountStatus.isFullyOnboarded,
      payoutBlocked: shouldBlockPayout,
      payoutBlockedReason: blockReason,
      currency: currency, // Update currency from Stripe account
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
function generateReceiptEmail(booking: any, amount: number, currency: string = 'EUR'): string {
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
                <span>${amount.toFixed(2)} ${currency}</span>
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
function generateCreatorNotificationEmail(booking: any, creatorAmount: number, payoutReleaseDate: Date, currency: string = 'EUR'): string {
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
                <span>${creatorAmount.toFixed(2)} ${currency}</span>
              </div>
            </div>
            
            <p><strong>💰 Paiement sécurisé:</strong> Le montant de <strong>${creatorAmount.toFixed(2)} ${currency}</strong> sera disponible pour transfert le ${payoutReleaseDate.toLocaleDateString('fr-FR')}.</p>
            
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

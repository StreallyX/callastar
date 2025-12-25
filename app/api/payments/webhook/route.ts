import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { verifyWebhookSignature, calculatePayoutReleaseDate } from '@/lib/stripe';
import { createDailyRoom } from '@/lib/daily';
import { sendEmail, generateBookingConfirmationEmail } from '@/lib/email';
import { createNotification } from '@/lib/notifications';

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
    const event = verifyWebhookSignature(body, signature, webhookSecret);

    // Handle payment_intent.succeeded event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any;
      const bookingId = paymentIntent.metadata?.bookingId;

      if (!bookingId) {
        console.error('No bookingId in payment intent metadata');
        return NextResponse.json({ received: true }, { status: 200 });
      }

      // Get booking
      const booking = await db.booking.findUnique({
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
        console.error('Booking not found:', bookingId);
        return NextResponse.json({ received: true }, { status: 200 });
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
        await db.booking.update({
          where: { id: bookingId },
          data: {
            status: 'CONFIRMED',
            dailyRoomUrl: room.url,
            dailyRoomName: room.name,
          },
        });
      } catch (error) {
        console.error('Error creating Daily room:', error);
        // Continue anyway - room can be created later
      }

      // Create payment record with payout tracking
      const amount = Number(booking.totalPrice);
      const platformFee = Number(paymentIntent.metadata?.platformFee || 0);
      const creatorAmount = Number(paymentIntent.metadata?.creatorAmount || 0);
      
      // Calculate payout release date (7 days from now)
      const paymentDate = new Date();
      const payoutReleaseDate = calculatePayoutReleaseDate(paymentDate);

      await db.payment.create({
        data: {
          bookingId: booking.id,
          amount,
          stripePaymentIntentId: paymentIntent.id,
          status: 'SUCCEEDED',
          platformFee,
          creatorAmount,
          payoutStatus: 'HELD', // Payment held for 7 days
          payoutReleaseDate,    // Date when funds can be transferred
        },
      });

      // Send confirmation email to user
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

        // Send payment receipt email to user
        const receiptHtml = `
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

        await sendEmail({
          to: booking.user.email,
          subject: '💳 Reçu de paiement - Call a Star',
          html: receiptHtml,
        });
      } catch (error) {
        console.error('Error sending emails to user:', error);
        // Continue anyway - email is not critical
      }

      // Send notification to creator (email + in-app)
      try {
        // Create in-app notification for creator
        await createNotification({
          userId: booking.callOffer.creator.userId,
          type: 'BOOKING_CONFIRMED',
          title: 'Nouvelle réservation !',
          message: `${booking.user.name} a réservé votre appel "${booking.callOffer.title}" pour le ${new Date(booking.callOffer.dateTime).toLocaleDateString('fr-FR', { 
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })}.`,
          link: `/dashboard/creator`,
        });

        // Send email notification to creator
        const creatorEmailHtml = `
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
                  
                  <p><strong>💰 Paiement sécurisé:</strong> Le montant de <strong>${creatorAmount.toFixed(2)} €</strong> est actuellement sécurisé sur la plateforme. Il sera disponible pour transfert sur votre compte Stripe dans <strong>7 jours</strong> (le ${payoutReleaseDate.toLocaleDateString('fr-FR')}), après la période de protection contre les litiges.</p>
                  
                  <div style="text-align: center;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/creator" class="cta-button">
                      Voir mes réservations
                    </a>
                  </div>
                  
                  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
                    Pensez à vous connecter 5 minutes avant le début de l'appel pour accueillir votre participant.
                  </p>
                </div>
              </div>
            </body>
          </html>
        `;

        await sendEmail({
          to: booking.callOffer.creator.user.email,
          subject: '🎉 Nouvelle réservation - Call a Star',
          html: creatorEmailHtml,
        });
      } catch (error) {
        console.error('Error sending notifications to creator:', error);
        // Continue anyway - notification is not critical
      }
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
        await db.payoutAuditLog.updateMany({
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
        const updatedLogs = await db.payoutAuditLog.updateMany({
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
          const creator = await db.creator.findUnique({
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
        await db.payoutAuditLog.updateMany({
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
          const creator = await db.creator.findUnique({
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
      const creator = await db.creator.findFirst({
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

        // Update creator's onboarding status
        const isOnboarded = account.details_submitted && account.charges_enabled;
        
        await db.creator.update({
          where: { id: creator.id },
          data: {
            isStripeOnboarded: isOnboarded,
          },
        });

        // If payouts were just enabled, send notification
        if (account.payouts_enabled && !creator.isStripeOnboarded) {
          try {
            const creatorWithUser = await db.creator.findUnique({
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
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}

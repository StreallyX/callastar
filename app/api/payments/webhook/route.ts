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

    // Handle transfer.created event (transfer completed successfully)
    // Note: Transfers to Stripe Connect accounts are instant and successful when created
    if (event.type === 'transfer.created') {
      const transfer = event.data.object as any;
      const payoutRequestId = transfer.metadata?.payoutRequestId;

      console.log('========================================');
      console.log('WEBHOOK: transfer.created received');
      console.log('Transfer ID:', transfer.id);
      console.log('Amount:', transfer.amount, 'cents');
      console.log('Destination:', transfer.destination);
      console.log('Payout Request ID:', payoutRequestId);
      console.log('========================================');

      if (!payoutRequestId) {
        console.log('Transfer without payoutRequestId metadata:', transfer.id);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      try {
        // Get the payout request
        const payoutRequest = await db.payoutRequest.findUnique({
          where: { id: payoutRequestId },
          include: {
            payments: true,
            creator: {
              include: {
                user: true,
              },
            },
          },
        });

        if (!payoutRequest) {
          console.error('PayoutRequest not found:', payoutRequestId);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        // Update PayoutRequest status to COMPLETED
        await db.payoutRequest.update({
          where: { id: payoutRequestId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            stripeTransferId: transfer.id,
          },
        });

        // Update all linked payments to PAID status
        if (payoutRequest.payments.length > 0) {
          await db.payment.updateMany({
            where: {
              id: { in: payoutRequest.payments.map(p => p.id) },
            },
            data: {
              payoutStatus: 'PAID',
              stripeTransferId: transfer.id,
              payoutDate: new Date(),
            },
          });
        }

        console.log(`✅ Transfer completed for PayoutRequest ${payoutRequestId}`);

        // Send notification to creator
        try {
          await createNotification({
            userId: payoutRequest.creator.userId,
            type: 'PAYOUT_COMPLETED',
            title: 'Paiement transféré !',
            message: `Votre paiement de ${Number(payoutRequest.totalAmount).toFixed(2)}€ a été transféré sur votre compte Stripe.`,
            link: '/dashboard/creator/payouts',
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
                  .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                  .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                  .amount { font-size: 32px; font-weight: bold; color: #10b981; text-align: center; margin: 20px 0; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>💰 Paiement transféré !</h1>
                  </div>
                  <div class="content">
                    <p>Bonjour ${payoutRequest.creator.user.name},</p>
                    <p>Excellente nouvelle ! Votre paiement a été transféré sur votre compte Stripe.</p>
                    <div class="amount">${Number(payoutRequest.totalAmount).toFixed(2)} €</div>
                    <p>Les fonds devraient être disponibles sur votre compte bancaire dans 2-3 jours ouvrés selon les paramètres de votre compte Stripe.</p>
                    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
                      Vous pouvez consulter les détails de ce transfert dans votre tableau de bord Stripe.
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `;

          await sendEmail({
            to: payoutRequest.creator.user.email,
            subject: '💰 Paiement transféré - Call a Star',
            html: emailHtml,
          });

          console.log('✅ Notification sent to creator');
        } catch (error) {
          console.error('Error sending notification:', error);
          // Continue anyway - notification is not critical
        }
      } catch (error) {
        console.error('❌ Error processing transfer.created event:', error);
        // Continue anyway - webhook should return 200
      }
    }

    // Handle transfer.updated event (for monitoring status changes)
    if (event.type === 'transfer.updated') {
      const transfer = event.data.object as any;
      const payoutRequestId = transfer.metadata?.payoutRequestId;

      console.log('========================================');
      console.log('WEBHOOK: transfer.updated received');
      console.log('Transfer ID:', transfer.id);
      console.log('Amount:', transfer.amount, 'cents');
      console.log('Destination:', transfer.destination);
      console.log('Payout Request ID:', payoutRequestId);
      console.log('========================================');

      // Log for monitoring purposes - most updates don't require action
      // since transfers are instant and successful when created
    }

    // Handle transfer.reversed event (transfer was reversed by Stripe)
    if (event.type === 'transfer.reversed') {
      const transfer = event.data.object as any;
      const reversal = transfer.reversals?.data?.[0];
      const payoutRequestId = transfer.metadata?.payoutRequestId;

      console.log('========================================');
      console.log('WEBHOOK: transfer.reversed received');
      console.log('Transfer ID:', transfer.id);
      console.log('Reversal ID:', reversal?.id);
      console.log('Amount:', transfer.amount, 'cents');
      console.log('Destination:', transfer.destination);
      console.log('Reversal Reason:', reversal?.metadata?.reason || 'Not specified');
      console.log('Payout Request ID:', payoutRequestId);
      console.log('========================================');

      if (!payoutRequestId) {
        console.log('Transfer reversal without payoutRequestId metadata:', transfer.id);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      try {
        // Get the payout request
        const payoutRequest = await db.payoutRequest.findUnique({
          where: { id: payoutRequestId },
          include: {
            payments: true,
            creator: {
              include: {
                user: true,
              },
            },
          },
        });

        if (!payoutRequest) {
          console.error('PayoutRequest not found:', payoutRequestId);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        // Update PayoutRequest status to REVERSED
        await db.payoutRequest.update({
          where: { id: payoutRequestId },
          data: {
            status: 'REVERSED',
            reversalId: reversal?.id || transfer.id,
            reversalReason: reversal?.metadata?.reason || 'Transfer reversed by Stripe',
            reversedAt: new Date(),
          },
        });

        // Update all linked payments to REVERSED status
        if (payoutRequest.payments.length > 0) {
          await db.payment.updateMany({
            where: {
              id: { in: payoutRequest.payments.map(p => p.id) },
            },
            data: {
              payoutStatus: 'REVERSED',
            },
          });
        }

        console.log(`✅ Transfer reversed for PayoutRequest ${payoutRequestId}`);

        // Send notification to creator
        try {
          await createNotification({
            userId: payoutRequest.creator.userId,
            type: 'SYSTEM',
            title: 'Paiement inversé',
            message: `Le transfert de ${Number(payoutRequest.totalAmount).toFixed(2)}€ a été inversé. Raison: ${reversal?.metadata?.reason || 'Non spécifiée'}. Veuillez contacter le support.`,
            link: '/dashboard/creator/payouts',
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
                  .amount { font-size: 32px; font-weight: bold; color: #ef4444; text-align: center; margin: 20px 0; }
                  .alert-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>⚠️ Paiement inversé</h1>
                  </div>
                  <div class="content">
                    <p>Bonjour ${payoutRequest.creator.user.name},</p>
                    <p>Nous vous informons qu'un transfert vers votre compte Stripe a été inversé.</p>
                    <div class="amount">${Number(payoutRequest.totalAmount).toFixed(2)} €</div>
                    <div class="alert-box">
                      <strong>Raison de l'inversion:</strong><br>
                      ${reversal?.metadata?.reason || 'Non spécifiée'}
                    </div>
                    <p>Si vous pensez qu'il s'agit d'une erreur ou si vous avez des questions, veuillez contacter notre équipe de support.</p>
                    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
                      Vous pouvez consulter les détails dans votre tableau de bord.
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `;

          await sendEmail({
            to: payoutRequest.creator.user.email,
            subject: '⚠️ Paiement inversé - Call a Star',
            html: emailHtml,
          });

          console.log('✅ Notification sent to creator');
        } catch (error) {
          console.error('Error sending notification:', error);
          // Continue anyway - notification is not critical
        }
      } catch (error) {
        console.error('❌ Error processing transfer.reversed event:', error);
        // Continue anyway - webhook should return 200
      }
    }

    // Handle payment_intent.succeeded event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any;
      const bookingId = paymentIntent.metadata?.bookingId;

      console.log('========================================');
      console.log('WEBHOOK: payment_intent.succeeded received');
      console.log('Payment Intent ID:', paymentIntent.id);
      console.log('Booking ID:', bookingId);
      console.log('Amount:', paymentIntent.amount, 'cents');
      console.log('Status:', paymentIntent.status);
      console.log('Application Fee Amount:', paymentIntent.application_fee_amount);
      console.log('On Behalf Of:', paymentIntent.on_behalf_of);
      console.log('Transfer Data:', JSON.stringify(paymentIntent.transfer_data));
      console.log('Metadata:', JSON.stringify(paymentIntent.metadata));
      console.log('========================================');

      if (!bookingId) {
        console.error('No bookingId in payment intent metadata');
        return NextResponse.json({ received: true }, { status: 200 });
      }

      // Get booking
      console.log('Fetching booking from database...');
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

      console.log('Booking found:', {
        id: booking.id,
        status: booking.status,
        totalPrice: booking.totalPrice,
        creatorId: booking.callOffer.creatorId,
        stripeAccountId: booking.callOffer.creator.stripeAccountId,
      });

      // Create Daily.co room
      console.log('Creating Daily.co room...');
      const roomName = `call-${bookingId}`;
      try {
        const room = await createDailyRoom({
          name: roomName,
          properties: {
            exp: Math.floor(new Date(booking.callOffer.dateTime).getTime() / 1000) + 60 * 60 * 24,
            max_participants: 2,
          },
        });

        console.log('Daily.co room created:', room.url);

        // Update booking with room info and status
        await db.booking.update({
          where: { id: bookingId },
          data: {
            status: 'CONFIRMED',
            dailyRoomUrl: room.url,
            dailyRoomName: room.name,
          },
        });

        console.log('Booking status updated to CONFIRMED');
      } catch (error) {
        console.error('Error creating Daily room:', error);
        // Continue anyway - room can be created later
        // Still update booking status
        try {
          await db.booking.update({
            where: { id: bookingId },
            data: {
              status: 'CONFIRMED',
            },
          });
          console.log('Booking status updated to CONFIRMED (without room)');
        } catch (updateError) {
          console.error('Error updating booking status:', updateError);
        }
      }

      // Variables to store payment amounts (used later in emails)
      let amount: number;
      let platformFee: number;
      let creatorAmount: number;
      let payoutReleaseDate: Date;

      // Check if payment record already exists
      console.log('Checking for existing payment record...');
      const existingPayment = await db.payment.findUnique({
        where: { bookingId: booking.id },
      });

      if (existingPayment) {
        console.log('Payment record already exists for booking:', bookingId);
        console.log('Existing payment:', {
          id: existingPayment.id,
          status: existingPayment.status,
          amount: existingPayment.amount,
          platformFee: existingPayment.platformFee,
          creatorAmount: existingPayment.creatorAmount,
        });
        
        // Set variables from existing payment for use in emails
        amount = Number(existingPayment.amount);
        platformFee = Number(existingPayment.platformFee);
        creatorAmount = Number(existingPayment.creatorAmount);
        payoutReleaseDate = existingPayment.payoutReleaseDate || calculatePayoutReleaseDate(new Date());
        
        // Update status if needed
        if (existingPayment.status !== 'SUCCEEDED') {
          console.log('Updating payment status to SUCCEEDED...');
          await db.payment.update({
            where: { bookingId: booking.id },
            data: { status: 'SUCCEEDED' },
          });
          console.log('Payment status updated to SUCCEEDED');
        }
      } else {
        console.log('No existing payment record found, creating new one...');
        console.log('========================================');
        console.log('PAYMENT CREATION - Extracting metadata...');
        console.log('Raw metadata:', JSON.stringify(paymentIntent.metadata, null, 2));
        console.log('========================================');
        
        // Extract and parse metadata values
        // These are stored as EUR strings in metadata (e.g., "7", "63")
        const metadataPlatformFee = paymentIntent.metadata?.platformFee;
        const metadataCreatorAmount = paymentIntent.metadata?.creatorAmount;
        
        console.log('Extracted metadata values (as strings):', {
          platformFee: metadataPlatformFee,
          creatorAmount: metadataCreatorAmount,
          type: `platformFee: ${typeof metadataPlatformFee}, creatorAmount: ${typeof metadataCreatorAmount}`,
        });
        
        // Parse and validate metadata values
        try {
          // Parse platform fee from metadata
          if (!metadataPlatformFee) {
            throw new Error('platformFee is missing from metadata');
          }
          platformFee = parseFloat(metadataPlatformFee);
          if (isNaN(platformFee) || platformFee < 0) {
            throw new Error(`Invalid platformFee value: "${metadataPlatformFee}" parsed to ${platformFee}`);
          }
          
          // Parse creator amount from metadata
          if (!metadataCreatorAmount) {
            throw new Error('creatorAmount is missing from metadata');
          }
          creatorAmount = parseFloat(metadataCreatorAmount);
          if (isNaN(creatorAmount) || creatorAmount <= 0) {
            throw new Error(`Invalid creatorAmount value: "${metadataCreatorAmount}" parsed to ${creatorAmount}`);
          }
          
          console.log('✅ Metadata values parsed successfully:', {
            platformFee: `${platformFee} EUR`,
            creatorAmount: `${creatorAmount} EUR`,
          });
        } catch (metadataError: any) {
          console.error('❌ METADATA PARSING ERROR:', metadataError.message);
          console.error('Cannot create payment record without valid metadata');
          console.error('Skipping payment creation for booking:', bookingId);
          // Return early - don't try to create payment with invalid data
          return NextResponse.json({ received: true, error: 'Invalid metadata' }, { status: 200 });
        }
        
        // Get total amount from booking (stored as Decimal in DB, e.g., 70.00 EUR)
        amount = Number(booking.totalPrice);
        
        // Validate amount from booking
        if (!amount || amount <= 0 || isNaN(amount)) {
          console.error('❌ VALIDATION ERROR: Invalid amount from booking');
          console.error('Booking totalPrice:', booking.totalPrice);
          console.error('Parsed amount:', amount);
          console.error('Skipping payment creation for booking:', bookingId);
          return NextResponse.json({ received: true, error: 'Invalid booking amount' }, { status: 200 });
        }
        
        // Verify that fees add up correctly (with small tolerance for floating point)
        const expectedTotal = platformFee + creatorAmount;
        const difference = Math.abs(amount - expectedTotal);
        const tolerance = 0.02; // 2 cents tolerance
        
        if (difference > tolerance) {
          console.warn('⚠️  WARNING: Fee calculation mismatch!');
          console.warn('Total amount:', amount, 'EUR');
          console.warn('Platform fee + Creator amount:', expectedTotal, 'EUR');
          console.warn('Difference:', difference, 'EUR');
          console.warn('This might indicate a calculation error in the payment intent creation');
        }
        
        console.log('Payment record values to be saved:', {
          bookingId: booking.id,
          amount: `${amount} EUR`,
          platformFee: `${platformFee} EUR`,
          creatorAmount: `${creatorAmount} EUR`,
          total: `${amount} EUR`,
          feeBreakdown: `${platformFee} + ${creatorAmount} = ${platformFee + creatorAmount} EUR`,
          paymentIntentId: paymentIntent.id,
          paymentIntentAmount: `${paymentIntent.amount} cents`,
          useStripeConnect: paymentIntent.metadata?.useStripeConnect,
          hasApplicationFee: !!paymentIntent.application_fee_amount,
          hasTransferData: !!paymentIntent.transfer_data,
        });
        
        // Calculate payout release date (7 days from now)
        const paymentDate = new Date();
        payoutReleaseDate = calculatePayoutReleaseDate(paymentDate);
        
        console.log('Payout info:', {
          paymentDate: paymentDate.toISOString(),
          payoutReleaseDate: payoutReleaseDate.toISOString(),
          daysToHold: 7,
          payoutStatus: 'HELD',
        });

        try {
          console.log('========================================');
          console.log('Creating payment record in database...');
          console.log('Database values (all in EUR):');
          console.log('  - bookingId:', booking.id);
          console.log('  - amount:', amount);
          console.log('  - platformFee:', platformFee);
          console.log('  - creatorAmount:', creatorAmount);
          console.log('  - stripePaymentIntentId:', paymentIntent.id);
          console.log('  - status: SUCCEEDED');
          console.log('  - payoutStatus: HELD');
          console.log('  - payoutReleaseDate:', payoutReleaseDate.toISOString());
          console.log('========================================');
          
          const newPayment = await db.payment.create({
            data: {
              bookingId: booking.id,
              amount: amount, // Decimal field, EUR value
              stripePaymentIntentId: paymentIntent.id,
              status: 'SUCCEEDED',
              platformFee: platformFee, // Decimal field, EUR value
              creatorAmount: creatorAmount, // Decimal field, EUR value
              payoutStatus: 'HELD', // Payment held for 7 days
              payoutReleaseDate: payoutReleaseDate, // Date when funds can be transferred
            },
          });
          
          console.log('========================================');
          console.log('✅✅✅ PAYMENT RECORD CREATED SUCCESSFULLY! ✅✅✅');
          console.log('Payment ID:', newPayment.id);
          console.log('Payment details:', {
            id: newPayment.id,
            bookingId: newPayment.bookingId,
            amount: `${newPayment.amount} EUR`,
            platformFee: `${newPayment.platformFee} EUR`,
            creatorAmount: `${newPayment.creatorAmount} EUR`,
            status: newPayment.status,
            payoutStatus: newPayment.payoutStatus,
            payoutReleaseDate: newPayment.payoutReleaseDate,
            createdAt: newPayment.createdAt,
          });
          console.log('========================================');
        } catch (paymentError: any) {
          console.error('========================================');
          console.error('❌❌❌ ERROR CREATING PAYMENT RECORD ❌❌❌');
          console.error('Error name:', paymentError?.name);
          console.error('Error message:', paymentError?.message);
          console.error('Error code:', paymentError?.code);
          console.error('========================================');
          console.error('Full error object:', JSON.stringify(paymentError, null, 2));
          console.error('========================================');
          console.error('Failed payment data that was attempted:');
          console.error('  - bookingId:', booking.id);
          console.error('  - amount:', amount, `(type: ${typeof amount})`);
          console.error('  - platformFee:', platformFee, `(type: ${typeof platformFee})`);
          console.error('  - creatorAmount:', creatorAmount, `(type: ${typeof creatorAmount})`);
          console.error('  - payoutReleaseDate:', payoutReleaseDate, `(type: ${typeof payoutReleaseDate})`);
          console.error('========================================');
          
          // Check for specific Prisma errors
          if (paymentError?.code === 'P2002') {
            console.error('❌ Unique constraint violation');
            console.error('   This booking may already have a payment record');
            console.error('   Check if payment was created in a previous webhook call');
          } else if (paymentError?.code === 'P2003') {
            console.error('❌ Foreign key constraint failed');
            console.error('   The booking may not exist in the database');
            console.error('   Booking ID:', booking.id);
          } else if (paymentError?.code === 'P2000') {
            console.error('❌ Value too long for column');
            console.error('   One of the values exceeds the database column limit');
          } else if (paymentError?.code === 'P2001') {
            console.error('❌ Record not found');
            console.error('   Required record does not exist');
          } else {
            console.error('❌ Unexpected error type');
            console.error('   This may be a database connection issue or schema mismatch');
          }
          console.error('========================================');
          
          // Don't continue - this is a critical error
          // Return error status so Stripe will retry the webhook
          throw new Error(`Failed to create payment record: ${paymentError?.message}`);
        }
      }

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

      console.log('========================================');
      console.log('✅ Webhook processing completed successfully');
      console.log('Booking ID:', bookingId);
      console.log('Booking Status: CONFIRMED');
      console.log('Payment Record: Created/Updated');
      console.log('========================================');
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('========================================');
    console.error('❌ WEBHOOK ERROR');
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('========================================');
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}
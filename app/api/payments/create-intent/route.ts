import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { createPaymentIntent } from '@/lib/stripe'; // ✅ CORRECTION #2: Suppression de calculateFees (obsolète)
import { getPlatformSettings } from '@/lib/settings';
import { logPayment } from '@/lib/logger';
import { logInfo, logError, logPaymentEvent, logApiError } from '@/lib/system-logger';
import { TransactionEventType, LogActor, LogLevel } from '@prisma/client';

const createIntentSchema = z.object({
  bookingId: z.string().cuid(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      await logError(
        'PAYMENT_INTENT_UNAUTHORIZED',
        LogActor.GUEST,
        'Tentative de création de payment intent sans authentification',
        undefined,
        { endpoint: '/api/payments/create-intent' }
      );
      
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createIntentSchema.parse(body);

    // Log payment intent creation initiation
    await logInfo(
      'PAYMENT_INTENT_CREATION_INITIATED',
      LogActor.USER,
      'Création de payment intent initiée',
      user.userId,
      {
        bookingId: validatedData.bookingId,
      }
    );

    // Get platform settings
    const settings = await getPlatformSettings();

    // Get booking with creator's Stripe Connect info
    const booking = await db.booking.findUnique({
      where: { id: validatedData.bookingId },
      include: {
        callOffer: {
          include: {
            creator: {
              select: {
                id: true,
                userId: true,
                stripeAccountId: true,
                isStripeOnboarded: true,
                currency: true, // ✅ NEW: Include creator's currency
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!booking) {
      await logError(
        'PAYMENT_INTENT_BOOKING_NOT_FOUND',
        LogActor.USER,
        'Tentative de paiement pour une réservation introuvable',
        user.userId,
        { bookingId: validatedData.bookingId }
      );
      
      return NextResponse.json(
        { error: 'Réservation introuvable' },
        { status: 404 }
      );
    }

    // Check ownership
    if (booking.userId !== user.userId) {
      await logError(
        'PAYMENT_INTENT_ACCESS_DENIED',
        LogActor.USER,
        'Tentative de paiement pour une réservation non possédée',
        user.userId,
        {
          bookingId: validatedData.bookingId,
          bookingOwnerId: booking.userId,
        }
      );
      
      return NextResponse.json(
        { error: 'Accès refusé' },
        { status: 403 }
      );
    }

    // Check if already paid
    if (booking.status === 'CONFIRMED') {
      await logError(
        'PAYMENT_INTENT_ALREADY_PAID',
        LogActor.USER,
        'Tentative de paiement pour une réservation déjà payée',
        user.userId,
        {
          bookingId: validatedData.bookingId,
          bookingStatus: booking.status,
        }
      );
      
      return NextResponse.json(
        { error: 'Cette réservation est déjà payée' },
        { status: 400 }
      );
    }

    // Calculate fees using platform settings
    const amount = Number(booking.totalPrice);
    const platformFeePercentage = Number(settings.platformFeePercentage);
    const platformFeeFixed = settings.platformFeeFixed ? Number(settings.platformFeeFixed) : 0;
    
    // Calculate platform fee: percentage + fixed fee (if any)
    const platformFee = (amount * platformFeePercentage / 100) + platformFeeFixed;
    const creatorAmount = amount - platformFee;

    const creator = booking.callOffer.creator;
    const useStripeConnect = creator.isStripeOnboarded && creator.stripeAccountId;

    // ✅ NEW: Use creator's currency instead of platform currency
    const creatorCurrency = (creator.currency || 'EUR').toUpperCase();

    // ✅ PHASE 1.1: Create payment intent using Separate Charges and Transfers
    // No destination charge, transfer will be created in webhook
    const paymentIntent = await createPaymentIntent({
      amount,
      currency: creatorCurrency.toLowerCase(), // ✅ Use creator's currency
      metadata: {
        bookingId: booking.id,
        userId: user.userId,
        creatorId: booking.callOffer.creatorId,
        offerId: booking.callOfferId, // ✅ Required for webhook transfer
        currency: creatorCurrency,
        platformFee: platformFee.toFixed(2),
        creatorAmount: creatorAmount.toFixed(2),
        useStripeConnect: (useStripeConnect ?? false).toString(),
      },
      stripeAccountId: useStripeConnect ? creator.stripeAccountId : null,
      platformFeePercentage: platformFeePercentage, // ✅ NEW: Pass percentage instead of amount
    });

    // Update booking with payment intent ID
    await db.booking.update({
      where: { id: booking.id },
      data: {
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    // Create payment record (for tracking)
    const payment = await db.payment.create({
      data: {
        bookingId: booking.id,
        amount,
        currency: creatorCurrency, // ✅ NEW: Store currency
        stripePaymentIntentId: paymentIntent.id,
        status: 'PENDING',
        platformFee,
        creatorAmount,
        payoutStatus: 'REQUESTED',
      },
    });

    // Log payment creation (TransactionLog)
    await logPayment(TransactionEventType.PAYMENT_CREATED, {
      paymentId: payment.id,
      amount,
      currency: creatorCurrency, // ✅ MODIFIED: Use creator's currency
      status: 'PENDING',
      stripePaymentIntentId: paymentIntent.id,
      metadata: {
        bookingId: booking.id,
        userId: user.userId,
        creatorId: booking.callOffer.creatorId,
        platformFee,
        creatorAmount,
        currency: creatorCurrency, // ✅ NEW: Include currency in metadata
      },
    });

    const processingTime = Date.now() - startTime;

    // Log payment intent creation success (SystemLog)
    await logPaymentEvent(
      'INITIATED',
      payment.id,
      user.userId,
      amount,
      creatorCurrency,
      LogLevel.INFO,
      {
        paymentId: payment.id,
        bookingId: booking.id,
        creatorId: booking.callOffer.creatorId,
        paymentIntentId: paymentIntent.id,
        amount,
        currency: creatorCurrency,
        platformFee,
        creatorAmount,
        processingTimeMs: processingTime,
        useStripeConnect: useStripeConnect,
      }
    );

    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        currency: creatorCurrency, // ✅ NEW: Return currency to frontend
        amount: amount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Create payment intent error:', error);

    // Log API error
    const user = await getUserFromRequest(request).catch(() => null);
    await logApiError(
      '/api/payments/create-intent',
      error instanceof Error ? error : 'Unknown error',
      LogActor.USER,
      user?.userId,
      {
        action: 'CREATE_PAYMENT_INTENT',
        errorType: error instanceof z.ZodError ? 'validation' : 'unknown',
        processingTimeMs: Date.now() - startTime,
      }
    );

    if (error instanceof z.ZodError) {
      await logError(
        'PAYMENT_INTENT_VALIDATION_ERROR',
        LogActor.USER,
        'Erreur de validation lors de la création du payment intent',
        user?.userId,
        {
          validationErrors: error.issues,
        }
      );
      
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

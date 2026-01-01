import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { createPaymentIntent } from '@/lib/stripe'; // ✅ CORRECTION #2: Suppression de calculateFees (obsolète)
import { getPlatformSettings } from '@/lib/settings';
import { logPayment } from '@/lib/logger';
import { logInfo, logError, logPaymentEvent, logApiError } from '@/lib/system-logger';
import { TransactionEventType, LogActor, LogStatus } from '@prisma/client';

// ✅ REFACTORED: Accept callOfferId instead of bookingId
// The booking will be created ONLY after payment confirmation (webhook)
const createIntentSchema = z.object({
  callOfferId: z.string().cuid(),
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
      'Création de payment intent initiée (nouveau flux)',
      user.userId,
      {
        callOfferId: validatedData.callOfferId,
      }
    );

    // Get platform settings
    const settings = await getPlatformSettings();

    // ✅ CRITICAL: Check if CallOffer is available BEFORE creating payment intent
    const callOffer = await db.callOffer.findUnique({
      where: { id: validatedData.callOfferId },
      include: {
        booking: true, // Check if already booked
        creator: {
          select: {
            id: true,
            userId: true,
            stripeAccountId: true,
            isStripeOnboarded: true,
            currency: true,
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
    });

    if (!callOffer) {
      await logError(
        'PAYMENT_INTENT_OFFER_NOT_FOUND',
        LogActor.USER,
        'Tentative de paiement pour une offre introuvable',
        user.userId,
        { callOfferId: validatedData.callOfferId }
      );
      
      return NextResponse.json(
        { error: 'Offre introuvable' },
        { status: 404 }
      );
    }

    // ✅ CRITICAL: Verify CallOffer is AVAILABLE (not booked yet)
    if (callOffer.status !== 'AVAILABLE') {
      await logError(
        'PAYMENT_INTENT_OFFER_NOT_AVAILABLE',
        LogActor.USER,
        'Tentative de paiement pour une offre déjà réservée',
        user.userId,
        {
          callOfferId: validatedData.callOfferId,
          offerStatus: callOffer.status,
        }
      );
      
      return NextResponse.json(
        { error: 'Cette offre n\'est plus disponible' },
        { status: 400 }
      );
    }

    // ✅ CRITICAL: Check if booking already exists
    if (callOffer.booking) {
      await logError(
        'PAYMENT_INTENT_OFFER_ALREADY_BOOKED',
        LogActor.USER,
        'Tentative de paiement pour une offre déjà réservée (booking exists)',
        user.userId,
        {
          callOfferId: validatedData.callOfferId,
          existingBookingId: callOffer.booking.id,
        }
      );
      
      return NextResponse.json(
        { error: 'This time slot is already booked. Please choose another time.' },
        { status: 409 }
      );
    }

    // ✅ Check if call is in the future
    if (new Date(callOffer.dateTime) < new Date()) {
      await logError(
        'PAYMENT_INTENT_OFFER_EXPIRED',
        LogActor.USER,
        'Tentative de paiement pour une offre expirée',
        user.userId,
        {
          callOfferId: validatedData.callOfferId,
          dateTime: callOffer.dateTime,
        }
      );
      
      return NextResponse.json(
        { error: 'Cette offre est expirée' },
        { status: 400 }
      );
    }

    // ✅ Calculate fees using platform settings with validation
    const { 
      safeToNumber, 
      validatePositiveAmount,
      calculatePlatformFee,
      calculateCreatorAmount,
      logPriceCalculation 
    } = await import('@/lib/price-validation');

    let amount: number;
    let platformFeePercentage: number;
    let platformFeeFixed: number;
    let platformFee: number;
    let creatorAmount: number;

    try {
      // Convert and validate all price values
      amount = safeToNumber(callOffer.price, 'callOffer.price');
      platformFeePercentage = safeToNumber(settings.platformFeePercentage, 'settings.platformFeePercentage');
      platformFeeFixed = settings.platformFeeFixed ? safeToNumber(settings.platformFeeFixed, 'settings.platformFeeFixed') : 0;
      
      validatePositiveAmount(amount, 'amount');
      
      // Calculate fees safely
      platformFee = calculatePlatformFee(amount, platformFeePercentage, platformFeeFixed);
      creatorAmount = calculateCreatorAmount(amount, platformFee);

      // Log for debugging
      logPriceCalculation('create-intent', {
        callOfferId: callOffer.id,
        rawPrice: callOffer.price,
        amount,
        platformFeePercentage,
        platformFeeFixed,
        platformFee,
        creatorAmount,
      });
    } catch (validationError) {
      console.error('[create-intent] Price validation error:', validationError);
      
      await logError(
        'PAYMENT_INTENT_PRICE_VALIDATION_ERROR',
        LogActor.USER,
        'Erreur de validation des prix',
        user.userId,
        {
          callOfferId: callOffer.id,
          rawPrice: callOffer.price,
          platformFeePercentage: settings.platformFeePercentage,
          platformFeeFixed: settings.platformFeeFixed,
          error: validationError instanceof Error ? validationError.message : String(validationError),
        }
      );
      
      return NextResponse.json(
        { error: 'Erreur de calcul du prix. Veuillez réessayer.' },
        { status: 500 }
      );
    }

    const creator = callOffer.creator;
    const useStripeConnect = creator.isStripeOnboarded && creator.stripeAccountId;

    // ✅ NEW: Use creator's currency instead of platform currency
    const creatorCurrency = (creator.currency || 'EUR').toUpperCase();

    // ✅ REFACTORED: Create payment intent with metadata for booking creation in webhook
    const paymentIntent = await createPaymentIntent({
      amount,
      currency: creatorCurrency.toLowerCase(),
      metadata: {
        // ✅ CRITICAL: Store all data needed to create booking in webhook
        callOfferId: callOffer.id,
        userId: user.userId,
        creatorId: callOffer.creatorId,
        currency: creatorCurrency,
        platformFee: platformFee.toFixed(2),
        creatorAmount: creatorAmount.toFixed(2),
        useStripeConnect: (useStripeConnect ?? false).toString(),
        totalPrice: amount.toFixed(2),
        // Flow indicator
        bookingFlow: 'payment_first', // Indicates new flow
      },
      stripeAccountId: useStripeConnect ? creator.stripeAccountId : null,
      platformFeePercentage: platformFeePercentage,
    });

    const processingTime = Date.now() - startTime;

    // ✅ DO NOT create booking or payment record yet - only after payment confirmation
    // Log payment intent creation success
    await logInfo(
      'PAYMENT_INTENT_CREATED_SUCCESS',
      LogActor.USER,
      'Payment intent créé avec succès (booking sera créé après paiement)',
      user.userId,
      {
        callOfferId: callOffer.id,
        creatorId: callOffer.creatorId,
        paymentIntentId: paymentIntent.id,
        amount,
        currency: creatorCurrency,
        platformFee,
        creatorAmount,
        processingTimeMs: processingTime,
        useStripeConnect: useStripeConnect,
        flow: 'payment_first',
      }
    );

    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        currency: creatorCurrency,
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
      {
        actor: LogActor.USER,
        actorId: user?.userId,
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

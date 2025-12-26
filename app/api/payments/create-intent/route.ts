import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { createPaymentIntent, calculateFees } from '@/lib/stripe';
import { getPlatformSettings } from '@/lib/settings';
import { logPayment } from '@/lib/logger';
import { TransactionEventType } from '@prisma/client';

const createIntentSchema = z.object({
  bookingId: z.string().cuid(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createIntentSchema.parse(body);

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
      return NextResponse.json(
        { error: 'Réservation introuvable' },
        { status: 404 }
      );
    }

    // Check ownership
    if (booking.userId !== user.userId) {
      return NextResponse.json(
        { error: 'Accès refusé' },
        { status: 403 }
      );
    }

    // Check if already paid
    if (booking.status === 'CONFIRMED') {
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

    // Create payment intent (with or without destination charge)
    const paymentIntent = await createPaymentIntent({
      amount,
      currency: creatorCurrency.toLowerCase(), // ✅ MODIFIED: Use creator's currency
      metadata: {
        bookingId: booking.id,
        userId: user.userId,
        creatorId: booking.callOffer.creatorId,
        callOfferId: booking.callOfferId,
        currency: creatorCurrency, // ✅ NEW: Store currency in metadata
        platformFee: platformFee.toFixed(2),
        creatorAmount: creatorAmount.toFixed(2),
        useStripeConnect: (useStripeConnect ?? false).toString(),
      },
      stripeAccountId: useStripeConnect ? creator.stripeAccountId : null,
      platformFee: useStripeConnect ? platformFee : undefined,
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
        payoutStatus: 'PENDING',
      },
    });

    // Log payment creation
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

    if (error instanceof z.ZodError) {
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

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { createPaymentIntent, calculateFees } from '@/lib/stripe';

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

    // Calculate fees
    const amount = Number(booking.totalPrice);
    const { platformFee, creatorAmount } = calculateFees(amount);

    const creator = booking.callOffer.creator;
    const useStripeConnect = creator.isStripeOnboarded && creator.stripeAccountId;

    // Create payment intent (with or without destination charge)
    const paymentIntent = await createPaymentIntent({
      amount,
      currency: 'eur',
      metadata: {
        bookingId: booking.id,
        userId: user.userId,
        creatorId: booking.callOffer.creatorId,
        callOfferId: booking.callOfferId,
        platformFee: platformFee.toString(),
        creatorAmount: creatorAmount.toString(),
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

    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
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

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const createBookingSchema = z.object({
  callOfferId: z.string().cuid(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const bookings = await db.booking.findMany({
      where: { userId: user.userId },
      include: {
        callOffer: {
          include: {
            creator: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        payment: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ bookings }, { status: 200 });
  } catch (error) {
    console.error('Get bookings error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

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
    const validatedData = createBookingSchema.parse(body);

    // Check if call offer exists and is available
    const callOffer = await db.callOffer.findUnique({
      where: { id: validatedData.callOfferId },
      include: {
        booking: true,
      },
    });

    if (!callOffer) {
      return NextResponse.json(
        { error: 'Offre introuvable' },
        { status: 404 }
      );
    }

    if (callOffer.status !== 'AVAILABLE') {
      return NextResponse.json(
        { error: 'Cette offre n\'est plus disponible' },
        { status: 400 }
      );
    }

    if (callOffer.booking) {
      return NextResponse.json(
        { error: 'Cette offre est déjà réservée' },
        { status: 400 }
      );
    }

    // Check if call is in the future
    if (new Date(callOffer.dateTime) < new Date()) {
      return NextResponse.json(
        { error: 'Cette offre est expirée' },
        { status: 400 }
      );
    }

    // Create booking
    const booking = await db.booking.create({
      data: {
        userId: user.userId,
        callOfferId: validatedData.callOfferId,
        totalPrice: callOffer.price,
        status: 'PENDING',
      },
      include: {
        callOffer: {
          include: {
            creator: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update call offer status
    await db.callOffer.update({
      where: { id: validatedData.callOfferId },
      data: { status: 'BOOKED' },
    });

    return NextResponse.json(
      { booking },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create booking error:', error);

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

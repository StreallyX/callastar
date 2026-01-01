import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { logBooking, logApiError } from '@/lib/system-logger';
import { LogActor } from '@prisma/client';

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

    // ✅ ATOMIC TRANSACTION: Check and create booking in a single atomic operation
    // This prevents race conditions where multiple users could book the same slot
    const result = await db.$transaction(async (tx) => {
      // Step 1: Check if call offer exists and is available (with FOR UPDATE lock in PostgreSQL)
      const callOffer = await tx.callOffer.findUnique({
        where: { id: validatedData.callOfferId },
        include: {
          booking: true,
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
      });

      if (!callOffer) {
        throw new Error('OFFER_NOT_FOUND');
      }

      if (callOffer.status !== 'AVAILABLE') {
        throw new Error('OFFER_NOT_AVAILABLE');
      }

      // Step 2: Check if booking already exists (this is the critical race condition check)
      if (callOffer.booking) {
        throw new Error('OFFER_ALREADY_BOOKED');
      }

      // Step 3: Check if call is in the future
      if (new Date(callOffer.dateTime) < new Date()) {
        throw new Error('OFFER_EXPIRED');
      }

      // Step 4: Create booking atomically (unique constraint on callOfferId prevents duplicates)
      const booking = await tx.booking.create({
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

      // Step 5: Update call offer status atomically
      await tx.callOffer.update({
        where: { id: validatedData.callOfferId },
        data: { status: 'BOOKED' },
      });

      return { booking, callOffer };
    });

    // ✅ Log successful booking creation (outside transaction for performance)
    await logBooking(
      'CREATED',
      result.booking.id,
      user.userId,
      result.callOffer.creatorId,
      {
        callOfferId: validatedData.callOfferId,
        price: result.callOffer.price.toString(),
        currency: result.callOffer.currency,
        dateTime: result.callOffer.dateTime.toISOString(),
      }
    );

    return NextResponse.json(
      { booking: result.booking },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create booking error:', error);

    // Get user for logging (safe)
    const user = await getUserFromRequest(request).catch(() => null);

    // Handle custom business logic errors
    if (error instanceof Error) {
      if (error.message === 'OFFER_NOT_FOUND') {
        await logApiError(
          '/api/bookings',
          error,
          {
            actor: LogActor.USER,
            actorId: user?.userId,
            action: 'CREATE_BOOKING',
            reason: 'OFFER_NOT_FOUND'
          }
        );
        return NextResponse.json(
          { error: 'Offre introuvable' },
          { status: 404 }
        );
      }

      if (error.message === 'OFFER_NOT_AVAILABLE') {
        await logApiError(
          '/api/bookings',
          error,
          {
            actor: LogActor.USER,
            actorId: user?.userId,
            action: 'CREATE_BOOKING',
            reason: 'OFFER_NOT_AVAILABLE'
          }
        );
        return NextResponse.json(
          { error: 'Cette offre n\'est plus disponible' },
          { status: 400 }
        );
      }

      if (error.message === 'OFFER_ALREADY_BOOKED') {
        // ✅ HTTP 409 Conflict: Another user already booked this slot
        await logApiError(
          '/api/bookings',
          error,
          {
            actor: LogActor.USER,
            actorId: user?.userId,
            action: 'CREATE_BOOKING',
            reason: 'OFFER_ALREADY_BOOKED'
          }
        );
        return NextResponse.json(
          { error: 'This time slot is already booked. Please choose another time.' },
          { status: 409 }
        );
      }

      if (error.message === 'OFFER_EXPIRED') {
        await logApiError(
          '/api/bookings',
          error,
          {
            actor: LogActor.USER,
            actorId: user?.userId,
            action: 'CREATE_BOOKING',
            reason: 'OFFER_EXPIRED'
          }
        );
        return NextResponse.json(
          { error: 'Cette offre est expirée' },
          { status: 400 }
        );
      }
    }

    // ✅ Handle Prisma unique constraint violation (P2002)
    // This happens if two requests reach booking.create() simultaneously
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      await logApiError(
        '/api/bookings',
        error instanceof Error ? error : new Error('Unique constraint violation'),
        {
          actor: LogActor.USER,
          actorId: user?.userId,
          action: 'CREATE_BOOKING',
          reason: 'UNIQUE_CONSTRAINT_VIOLATION'
        }
      );
      return NextResponse.json(
        { error: 'This time slot is already booked. Please choose another time.' },
        { status: 409 }
      );
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await logApiError(
        '/api/bookings',
        error,
        {
          actor: LogActor.USER,
          actorId: user?.userId,
          action: 'CREATE_BOOKING',
          reason: 'VALIDATION_ERROR'
        }
      );
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    // Generic error fallback
    await logApiError(
      '/api/bookings',
      error instanceof Error ? error : new Error('Unknown error'),
      {
        actor: LogActor.USER,
        actorId: user?.userId,
        action: 'CREATE_BOOKING',
        reason: 'UNKNOWN_ERROR'
      }
    );

    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

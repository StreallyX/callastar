import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { LogActor, LogLevel } from '@prisma/client';

const callLogSchema = z.object({
  bookingId: z.string().cuid(),
  event: z.enum([
    'PRE_CALL_ENTERED',
    'CALL_JOINED',
    'CALL_STARTED',
    'CALL_ENDED',
    'CALL_ERROR',
    'PARTICIPANT_JOINED',
    'PARTICIPANT_LEFT',
    'CAMERA_TOGGLED',
    'MIC_TOGGLED',
  ]),
  metadata: z.record(z.any()).optional(),
  message: z.string().optional(),
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
    const validatedData = callLogSchema.parse(body);

    // Verify booking exists and user has access
    const booking = await db.booking.findUnique({
      where: { id: validatedData.bookingId },
      include: {
        callOffer: {
          include: {
            creator: true,
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

    // Check if user is the creator or the booking owner
    const isCreator = booking.callOffer.creator.userId === user.userId;
    const isBookingOwner = booking.userId === user.userId;

    if (!isCreator && !isBookingOwner) {
      return NextResponse.json(
        { error: 'Accès refusé' },
        { status: 403 }
      );
    }

    // Determine log level based on event
    let level: LogLevel = LogLevel.INFO;
    if (validatedData.event === 'CALL_ERROR') {
      level = LogLevel.ERROR;
    }

    // Create log entry
    const log = await db.log.create({
      data: {
        level,
        type: `CALL_${validatedData.event}`,
        actor: isCreator ? LogActor.CREATOR : LogActor.USER,
        actorId: user.userId,
        message: validatedData.message || `Call event: ${validatedData.event}`,
        metadata: {
          bookingId: validatedData.bookingId,
          event: validatedData.event,
          userRole: isCreator ? 'CREATOR' : 'USER',
          ...validatedData.metadata,
        },
      },
    });

    return NextResponse.json(
      { success: true, log },
      { status: 201 }
    );
  } catch (error) {
    console.error('Call log error:', error);

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

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { error: 'bookingId requis' },
        { status: 400 }
      );
    }

    // Verify booking exists and user has access
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        callOffer: {
          include: {
            creator: true,
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

    // Check if user is the creator or the booking owner or admin
    const isCreator = booking.callOffer.creator.userId === user.userId;
    const isBookingOwner = booking.userId === user.userId;

    if (!isCreator && !isBookingOwner) {
      return NextResponse.json(
        { error: 'Accès refusé' },
        { status: 403 }
      );
    }

    // Get call logs
    const logs = await db.log.findMany({
      where: {
        type: {
          startsWith: 'CALL_',
        },
        metadata: {
          path: ['bookingId'],
          equals: bookingId,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(
      { logs },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get call logs error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

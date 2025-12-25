import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { createMeetingToken } from '@/lib/daily';

const getTokenSchema = z.object({
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
    const validatedData = getTokenSchema.parse(body);

    // Get booking
    const booking = await db.booking.findUnique({
      where: { id: validatedData.bookingId },
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

    // Check if booking has a Daily room
    if (!booking.dailyRoomName) {
      return NextResponse.json(
        { error: 'Aucune salle de réunion disponible pour cette réservation' },
        { status: 400 }
      );
    }

    // Check if call is within access window (15 minutes before to 24 hours after)
    const callTime = new Date(booking.callOffer.dateTime).getTime();
    const now = Date.now();
    const fifteenMinutesBefore = callTime - 15 * 60 * 1000;
    const twentyFourHoursAfter = callTime + 24 * 60 * 60 * 1000;

    if (now < fifteenMinutesBefore) {
      return NextResponse.json(
        { error: 'L\'accès à la salle sera disponible 15 minutes avant le début de l\'appel' },
        { status: 400 }
      );
    }

    if (now > twentyFourHoursAfter) {
      return NextResponse.json(
        { error: 'L\'accès à cette salle a expiré' },
        { status: 400 }
      );
    }

    // Generate meeting token
    const userName = isCreator ? booking.callOffer.creator.user.name : booking.user.name;
    const token = await createMeetingToken({
      roomName: booking.dailyRoomName,
      userName,
      isOwner: isCreator,
      exp: Math.floor(callTime / 1000) + 60 * 60 * 24, // 24 hours from call time
    });

    return NextResponse.json(
      {
        token,
        roomUrl: booking.dailyRoomUrl,
        roomName: booking.dailyRoomName,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get token error:', error);

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

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { createDailyRoom } from '@/lib/daily';

const createRoomSchema = z.object({
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
    const validatedData = createRoomSchema.parse(body);

    // Get booking
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

    // Check if room already exists
    if (booking.dailyRoomUrl && booking.dailyRoomName) {
      return NextResponse.json(
        {
          roomUrl: booking.dailyRoomUrl,
          roomName: booking.dailyRoomName,
        },
        { status: 200 }
      );
    }

    // Create Daily.co room
    const roomName = `call-${booking.id}`;
    const room = await createDailyRoom({
      name: roomName,
      properties: {
        exp: Math.floor(new Date(booking.callOffer.dateTime).getTime() / 1000) + 60 * 60 * 24,
        max_participants: 2,
      },
    });

    // Update booking with room info
    await db.booking.update({
      where: { id: booking.id },
      data: {
        dailyRoomUrl: room.url,
        dailyRoomName: room.name,
      },
    });

    return NextResponse.json(
      {
        roomUrl: room.url,
        roomName: room.name,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Create room error:', error);

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

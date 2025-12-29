import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * API Route pour récupérer l'heure de début réelle d'un appel
 * 
 * Retourne :
 * - realStartTime: L'heure du premier CALL_JOIN (premier participant à rejoindre)
 * - scheduledStartTime: L'heure prévue du booking
 * - hasStarted: Boolean indiquant si l'appel a déjà commencé
 * - isFirstParticipant: Boolean indiquant si le requérant serait le premier participant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> | { bookingId: string } }
) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Resolve params
    const resolvedParams = params instanceof Promise ? await params : params;
    const { bookingId } = resolvedParams;

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

    // Check if user is the creator or the booking owner
    const isCreator = booking.callOffer.creator.userId === user.userId;
    const isBookingOwner = booking.userId === user.userId;

    if (!isCreator && !isBookingOwner) {
      return NextResponse.json(
        { error: 'Accès refusé' },
        { status: 403 }
      );
    }

    // Get the first CALL_JOIN or CALL_START event from logs
    const firstJoinLog = await db.log.findFirst({
      where: {
        OR: [
          {
            type: 'CALL_CALL_JOIN',
            metadata: {
              path: ['bookingId'],
              equals: bookingId,
            },
          },
          {
            type: 'CALL_CALL_START',
            metadata: {
              path: ['bookingId'],
              equals: bookingId,
            },
          },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const scheduledStartTime = new Date(booking.callOffer.dateTime);
    const hasStarted = !!firstJoinLog;
    const realStartTime = firstJoinLog ? firstJoinLog.createdAt : null;
    const isFirstParticipant = !hasStarted;

    return NextResponse.json(
      {
        realStartTime: realStartTime?.toISOString() || null,
        scheduledStartTime: scheduledStartTime.toISOString(),
        hasStarted,
        isFirstParticipant,
        scheduledDuration: booking.callOffer.duration, // en minutes
        isTestBooking: booking.isTestBooking || false,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get call start time error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

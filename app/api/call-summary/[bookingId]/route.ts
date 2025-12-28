import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

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

    // Handle both Promise and plain object params (Next.js 14+ compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const bookingId = resolvedParams.bookingId;

    // Get booking details
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
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

    // Get call logs to calculate actual duration
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

    // Find call start and end times
    const startLog = logs.find(log => log.type === 'CALL_CALL_STARTED');
    const endLog = logs.find(log => log.type === 'CALL_CALL_ENDED');

    let actualDuration = 0;
    let startTime = null;
    let endTime = null;
    let callStatus = 'unknown';

    if (startLog && endLog) {
      startTime = startLog.createdAt;
      endTime = endLog.createdAt;
      actualDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000); // in seconds
      callStatus = 'completed';
    } else if (startLog && !endLog) {
      callStatus = 'interrupted';
      startTime = startLog.createdAt;
      actualDuration = Math.floor((Date.now() - startTime.getTime()) / 1000);
    } else {
      callStatus = 'no-show';
    }

    const summary = {
      booking: {
        id: booking.id,
        status: booking.status,
        createdAt: booking.createdAt,
      },
      callOffer: {
        title: booking.callOffer.title,
        scheduledDateTime: booking.callOffer.dateTime,
        scheduledDuration: booking.callOffer.duration,
      },
      participants: {
        creator: {
          name: booking.callOffer.creator.user.name,
          id: booking.callOffer.creator.user.id,
        },
        user: {
          name: booking.user.name,
          id: booking.user.id,
        },
      },
      callDetails: {
        actualStartTime: startTime,
        actualEndTime: endTime,
        actualDuration, // in seconds
        scheduledDuration: booking.callOffer.duration * 60, // in seconds
        status: callStatus,
      },
      logs: logs.map(log => ({
        event: log.type,
        timestamp: log.createdAt,
        actor: log.actor,
      })),
    };

    return NextResponse.json(
      { summary },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get call summary error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

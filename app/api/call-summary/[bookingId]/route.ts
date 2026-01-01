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
        type: 'CALL_EVENT',
        context: {
          path: ['bookingId'],
          equals: bookingId,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Calculer la durée totale cumulée à partir des sessions
    // Une session = CALL_JOIN -> CALL_LEAVE (ou SESSION_START -> SESSION_END)
    // On supporte aussi l'ancien format CALL_STARTED -> CALL_ENDED
    
    interface CallSession {
      start: Date;
      end: Date | null;
      actorId: string | null;
      duration: number; // en secondes
    }
    
    const sessions: CallSession[] = [];
    const sessionMap = new Map<string, { start: Date; actorId: string | null }>();
    
    let firstStartTime: Date | null = null;
    let lastEndTime: Date | null = null;
    
    // Parser les logs pour identifier les sessions
    for (const log of logs) {
      const context = log.context as any;
      const actorId = context?.actorId || 'unknown';
      const logTime = log.createdAt;
      const event = context?.event;
      
      // Événements de début de session
      if (
        event === 'CALL_JOIN' || 
        event === 'SESSION_START' || 
        event === 'CALL_JOINED' ||
        event === 'CALL_STARTED'
      ) {
        if (!sessionMap.has(actorId)) {
          sessionMap.set(actorId, { start: logTime, actorId });
          if (!firstStartTime) {
            firstStartTime = logTime;
          }
        }
      }
      
      // Événements de fin de session
      if (
        event === 'CALL_LEAVE' ||
        event === 'SESSION_END' ||
        event === 'DISCONNECTION_VOLUNTARY' ||
        event === 'DISCONNECTION_INVOLUNTARY' ||
        event === 'CALL_ENDED'
      ) {
        const sessionStart = sessionMap.get(actorId);
        if (sessionStart) {
          const duration = Math.floor((logTime.getTime() - sessionStart.start.getTime()) / 1000);
          sessions.push({
            start: sessionStart.start,
            end: logTime,
            actorId: sessionStart.actorId,
            duration,
          });
          sessionMap.delete(actorId);
          lastEndTime = logTime;
        }
      }
    }
    
    // Gérer les sessions non terminées (encore en cours ou crash)
    for (const [actorId, sessionStart] of sessionMap.entries()) {
      const duration = Math.floor((Date.now() - sessionStart.start.getTime()) / 1000);
      sessions.push({
        start: sessionStart.start,
        end: null,
        actorId: sessionStart.actorId,
        duration,
      });
    }
    
    // Calculer la durée totale cumulée
    const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0);
    
    // Déterminer le statut
    let callStatus = 'unknown';
    if (sessions.length === 0) {
      callStatus = 'no-show';
    } else if (sessions.some(s => s.end === null)) {
      callStatus = 'in-progress';
    } else if (sessions.length > 1) {
      callStatus = 'completed-multiple-sessions';
    } else {
      callStatus = 'completed';
    }
    
    // Pour compatibilité avec l'ancien format
    const startTime = firstStartTime;
    const endTime = lastEndTime;
    const actualDuration = totalDuration;

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
        actualDuration, // in seconds (durée totale cumulée)
        scheduledDuration: booking.callOffer.duration * 60, // in seconds
        status: callStatus,
        sessionsCount: sessions.length,
        sessions: sessions.map(s => ({
          start: s.start,
          end: s.end,
          duration: s.duration,
          actorId: s.actorId,
        })),
      },
      logs: logs.map(log => {
        const context = log.context as any;
        return {
          event: context?.event || log.type,
          timestamp: log.createdAt,
          actor: context?.actor,
          actorId: context?.actorId,
          metadata: context,
        };
      }),
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

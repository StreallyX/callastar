import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { LogType, LogStatus } from '@prisma/client';

// Événements d'appel enrichis pour tracking complet
const callLogSchema = z.object({
  bookingId: z.string().cuid(),
  callId: z.string().optional(), // ID de session Daily.co
  event: z.enum([
    // Lifecycle events
    'PRE_CALL_ENTERED',
    'CALL_JOIN', // Participant entre dans la room
    'CALL_LEAVE', // Participant quitte la room (volontaire ou non)
    'CALL_RECONNECT', // Participant se reconnecte après déconnexion
    'CALL_START', // Premier participant démarre effectivement l'appel
    'CALL_END', // Appel réellement terminé
    'CALL_ERROR', // Erreur technique
    
    // Session events
    'SESSION_START', // Début d'une session d'appel
    'SESSION_END', // Fin d'une session d'appel
    
    // Participant events
    'PARTICIPANT_JOINED',
    'PARTICIPANT_LEFT',
    'PARTICIPANT_RECONNECTED',
    
    // Media events
    'CAMERA_TOGGLED',
    'MIC_TOGGLED',
    'SCREEN_SHARE_STARTED',
    'SCREEN_SHARE_STOPPED',
    
    // UI events
    'SUMMARY_VIEW', // Consultation du summary
    'FULLSCREEN_ENTERED',
    'FULLSCREEN_EXITED',
    
    // Disconnection events
    'DISCONNECTION_VOLUNTARY', // Déconnexion volontaire (bouton quitter)
    'DISCONNECTION_INVOLUNTARY', // Déconnexion involontaire (perte réseau, crash, etc.)
    
    // Legacy events (maintien de la compatibilité)
    'CALL_JOINED',
    'CALL_STARTED',
    'CALL_ENDED',
  ]),
  metadata: z.record(z.string(), z.any()).optional(),
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
    
    // Validate that body exists and is an object
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Données invalides - corps de requête manquant' },
        { status: 400 }
      );
    }

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

    // Determine log status based on event
    const status = validatedData.event === 'CALL_ERROR' ? LogStatus.ERROR : LogStatus.SUCCESS;

    // Create log entry
    const log = await db.log.create({
      data: {
        type: LogType.CALL_EVENT,
        status,
        message: validatedData.message || `Call event: ${validatedData.event}`,
        context: {
          bookingId: validatedData.bookingId,
          callId: validatedData.callId || null,
          event: validatedData.event,
          actor: isCreator ? 'CREATOR' : 'USER',
          actorId: user.userId,
          userRole: isCreator ? 'CREATOR' : 'USER',
          userName: (user as any).name || 'Unknown',
          timestamp: new Date().toISOString(),
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
        type: LogType.CALL_EVENT,
        context: {
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

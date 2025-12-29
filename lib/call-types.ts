/**
 * Types et helpers pour la gestion des appels
 */

// États d'un appel
export enum CallState {
  WAITING = 'WAITING', // En attente (avant 15min avant l'heure)
  ACTIVE = 'ACTIVE', // Appel actif
  PAUSED = 'PAUSED', // Appel en pause (déconnexion temporaire)
  ENDED = 'ENDED', // Appel terminé
}

// Événements d'appel
export type CallEventType =
  // Lifecycle events
  | 'PRE_CALL_ENTERED'
  | 'CALL_JOIN'
  | 'CALL_LEAVE'
  | 'CALL_RECONNECT'
  | 'CALL_START'
  | 'CALL_END'
  | 'CALL_ERROR'
  // Session events
  | 'SESSION_START'
  | 'SESSION_END'
  // Participant events
  | 'PARTICIPANT_JOINED'
  | 'PARTICIPANT_LEFT'
  | 'PARTICIPANT_RECONNECTED'
  // Media events
  | 'CAMERA_TOGGLED'
  | 'MIC_TOGGLED'
  | 'SCREEN_SHARE_STARTED'
  | 'SCREEN_SHARE_STOPPED'
  // UI events
  | 'SUMMARY_VIEW'
  | 'FULLSCREEN_ENTERED'
  | 'FULLSCREEN_EXITED'
  // Disconnection events
  | 'DISCONNECTION_VOLUNTARY'
  | 'DISCONNECTION_INVOLUNTARY'
  // Legacy events
  | 'CALL_JOINED'
  | 'CALL_STARTED'
  | 'CALL_ENDED';

// Métadonnées d'un événement
export interface CallEventMetadata {
  bookingId: string;
  callId?: string;
  timestamp: string;
  [key: string]: any;
}

// Structure d'une session d'appel
export interface CallSession {
  id: string;
  bookingId: string;
  callId: string;
  startTime: Date;
  endTime: Date | null;
  duration: number; // en secondes
  participantId: string;
  disconnectionType?: 'voluntary' | 'involuntary';
}

// Helper pour logger un événement d'appel
export async function logCallEvent(
  bookingId: string,
  event: CallEventType,
  metadata?: Partial<CallEventMetadata>
): Promise<void> {
  try {
    await fetch('/api/call-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        event,
        metadata: {
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      }),
    });
  } catch (error) {
    console.error('Failed to log call event:', event, error);
  }
}

// Helper pour calculer la durée totale d'appel à partir des logs
export function calculateTotalDuration(logs: any[]): number {
  const sessions: { start: Date; end: Date | null; actorId: string }[] = [];
  const sessionMap = new Map<string, { start: Date; actorId: string }>();

  for (const log of logs) {
    const actorId = log.actorId || 'unknown';
    const logTime = new Date(log.createdAt);

    // Événements de début de session
    if (
      log.type.includes('CALL_JOIN') ||
      log.type.includes('SESSION_START') ||
      log.type.includes('CALL_STARTED')
    ) {
      if (!sessionMap.has(actorId)) {
        sessionMap.set(actorId, { start: logTime, actorId });
      }
    }

    // Événements de fin de session
    if (
      log.type.includes('CALL_LEAVE') ||
      log.type.includes('SESSION_END') ||
      log.type.includes('DISCONNECTION') ||
      log.type.includes('CALL_ENDED')
    ) {
      const sessionStart = sessionMap.get(actorId);
      if (sessionStart) {
        sessions.push({
          start: sessionStart.start,
          end: logTime,
          actorId: sessionStart.actorId,
        });
        sessionMap.delete(actorId);
      }
    }
  }

  // Calculer la durée totale
  let totalSeconds = 0;
  for (const session of sessions) {
    if (session.end) {
      totalSeconds += Math.floor((session.end.getTime() - session.start.getTime()) / 1000);
    }
  }

  return totalSeconds;
}

// Helper pour formater une durée en secondes
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${mins.toString().padStart(2, '0')}min ${secs.toString().padStart(2, '0')}s`;
  }
  return `${mins}min ${secs.toString().padStart(2, '0')}s`;
}

// Helper pour déterminer si une déconnexion est involontaire
export function isInvoluntaryDisconnection(
  event: string,
  metadata?: any
): boolean {
  // Indicateurs de déconnexion involontaire
  const involuntaryIndicators = [
    'network-error',
    'connection-lost',
    'timeout',
    'crash',
    'page-unload-unexpected',
  ];

  if (event === 'DISCONNECTION_INVOLUNTARY') {
    return true;
  }

  if (metadata?.reason) {
    return involuntaryIndicators.some(indicator =>
      metadata.reason.toLowerCase().includes(indicator)
    );
  }

  return false;
}

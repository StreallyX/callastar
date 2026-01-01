// ==============================
// app/[locale]/call/[bookingId]/components/CallInterface.tsx
// ==============================
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DailyIframe from '@daily-co/daily-js';
import { logCallEvent } from '@/lib/call-types';
import { useTranslations } from 'next-intl';

interface CallInterfaceProps {
  booking: any;
  bookingId: string;
  roomUrl: string;
  token: string;
  onCallEnd: () => void;
  startTime: Date;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export function CallInterface({ booking, bookingId, roomUrl, token, onCallEnd, startTime }: CallInterfaceProps) {
  const { toast } = useToast();
  const t = useTranslations('call.room');

  // ⚠️ Typage Daily variable selon version => ref "any" pour éviter les erreurs TS bloquantes
  const callFrameRef = useRef<any>(null);
  const callContainerRef = useRef<HTMLDivElement>(null);
  const hasLoggedJoinRef = useRef(false);

  const [callId, setCallId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [isReconnecting, setIsReconnecting] = useState(false);

  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const hasStartedRef = useRef(false);
  const hasAutoEndedRef = useRef(false);
  const earlyAccessMinutes = 15;
  const [hasJoined, setHasJoined] = useState(false);
  const cleanupDoneRef = useRef(false);
  const joinInProgressRef = useRef(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const isConnecting = connectionState === 'connecting';
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);



  const callStartTs = useMemo(() => {
    const ts = new Date(booking?.callOffer?.dateTime).getTime();
    return Number.isFinite(ts) ? ts : 0;
  }, [booking?.callOffer?.dateTime]);

  const scheduledDurationSec = useMemo(() => {
    const minutes = Number(booking?.callOffer?.duration ?? 0);
    return Math.max(0, minutes) * 60;
  }, [booking?.callOffer?.duration]);

  const accessOpenTs = useMemo(() => callStartTs - earlyAccessMinutes * 60 * 1000, [callStartTs]);

  const isTooEarly = nowTs < accessOpenTs;
  const isWithinEarlyAccess = nowTs >= accessOpenTs && nowTs < callStartTs;
  const hasOfficiallyStarted = nowTs >= callStartTs;
  const canJoin = !isTooEarly && !hasJoined && !isConnecting;
  const canShowNetworkError = hasOfficiallyStarted && (connectionState === 'disconnected' || connectionState === 'reconnecting');

  const countdownToStartSec = Math.max(0, Math.floor((callStartTs - nowTs) / 1000));
  const countdownToAccessSec = Math.max(0, Math.floor((accessOpenTs - nowTs) / 1000));

  const formatTime = useCallback((seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    // ⏳ Timer UNIQUEMENT avant le join (countdown)
    if (hasJoined) return;

    const id = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, [hasJoined]);

  useEffect(() => {
    const dailyCallId = roomUrl?.split('/').filter(Boolean).pop() || null;
    setCallId(dailyCallId);
  }, [roomUrl]);

  const handleJoinedMeeting = useCallback(async (event?: any) => {
    setConnectionState('connected');
    setIsReconnecting(false);
    setHasJoined(true);

    await logCallEvent(bookingId, 'SESSION_START', {
      callId: callId || undefined,
      participants: event?.participants ? Object.keys(event.participants).length : 1,
    });
    const local = callFrameRef.current?.participants()?.local;
    if (local) {
      setIsCameraEnabled(!!local.video);
      setIsAudioEnabled(!!local.audio);
    }

  }, [bookingId, callId]);

  const safeCleanup = useCallback(async (reason: string) => {
    if (cleanupDoneRef.current) return;
    cleanupDoneRef.current = true;

    const frame = callFrameRef.current;
    callFrameRef.current = null;

    if (!frame) return;

    try {
      // 1) Coupe caméra / micro immédiatement
      frame.setLocalVideo?.(false);
      frame.setLocalAudio?.(false);

      // 2) Stop tracks (sécurité navigateur)
      const tracks = frame.getMediaStreamTracks?.();
      if (Array.isArray(tracks)) {
        tracks.forEach((track: MediaStreamTrack) => {
          try { track.stop(); } catch {}
        });
      }

      // 3) Leave si possible
      try {
        await frame.leave?.();
      } catch {}

      // 4) Destroy APRES un petit délai (évite postMessage null)
      //    (Daily peut encore poster des messages juste après leave)
      await new Promise((r) => setTimeout(r, 150));

      try {
        frame.destroy?.();
      } catch {}
    } catch (e) {
      console.warn('[CallInterface] safeCleanup error', reason, e);
    }
  }, []);

  const handleLeftMeeting = useCallback(async () => {
    const duration = hasOfficiallyStarted
      ? elapsedTime
      : Math.floor((Date.now() - startTime.getTime()) / 1000);

    await logCallEvent(bookingId, 'SESSION_END', { callId: callId || undefined, duration });
    await logCallEvent(bookingId, 'CALL_LEAVE', { callId: callId || undefined, duration });

    await safeCleanup('left-meeting');
    onCallEnd();
  }, [
    bookingId,
    callId,
    elapsedTime,
    hasOfficiallyStarted,
    onCallEnd,
    startTime,
    safeCleanup
  ]);

  const handleNetworkConnection = useCallback(
    async (event?: any) => {
      const status = event?.action || event?.type || event?.state;
      if (!status) return;

      if (status === 'disconnected') {
        setConnectionState('reconnecting');
        setIsReconnecting(true);

        toast({
          title: t('connectionLost'),
          description: t('connectionLostDesc'),
          variant: 'destructive',
        });

        // 👉 si tu considères ça comme bloquant
        triggerFatalError('network-disconnected');
      } else if (status === 'connected') {
        setConnectionState('connected');
        setIsReconnecting(false);

        await logCallEvent(bookingId, 'CALL_RECONNECT', {
          callId: callId || undefined,
          reason: 'network-reconnected',
        });

        toast({ title: t('reconnected'), description: t('reconnectedDesc') });
      }

    },
    [bookingId, callId, toast, t]
  );

  const handleParticipantJoined = useCallback(
    async (event?: any) => {
      await logCallEvent(bookingId, 'PARTICIPANT_JOINED', {
        callId: callId || undefined,
        participantId: event?.participant?.user_id,
      });

      toast({
        title: t('participantJoined'),
        description: `${event?.participant?.user_name || t('aParticipant')} ${t('participantJoinedDesc')}`,
      });
    },
    [bookingId, callId, toast, t]
  );

  

  const triggerFatalError = useCallback((reason: string) => {
    console.warn('[CallInterface] Fatal call error:', reason);
    setFatalError(reason);

    // Optionnel : on nettoie immédiatement Daily
    safeCleanup('fatal-error');
  }, [safeCleanup]);

  const handleParticipantLeft = useCallback(
    async (event?: any) => {
      await logCallEvent(bookingId, 'PARTICIPANT_LEFT', {
        callId: callId || undefined,
        participantId: event?.participant?.user_id,
      });

      toast({
        title: t('participantLeft'),
        description: `${event?.participant?.user_name || t('aParticipant')} ${t('participantLeftDesc')}`,
      });
    },
    [bookingId, callId, toast, t]
  );

  const handleCallError = useCallback(
    async (event?: any) => {
      setConnectionState('disconnected');

      const errorMsg =
        event?.errorMsg || event?.error || t('unknownError');

      await logCallEvent(bookingId, 'CALL_ERROR', {
        callId: callId || undefined,
        error: errorMsg,
      });

      toast({
        variant: 'destructive',
        title: t('callErrorDuring'),
        description: errorMsg,
      });

      // ✅ déclenche l’overlay Refresh
      triggerFatalError('call-error');
    },
    [bookingId, callId, toast, t, triggerFatalError]
  );

  const enableCamera = async () => {
    try {

      await callFrameRef.current?.setLocalVideo(true);
      await callFrameRef.current?.setLocalAudio(true);

      setIsCameraEnabled(true);
      setIsAudioEnabled(true);
      toast({
        title: t('cameraEnabledTitle'),
        description: t('cameraEnabledDesc'),
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: t('cameraBlockedTitle'),
        description: t('cameraBlockedDesc'),
      });
    }
  };


  const handleJoinCall = useCallback(async () => {
  if (!callContainerRef.current) return;
  if (callFrameRef.current) return;
  if (joinInProgressRef.current) return;
  setConnectionState('connecting');

  try {
    joinInProgressRef.current = true;

    const frame = DailyIframe.createFrame(callContainerRef.current, {
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: '0',
        position: 'absolute',
        inset: '0',
      },
      showLeaveButton: true,
      showFullscreenButton: true,
      theme: {
        colors: {
          accent: '#9333ea',
          accentText: '#ffffff',
          background: '#1f2937',
          backgroundAccent: '#374151',
          baseText: '#ffffff',
          border: '#4b5563',
          mainAreaBg: '#111827',
          mainAreaBgAccent: '#1f2937',
          mainAreaText: '#ffffff',
          supportiveText: '#9ca3af',
        },
      },
    });

    frame.on('participant-updated', (e: any) => {
      if (e?.participant?.local) {
        setIsCameraEnabled(!!e.participant.video);
        setIsAudioEnabled(!!e.participant.audio);
      }
    });

    callFrameRef.current = frame;

    frame
      .on('joined-meeting', (e:any) => {
        handleJoinedMeeting(e);
      })
      .on('participant-joined', (e:any) => {
        handleParticipantJoined(e);
      })
      .on('participant-left', (e:any) => {
        handleParticipantLeft(e);
      })
      .on('left-meeting', () => {
        handleLeftMeeting();
      })
      .on('network-connection', (e:any) => {
        handleNetworkConnection(e);
      })
      .on('error', (e:any) => {
        handleCallError(e);
      });

    await frame.join({
      url: roomUrl,
      token,
      startVideoOff: true,
      startAudioOff: true,
    });

    if (!hasLoggedJoinRef.current) {
      await logCallEvent(bookingId, 'CALL_JOIN', {
        callId: callId ?? undefined,
        roomUrl,
      });
      hasLoggedJoinRef.current = true;
    }

  } catch (err) {
    console.error('[CallInterface] join failed', err);
    triggerFatalError('join-failed');
  } finally {
    joinInProgressRef.current = false;
  }
}, [
  roomUrl,
  token,
  bookingId,
  callId,
  handleJoinedMeeting,
  handleParticipantJoined,
  handleParticipantLeft,
  handleLeftMeeting,
  handleCallError,
  handleNetworkConnection,
]);

useEffect(() => {
  const setVH = () => {
    document.documentElement.style.setProperty(
      '--vh',
      `${window.innerHeight * 0.01}px`
    );
  };

  setVH();
  window.addEventListener('resize', setVH);
  return () => window.removeEventListener('resize', setVH);
}, []);


  const forceEndCall = useCallback(async (reason: string) => {
    if (hasAutoEndedRef.current) return;
    hasAutoEndedRef.current = true;

    console.warn('[CallInterface] Force end call:', reason);

    try {
      if (callFrameRef.current) {
        await callFrameRef.current.leave?.();
      }
    } catch {}

    await safeCleanup('time-ended');

    onCallEnd();
  }, [onCallEnd, safeCleanup]);

  useEffect(() => {
    if (!callStartTs) return;

    if (hasOfficiallyStarted) {
      const elapsed = Math.floor((nowTs - callStartTs) / 1000);
      setElapsedTime(elapsed);

      const remaining = Math.max(0, scheduledDurationSec - elapsed);
      setTimeRemaining(remaining);

      if (
        !booking?.isTestBooking &&
        elapsed >= scheduledDurationSec
      ) {
        forceEndCall('duration-reached');
      }

    } else {
      setElapsedTime(0);
      setTimeRemaining(scheduledDurationSec);
    }
  }, [
    nowTs,
    callStartTs,
    scheduledDurationSec,
    hasOfficiallyStarted,
    booking?.isTestBooking,
    forceEndCall,
  ]);

  useEffect(() => {
    return () => {
      if (joinInProgressRef.current) {
        // ⚠️ En dev / strict mode, on évite destroy pendant join
        setTimeout(() => {
          safeCleanup('unmount-during-join');
        }, 300);
        return;
      }

      safeCleanup('unmount');
    };
  }, [safeCleanup]);

  return (
    <div
      className="bg-gray-900 flex flex-col"
      style={{ height: '100dvh' }}
    >
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={callContainerRef}
          className="w-full h-full"
          style={{
            zIndex: 1,
            position: 'relative',
            overflow: 'hidden',
          }}
        />

        <div
          className="absolute top-[env(safe-area-inset-top)] left-0 right-0 bg-transparent p-10 pointer-events-none"
          style={{ zIndex: 50 }}
        >
          <div className="mt-2 ml-2 flex items-center gap-2 pointer-events-none">
            {/*
            <div className="flex items-center gap-3">
              {callId && (
                <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-md text-[10px] sm:text-xs">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-white text-sm font-mono">
                    {t('callIdLabel')} {callId.substring(0, 8)}
                  </span>
                </div>
              )}

              {booking?.isTestBooking && <Badge className="bg-blue-500 text-white">{t('testMode')}</Badge>}
            </div>
            */}

            {/*
            <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-md text-[10px] sm:text-xs">
              <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-[9px] sm:text-[10px]">
                C
              </div>
              <span className="text-[10px] sm:text-xs text-white/80">
                {t('callastar')}
              </span>
            </div>
            */}
          </div>
        </div>

        <div className="absolute top-[calc(env(safe-area-inset-top)+6px)] left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="flex items-center gap-2 bg-black/60 bg-black/40 text-white px-3 py-1 rounded-full text-xs font-mono shadow-md">
            <Clock className="w-3 h-3 opacity-80" />

            {isTooEarly && (
              <span>{formatTime(countdownToAccessSec)}</span>
            )}

            {isWithinEarlyAccess && (
              <span>{formatTime(countdownToStartSec)}</span>
            )}

            {hasOfficiallyStarted && (
              <>
                <span>{formatTime(elapsedTime)}</span>
                {!booking?.isTestBooking && (
                  <span className="opacity-70"> / {formatTime(timeRemaining)}</span>
                )}
              </>
            )}
          </div>
        </div>

        {hasJoined && canShowNetworkError && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2" style={{ zIndex: 20 }}>
            <Alert className="bg-orange-500 text-white border-orange-600">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {isReconnecting ? t('reconnecting') : t('connectionLost')}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {isTooEarly && (
          <div className="absolute inset-0 flex items-center justify-center p-4" style={{ zIndex: 20 }}>
            <div className="w-full max-w-lg">
              <div className="bg-black/50 bg-black/40 border border-gray-700 rounded-2xl p-6 text-center text-white pointer-events-auto">
                <div className="text-lg font-semibold">{t('tooEarlyTitle')}</div>
                <div className="mt-2 text-sm text-gray-300">{t('tooEarlyDesc', { minutes: earlyAccessMinutes })}</div>

                <div className="mt-4 inline-flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full">
                  <Clock className="w-4 h-4" />
                  <span className="font-mono">{formatTime(countdownToAccessSec)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {canJoin && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
            <button
              onClick={handleJoinCall}
              disabled={isConnecting}
              className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-lg font-semibold transition"
            >
              {isConnecting
                ? t('joining')
                : t('joinCall')}
            </button>
          </div>
        )}
        {hasJoined && (!isCameraEnabled || !isAudioEnabled) && (
          <button
            onClick={enableCamera}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-green-600 text-white rounded-xl"
          >
            {t('enableCameraButton')}
          </button>
        )}
        {/*
        {mobileLogs.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-[9999] max-h-48 overflow-auto bg-black/90 text-green-400 text-[10px] font-mono p-2 space-y-1">
            {mobileLogs.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
        */}
        {fatalError && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 bg-black/40"
          >
            <div className="max-w-md w-full bg-gray-900 border border-red-500 rounded-2xl p-6 text-center text-white">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>

              <h2 className="text-lg font-semibold mb-2">
                {t('callCrashedTitle')}
              </h2>

              <p className="text-sm text-gray-300 mb-6">
                {t('callCrashedDesc')}
              </p>

              <button
                onClick={() => window.location.reload()}
                className="w-full rounded-lg bg-red-600 hover:bg-red-700 text-white py-2 font-medium transition"
              >
                {t('refreshPage')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

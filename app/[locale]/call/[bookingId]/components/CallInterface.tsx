'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from '@/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Video, VideoOff, Mic, MicOff, LogOut, 
  Maximize, Minimize, Clock, AlertTriangle 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
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

export function CallInterface({ 
  booking, 
  bookingId, 
  roomUrl, 
  token, 
  onCallEnd,
  startTime 
}: CallInterfaceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('call.room');
  
  // State
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  
  // Refs
  const callFrameRef = useRef<DailyCall | null>(null);
  const callContainerRef = useRef<HTMLDivElement>(null);
  const hasLoggedStartRef = useRef(false);

  // Initialize Daily.co call
  useEffect(() => {
    const initCall = async () => {
      if (!callContainerRef.current) return;

      try {
        console.log('[CallInterface] Initializing call...');
        
        // Create Daily.co call frame with Prebuilt UI
        const callFrame = DailyIframe.createFrame(callContainerRef.current, {
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: '0',
            borderRadius: '12px',
          },
          showLeaveButton: false,
          showFullscreenButton: false,
          theme: {
            colors: {
              accent: '#9333ea', // Purple
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

        callFrameRef.current = callFrame;

        // Set up event listeners
        callFrame
          .on('joined-meeting', handleJoinedMeeting)
          .on('participant-joined', handleParticipantJoined)
          .on('participant-left', handleParticipantLeft)
          .on('left-meeting', handleLeftMeeting)
          .on('error', handleCallError)
          .on('network-quality-change', handleNetworkQualityChange)
          .on('network-connection', handleNetworkConnection);

        // Join the call
        await callFrame.join({
          url: roomUrl,
          token: token,
        });

        // Get call ID
        const dailyCallId = roomUrl?.split('/').pop() || 'unknown';
        setCallId(dailyCallId);

        console.log('[CallInterface] Call joined successfully');
        
        if (!hasLoggedStartRef.current) {
          await logCallEvent(bookingId, 'CALL_JOIN', { 
            callId: dailyCallId,
            roomUrl: roomUrl,
          });
          hasLoggedStartRef.current = true;
        }

      } catch (error: any) {
        console.error('[CallInterface] Init error:', error);
        toast({
          variant: 'destructive',
          title: t('error'),
          description: error?.message ?? t('callError'),
        });
        
        await logCallEvent(bookingId, 'CALL_ERROR', {
          error: error?.message,
          stage: 'init',
        });
      }
    };

    initCall();

    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
    };
  }, [roomUrl, token, bookingId, toast, t]);

  // Timer update - Only start when official time is reached
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const callStartTime = new Date(booking.callOffer.dateTime).getTime();
      
      // Only count time if we've reached the official start time
      if (now >= callStartTime) {
        const elapsed = Math.floor((now - callStartTime) / 1000);
        setElapsedTime(elapsed);
        
        const scheduledDuration = booking.callOffer.duration * 60;
        const remaining = Math.max(0, scheduledDuration - elapsed);
        setTimeRemaining(remaining);
        
        // Auto-end call when time is up (except for test bookings)
        if (!booking?.isTestBooking && remaining === 0 && callFrameRef.current) {
          endCall('time-limit-reached');
        }
      } else {
        // Before official start time, show time elapsed since user joined
        const elapsed = Math.floor((now - startTime.getTime()) / 1000);
        setElapsedTime(elapsed);
        setTimeRemaining(booking.callOffer.duration * 60);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [booking, startTime]);

  // Event handlers
  const handleJoinedMeeting = async (event?: any) => {
    console.log('[CallInterface] Joined meeting:', event);
    await logCallEvent(bookingId, 'SESSION_START', {
      callId: callId || undefined,
      participants: event?.participants ? Object.keys(event.participants).length : 1,
    });
  };

  const handleParticipantJoined = async (event?: any) => {
    console.log('[CallInterface] Participant joined:', event);
    await logCallEvent(bookingId, 'PARTICIPANT_JOINED', {
      callId: callId || undefined,
      participantId: event?.participant?.user_id,
    });
    
    toast({
      title: t('participantJoined'),
      description: `${event?.participant?.user_name || t('aParticipant')} ${t('participantJoinedDesc')}`,
    });
  };

  const handleParticipantLeft = async (event?: any) => {
    console.log('[CallInterface] Participant left:', event);
    await logCallEvent(bookingId, 'PARTICIPANT_LEFT', {
      callId: callId || undefined,
      participantId: event?.participant?.user_id,
    });
    
    toast({
      title: t('participantLeft'),
      description: `${event?.participant?.user_name || t('aParticipant')} ${t('participantLeftDesc')}`,
      variant: 'default',
    });
  };

  const handleLeftMeeting = async () => {
    console.log('[CallInterface] Left meeting');
    
    await logCallEvent(bookingId, 'SESSION_END', {
      callId: callId || undefined,
      duration: elapsedTime,
    });
    
    await logCallEvent(bookingId, 'CALL_LEAVE', {
      callId: callId || undefined,
      duration: elapsedTime,
    });
    
    onCallEnd();
  };

  const handleCallError = async (event?: any) => {
    console.error('[CallInterface] Call error:', event);
    setConnectionState('disconnected');
    
    await logCallEvent(bookingId, 'CALL_ERROR', {
      callId: callId || undefined,
      error: event?.errorMsg || event?.error || 'Unknown error',
    });
    
    toast({
      variant: 'destructive',
      title: t('callErrorDuring'),
      description: event?.errorMsg || t('callError'),
    });
  };

  const handleNetworkQualityChange = (event?: any) => {
    console.log('[CallInterface] Network quality change:', event);
    if (event?.threshold === 'low') {
      toast({
        title: t('weakConnection'),
        description: t('weakConnectionDesc'),
        variant: 'default',
      });
    }
  };

  const handleNetworkConnection = async (event?: any) => {
    console.log('[CallInterface] Network connection change:', event);
    
    if (event?.type === 'disconnected') {
      setConnectionState('disconnected');
      setIsReconnecting(true);
      
      await logCallEvent(bookingId, 'DISCONNECTION_INVOLUNTARY', {
        callId: callId || undefined,
        reason: 'network-disconnected',
      });
      
      toast({
        title: t('connectionLost'),
        description: t('connectionLostDesc'),
        variant: 'destructive',
      });
    } else if (event?.type === 'connected') {
      setConnectionState('connected');
      setIsReconnecting(false);
      
      await logCallEvent(bookingId, 'CALL_RECONNECT', {
        callId: callId || undefined,
        reason: 'network-reconnected',
      });
      
      toast({
        title: t('reconnected'),
        description: t('reconnectedDesc'),
      });
    }
  };

  // Control handlers
  const toggleCamera = async () => {
    if (callFrameRef.current) {
      try {
        await callFrameRef.current.setLocalVideo(!isCameraOn);
        setIsCameraOn(!isCameraOn);
        await logCallEvent(bookingId, 'CAMERA_TOGGLED', {
          callId: callId || undefined,
          enabled: !isCameraOn,
        });
      } catch (error) {
        console.error('[CallInterface] Toggle camera error:', error);
      }
    }
  };

  const toggleMic = async () => {
    if (callFrameRef.current) {
      try {
        await callFrameRef.current.setLocalAudio(!isMicOn);
        setIsMicOn(!isMicOn);
        await logCallEvent(bookingId, 'MIC_TOGGLED', {
          callId: callId || undefined,
          enabled: !isMicOn,
        });
      } catch (error) {
        console.error('[CallInterface] Toggle mic error:', error);
      }
    }
  };

  const toggleFullscreen = async () => {
    if (!callContainerRef.current) return;

    try {
      if (!isFullscreen) {
        await callContainerRef.current.parentElement?.requestFullscreen();
        setIsFullscreen(true);
        await logCallEvent(bookingId, 'FULLSCREEN_ENTERED', { callId: callId || undefined });
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        await logCallEvent(bookingId, 'FULLSCREEN_EXITED', { callId: callId || undefined });
      }
    } catch (error) {
      console.error('[CallInterface] Toggle fullscreen error:', error);
    }
  };

  const endCall = async (reason: string = 'user-action') => {
    if (callFrameRef.current) {
      console.log('[CallInterface] Ending call, reason:', reason);
      
      await logCallEvent(bookingId, 'DISCONNECTION_VOLUNTARY', {
        callId: callId || undefined,
        reason,
        duration: elapsedTime,
      });
      
      await callFrameRef.current.leave();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Call container - Full screen */}
      <div className="flex-1 relative">
        <div ref={callContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />
        
        {/* Top bar overlay - IMPORTANT: z-index élevé pour être au-dessus de l'iframe */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 pointer-events-none" style={{ zIndex: 50 }}>
          <div className="flex items-center justify-between pointer-events-auto">
            {/* Call ID */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-white text-sm font-mono">ID: {callId?.substring(0, 8)}</span>
              </div>
              {booking?.isTestBooking && (
                <Badge className="bg-blue-500 text-white">
                  {t('testMode')}
                </Badge>
              )}
            </div>
            
            {/* Branding */}
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                C
              </div>
              <span className="font-semibold text-white text-sm">{t('callastar')}</span>
            </div>
          </div>
        </div>
        
        {/* Timer overlay - IMPORTANT: z-index élevé */}
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white px-6 py-3 rounded-full pointer-events-none" style={{ zIndex: 50 }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="font-mono text-lg">{formatTime(elapsedTime)}</span>
            </div>
            {!booking?.isTestBooking && (
              <div className="text-sm text-gray-300 border-l border-gray-500 pl-4">
                {t('timeRemaining')}: {formatTime(timeRemaining)}
              </div>
            )}
            {booking?.isTestBooking && (
              <div className="text-xs text-blue-300 border-l border-gray-500 pl-4">
                {t('noTimeLimit')}
              </div>
            )}
          </div>
        </div>
        
        {/* Connection status alert - IMPORTANT: z-index élevé */}
        {connectionState !== 'connected' && (
          <div className="absolute top-32 left-1/2 transform -translate-x-1/2 pointer-events-none" style={{ zIndex: 50 }}>
            <Alert className="bg-orange-500 text-white border-orange-600 pointer-events-auto">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {isReconnecting ? t('reconnecting') : t('connectionLost')}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

      {/* Controls bar - IMPORTANT: z-index élevé pour être cliquable */}
      <div className="bg-gray-900 p-4 sm:p-6 border-t border-gray-800 relative" style={{ zIndex: 100 }}>
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Media controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                onClick={toggleCamera}
                variant={isCameraOn ? "default" : "destructive"}
                size="lg"
                className="rounded-full w-12 h-12 sm:w-14 sm:h-14 shadow-lg hover:scale-105 transition-transform"
                title={isCameraOn ? t('disableCamera') : t('enableCamera')}
              >
                {isCameraOn ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />}
              </Button>
              
              <Button
                onClick={toggleMic}
                variant={isMicOn ? "default" : "destructive"}
                size="lg"
                className="rounded-full w-12 h-12 sm:w-14 sm:h-14 shadow-lg hover:scale-105 transition-transform"
                title={isMicOn ? t('disableMic') : t('enableMic')}
              >
                {isMicOn ? <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />}
              </Button>
            </div>
            
            {/* Center - End call button - IMPORTANT: Bouton de sortie bien visible et cliquable */}
            <Button
              onClick={() => endCall('user-action')}
              variant="destructive"
              size="lg"
              className="rounded-full px-4 sm:px-8 h-12 sm:h-14 font-semibold flex items-center gap-2 shadow-lg hover:scale-105 transition-transform bg-red-600 hover:bg-red-700"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">{t('leaveCall')}</span>
              <span className="sm:hidden">Quitter</span>
            </Button>
            
            {/* Right - Fullscreen with text */}
            <div className="flex items-center gap-2">
              <Button
                onClick={toggleFullscreen}
                variant="outline"
                size="lg"
                className="rounded-full px-3 sm:px-4 h-12 sm:h-14 bg-gray-800 border-gray-700 text-white hover:bg-gray-700 shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                title={isFullscreen ? t('exitFullscreen') : t('enterFullscreen')}
              >
                {isFullscreen ? <Minimize className="w-5 h-5 sm:w-6 sm:h-6" /> : <Maximize className="w-5 h-5 sm:w-6 sm:h-6" />}
                <span className="hidden lg:inline text-sm">
                  {isFullscreen ? 'Réduire' : 'Plein écran'}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

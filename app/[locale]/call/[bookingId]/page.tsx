'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from '@/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, AlertCircle, Video, VideoOff, Mic, MicOff, 
  Phone, Settings, Clock, Maximize, Minimize, 
  AlertTriangle, Info, CheckCircle2, LogOut 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DailyIframe, { DailyCall, DailyEvent, DailyEventObjectParticipant } from '@daily-co/daily-js';
import { logCallEvent, formatDuration } from '@/lib/call-types';
import { useTranslations, useLocale } from 'next-intl';

// Debug flag
const DEBUG_MODE = process.env.NODE_ENV === 'development';

const debugLog = (...args: any[]) => {
  if (DEBUG_MODE) {
    console.log('[CallPage]', ...args);
  }
};

interface CallState {
  phase: 'loading' | 'pre-call' | 'in-call' | 'ended' | 'error';
  error?: string;
  callStartTime?: Date;
}

export default function CallPage({ 
  params 
}: { 
  params: Promise<{ bookingId: string; locale: string }> | { bookingId: string; locale: string } 
}) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('call.room');
  const locale = useLocale();
  
  // State
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [callState, setCallState] = useState<CallState>({ phase: 'loading' });
  const [callId, setCallId] = useState<string | null>(null);
  
  // Timers
  const [timeUntilCall, setTimeUntilCall] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  
  // Real call start time (from first participant join)
  const [realCallStartTime, setRealCallStartTime] = useState<Date | null>(null);
  const [isFirstParticipant, setIsFirstParticipant] = useState<boolean>(false);
  
  // Media controls
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isTestingMedia, setIsTestingMedia] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Connection state
  const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Refs
  const callFrameRef = useRef<DailyCall | null>(null);
  const callContainerRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sessionStartTimeRef = useRef<Date | null>(null);
  const hasLoggedSessionStartRef = useRef(false);

  // Resolve params
  useEffect(() => {
    const resolveParams = async () => {
      if (params instanceof Promise) {
        const resolved = await params;
        setBookingId(resolved.bookingId);
      } else {
        setBookingId(params.bookingId);
      }
    };
    resolveParams();
  }, [params]);

  // Init call
  useEffect(() => {
    if (bookingId) {
      initCall();
    }
    
    return () => {
      cleanup();
    };
  }, [bookingId]);

  // Timer update
  useEffect(() => {
    const interval = setInterval(() => {
      if (booking) {
        const callTime = new Date(booking.callOffer.dateTime).getTime();
        const now = Date.now();
        
        // Update time until call for pre-call phase
        if (callState.phase === 'pre-call') {
          setTimeUntilCall(Math.max(0, Math.floor((callTime - now) / 1000)));
        }
        
        // Update time remaining for in-call phase
        if (callState.phase === 'in-call') {
          // Calcul du temps écoulé basé sur l'heure de début réelle de l'appel
          let elapsed = 0;
          
          if (realCallStartTime) {
            // L'appel a déjà commencé : calculer le temps depuis le début réel
            elapsed = Math.floor((now - realCallStartTime.getTime()) / 1000);
          } else if (sessionStartTimeRef.current) {
            // Premier participant : utiliser l'heure de session locale
            elapsed = Math.floor((now - sessionStartTimeRef.current.getTime()) / 1000);
          }
          
          setElapsedTime(elapsed);
          
          const scheduledDuration = booking.callOffer.duration * 60;
          const remaining = Math.max(0, scheduledDuration - elapsed);
          setTimeRemaining(remaining);
          
          // Auto-end call when time is up (sauf pour les bookings de test)
          if (!booking?.isTestBooking && remaining === 0 && callFrameRef.current) {
            endCall('time-limit-reached');
          }
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [booking, callState, realCallStartTime]);

  // Gestion des déconnexions involontaires
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (callState.phase === 'in-call') {
        // Logger la déconnexion involontaire
        logCallEvent(bookingId!, 'DISCONNECTION_INVOLUNTARY', {
          reason: 'page-unload',
          callId: callId || undefined,
        });
        
        // Empêcher la fermeture accidentelle
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && callState.phase === 'in-call') {
        debugLog('Tab hidden, call still active');
        logCallEvent(bookingId!, 'DISCONNECTION_INVOLUNTARY', {
          reason: 'tab-hidden',
          callId: callId || undefined,
        });
      } else if (!document.hidden && callState.phase === 'in-call') {
        debugLog('Tab visible again');
        logCallEvent(bookingId!, 'CALL_RECONNECT', {
          reason: 'tab-visible',
          callId: callId || undefined,
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [callState.phase, bookingId, callId]);

  const initCall = async () => {
    if (!bookingId) return;

    try {
      debugLog('Initializing call for booking:', bookingId);
      
      const bookingResponse = await fetch(`/api/bookings/${bookingId}`);
      if (!bookingResponse.ok) {
        throw new Error(t('bookingNotFound'));
      }
      const bookingData = await bookingResponse.json();
      const fetchedBooking = bookingData?.booking;
      setBooking(fetchedBooking);
      
      debugLog('Booking data:', fetchedBooking);

      // ✅ NOUVELLE LOGIQUE: Toujours permettre l'accès à la waiting room/pre-call
      // Pas de blocage temporel - l'utilisateur peut toujours entrer et tester son équipement
      setCallState({ phase: 'pre-call' });
      await logCallEvent(bookingId, 'PRE_CALL_ENTERED', { timestamp: new Date().toISOString() });
      
    } catch (error: any) {
      debugLog('Init call error:', error);
      setCallState({ 
        phase: 'error', 
        error: error?.message ?? t('callError')
      });
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

  const testMediaDevices = async () => {
    setIsTestingMedia(true);
    try {
      debugLog('Testing media devices...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      localStreamRef.current = stream;
      
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }
      
      debugLog('Media devices test successful');
      toast({
        title: t('testSuccess'),
        description: t('testSuccessDesc'),
      });
    } catch (error) {
      debugLog('Media devices test error:', error);
      toast({
        variant: 'destructive',
        title: t('testError'),
        description: t('testErrorDesc'),
      });
      
      await logCallEvent(bookingId!, 'CALL_ERROR', {
        error: 'media-devices-access-denied',
        stage: 'pre-call',
      });
    } finally {
      setIsTestingMedia(false);
    }
  };

  const joinCall = async () => {
    if (!bookingId || !booking) return;

    try {
      debugLog('Joining call...');
      setCallState({ phase: 'loading' });

      // Récupérer l'heure de début réelle de l'appel
      debugLog('Fetching real call start time...');
      const startTimeResponse = await fetch(`/api/call-start-time/${bookingId}`);
      
      if (startTimeResponse.ok) {
        const startTimeData = await startTimeResponse.json();
        debugLog('Start time data:', startTimeData);
        
        if (startTimeData.hasStarted && startTimeData.realStartTime) {
          // L'appel a déjà commencé, utiliser l'heure réelle
          setRealCallStartTime(new Date(startTimeData.realStartTime));
          setIsFirstParticipant(false);
          debugLog('Call already started at:', startTimeData.realStartTime);
        } else {
          // Premier participant
          setIsFirstParticipant(true);
          debugLog('This is the first participant');
        }
      } else {
        debugLog('Could not fetch start time, assuming first participant');
        setIsFirstParticipant(true);
      }

      // Get meeting token
      const tokenResponse = await fetch('/api/daily/get-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        throw new Error(error?.error ?? t('cannotAccessCall'));
      }

      const tokenData = await tokenResponse.json();
      setToken(tokenData?.token);
      
      debugLog('Token received, creating call frame...');

      // Stop preview stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // Create Daily.co call
      const callFrame = DailyIframe.createFrame(callContainerRef.current!, {
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: '0',
        },
        showLeaveButton: false, // On gère notre propre bouton
        showFullscreenButton: false, // On gère notre propre bouton
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
        url: booking.dailyRoomUrl,
        token: tokenData.token,
      });

      // Récupérer le callId de Daily.co
      const meetingState = await callFrame.meetingState();
      const dailyCallId = booking.dailyRoomUrl?.split('/').pop() || 'unknown';
      setCallId(dailyCallId);

      debugLog('Call joined successfully, callId:', dailyCallId);
      
      sessionStartTimeRef.current = new Date();
      
      // Si c'est le premier participant, définir l'heure de début réelle
      if (isFirstParticipant) {
        setRealCallStartTime(sessionStartTimeRef.current);
        debugLog('First participant - setting real start time to now');
      }
      
      setCallState({ 
        phase: 'in-call',
        callStartTime: sessionStartTimeRef.current,
      });
      
      await logCallEvent(bookingId, 'CALL_JOIN', { 
        callId: dailyCallId,
        roomUrl: booking.dailyRoomUrl,
        isFirstParticipant,
      });

    } catch (error: any) {
      debugLog('Join call error:', error);
      setCallState({ 
        phase: 'error', 
        error: error?.message ?? t('cannotJoinCall')
      });
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error?.message ?? t('callError'),
      });
      
      await logCallEvent(bookingId, 'CALL_ERROR', {
        error: error?.message,
        stage: 'join',
      });
    }
  };

  const handleJoinedMeeting = async (event?: any) => {
    debugLog('Joined meeting event:', event);
    
    if (!hasLoggedSessionStartRef.current) {
      await logCallEvent(bookingId!, 'SESSION_START', {
        callId: callId || undefined,
        participants: event?.participants ? Object.keys(event.participants).length : 1,
      });
      hasLoggedSessionStartRef.current = true;
    }
  };

  const handleParticipantJoined = async (event?: any) => {
    debugLog('Participant joined:', event);
    await logCallEvent(bookingId!, 'PARTICIPANT_JOINED', {
      callId: callId || undefined,
      participantId: event?.participant?.user_id,
    });
    
    toast({
      title: t('participantJoined'),
      description: `${event?.participant?.user_name || t('aParticipant')} ${t('participantJoinedDesc')}`,
    });
  };

  const handleParticipantLeft = async (event?: any) => {
    debugLog('Participant left:', event);
    await logCallEvent(bookingId!, 'PARTICIPANT_LEFT', {
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
    debugLog('Left meeting');
    
    // Log session end
    await logCallEvent(bookingId!, 'SESSION_END', {
      callId: callId || undefined,
      duration: elapsedTime,
    });
    
    await logCallEvent(bookingId!, 'CALL_LEAVE', {
      callId: callId || undefined,
      duration: elapsedTime,
    });
    
    setCallState({ phase: 'ended' });
    
    // Redirect to summary page
    setTimeout(() => {
      router.push(`/call/${bookingId}/summary`);
    }, 2000);
  };

  const handleCallError = async (event?: any) => {
    debugLog('Call error:', event);
    setConnectionState('disconnected');
    
    await logCallEvent(bookingId!, 'CALL_ERROR', {
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
    debugLog('Network quality change:', event);
    if (event?.threshold === 'low') {
      toast({
        title: t('weakConnection'),
        description: t('weakConnectionDesc'),
        variant: 'default',
      });
    }
  };

  const handleNetworkConnection = async (event?: any) => {
    debugLog('Network connection change:', event);
    
    if (event?.type === 'disconnected') {
      setConnectionState('disconnected');
      setIsReconnecting(true);
      
      await logCallEvent(bookingId!, 'DISCONNECTION_INVOLUNTARY', {
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
      
      await logCallEvent(bookingId!, 'CALL_RECONNECT', {
        callId: callId || undefined,
        reason: 'network-reconnected',
      });
      
      toast({
        title: t('reconnected'),
        description: t('reconnectedDesc'),
      });
    }
  };

  const toggleCamera = async () => {
    if (callFrameRef.current) {
      try {
        await callFrameRef.current.setLocalVideo(!isCameraOn);
        setIsCameraOn(!isCameraOn);
        await logCallEvent(bookingId!, 'CAMERA_TOGGLED', {
          callId: callId || undefined,
          enabled: !isCameraOn,
        });
      } catch (error) {
        debugLog('Toggle camera error:', error);
      }
    }
  };

  const toggleMic = async () => {
    if (callFrameRef.current) {
      try {
        await callFrameRef.current.setLocalAudio(!isMicOn);
        setIsMicOn(!isMicOn);
        await logCallEvent(bookingId!, 'MIC_TOGGLED', {
          callId: callId || undefined,
          enabled: !isMicOn,
        });
      } catch (error) {
        debugLog('Toggle mic error:', error);
      }
    }
  };

  const toggleFullscreen = async () => {
    if (!callContainerRef.current) return;

    try {
      if (!isFullscreen) {
        await callContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
        await logCallEvent(bookingId!, 'FULLSCREEN_ENTERED', { callId: callId || undefined });
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        await logCallEvent(bookingId!, 'FULLSCREEN_EXITED', { callId: callId || undefined });
      }
    } catch (error) {
      debugLog('Toggle fullscreen error:', error);
    }
  };

  const endCall = async (reason: string = 'user-action') => {
    if (callFrameRef.current) {
      debugLog('Ending call, reason:', reason);
      
      await logCallEvent(bookingId!, 'DISCONNECTION_VOLUNTARY', {
        callId: callId || undefined,
        reason,
        duration: elapsedTime,
      });
      
      await callFrameRef.current.leave();
    }
  };

  const cleanup = () => {
    debugLog('Cleaning up...');
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (callFrameRef.current) {
      callFrameRef.current.destroy();
      callFrameRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCountdown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  // ========== RENDER STATES ==========

  if (callState.phase === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  if (callState.phase === 'pre-call') {
    // Calculate call status dynamically
    const callTime = new Date(booking?.callOffer?.dateTime ?? new Date()).getTime();
    const now = Date.now();
    const duration = (booking?.callOffer?.duration || 30) * 60 * 1000;
    const isCallTime = now >= callTime;
    const isPast = now > callTime + duration;
    
    let callStatus = '';
    let statusColor = '';
    
    if (isPast) {
      callStatus = t('callEnded');
      statusColor = 'text-gray-600';
    } else if (isCallTime) {
      callStatus = t('canStartNow');
      statusColor = 'text-green-600';
    } else if (timeUntilCall < 900) { // Less than 15 minutes
      callStatus = `${t('startsIn')} ${formatCountdown(timeUntilCall)}`;
      statusColor = 'text-orange-600';
    } else {
      callStatus = `${t('startsIn')} ${formatCountdown(timeUntilCall)}`;
      statusColor = 'text-purple-600';
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 flex-wrap">
                  {t('waitingRoom')}
                  {booking?.isTestBooking && (
                    <Badge className="bg-blue-500 text-white">
                      {t('testMode')}
                    </Badge>
                  )}
                </CardTitle>
                {/* Branding Callastar */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    C
                  </div>
                  <span className="font-semibold text-purple-600">{t('callastar')}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold mb-2">{booking?.callOffer?.title}</h2>
                  <p className="text-gray-600">{t('with')} {booking?.callOffer?.creator?.user?.name}</p>
                  <p className="text-sm text-gray-500">
                    {t('scheduledDuration')}: {booking?.callOffer?.duration} {t('minutes')}
                  </p>
                  {booking?.isTestBooking && (
                    <p className="text-sm text-blue-600 font-medium mt-2">
                      {t('testCallInfo')}
                    </p>
                  )}
                </div>

                {/* Call Status - Always visible and updated */}
                <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      {t('callStatusTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-lg font-bold ${statusColor}`}>
                      {callStatus}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('scheduledFor')} {new Date(booking?.callOffer?.dateTime).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}
                    </p>
                  </CardContent>
                </Card>

                {/* Section: Règles de l'appel */}
                <Card className="border-2 border-purple-200 bg-purple-50/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Info className="w-5 h-5" />
                      {t('callRulesTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                      <p><strong>{t('ruleDuration')}</strong> {booking?.callOffer?.duration} {t('minutesAllocated')}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                      <p><strong>{t('ruleBehavior')}</strong> {t('ruleeBehaviorDesc')}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                      <p><strong>{t('ruleConfidentiality')}</strong> {t('ruleConfidentialityDesc')}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                      <p><strong>{t('ruleDisconnection')}</strong> {t('ruleDisconnectionDesc')}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Test équipements */}
                <div className="bg-gray-100 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold">{t('testEquipment')}</h3>
                  
                  <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
                    <video
                      ref={previewVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {!localStreamRef.current && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="w-16 h-16 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={testMediaDevices}
                    disabled={isTestingMedia}
                    variant="outline"
                    className="w-full"
                  >
                    {isTestingMedia ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('testInProgress')}
                      </>
                    ) : (
                      <>
                        <Settings className="w-4 h-4 mr-2" />
                        {t('testCameraAndMic')}
                      </>
                    )}
                  </Button>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p>{t('checkCamera')}</p>
                    <p>{t('checkMic')}</p>
                    <p>{t('findQuietPlace')}</p>
                  </div>
                </div>
                
                {/* Important note: Always accessible */}
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>{t('freeAccessTitle')}</strong> {t('freeAccessDesc')}
                  </AlertDescription>
                </Alert>
              </div>

              <div className="flex gap-4">
                <Button onClick={() => router.push('/dashboard/user')} variant="outline" className="flex-1">
                  {t('backToDashboard')}
                </Button>
                <Button 
                  onClick={joinCall} 
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  <Video className="w-4 h-4 mr-2" />
                  {t('joinCall')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (callState.phase === 'in-call') {
    return (
      <div className="h-screen bg-black flex flex-col">
        {/* Call container */}
        <div className="flex-1 relative">
          <div ref={callContainerRef} className="w-full h-full" />
          
          {/* Top bar overlay */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4">
            <div className="flex items-center justify-between">
              {/* Call ID - En haut à gauche */}
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
              
              {/* Branding Callastar */}
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                  C
                </div>
                <span className="font-semibold text-white text-sm">{t('callastar')}</span>
              </div>
            </div>
          </div>
          
          {/* Timer overlay - Centre haut */}
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white px-6 py-3 rounded-full">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="font-mono text-lg">{formatTime(elapsedTime)}</span>
                {!isFirstParticipant && realCallStartTime && (
                  <span className="text-xs text-yellow-300 ml-2">
                    {t('joinedInProgress')}
                  </span>
                )}
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
          
          {/* Connection status alert */}
          {connectionState !== 'connected' && (
            <div className="absolute top-32 left-1/2 transform -translate-x-1/2">
              <Alert className="bg-orange-500 text-white border-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {isReconnecting ? t('reconnecting') : t('connectionLost')}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        {/* Controls bar */}
        <div className="bg-gray-900 p-6">
          <div className="container mx-auto max-w-4xl">
            <div className="flex items-center justify-between">
              {/* Media controls */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={toggleCamera}
                  variant={isCameraOn ? "default" : "destructive"}
                  size="lg"
                  className="rounded-full w-14 h-14"
                  title={isCameraOn ? t('disableCamera') : t('enableCamera')}
                >
                  {isCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </Button>
                
                <Button
                  onClick={toggleMic}
                  variant={isMicOn ? "default" : "destructive"}
                  size="lg"
                  className="rounded-full w-14 h-14"
                  title={isMicOn ? t('disableMic') : t('enableMic')}
                >
                  {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </Button>
              </div>
              
              {/* Center - End call button */}
              <Button
                onClick={() => endCall('user-action')}
                variant="destructive"
                size="lg"
                className="rounded-full px-8 h-14 font-semibold flex items-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                {t('leaveCall')}
              </Button>
              
              {/* Right - Fullscreen */}
              <Button
                onClick={toggleFullscreen}
                variant="outline"
                size="lg"
                className="rounded-full w-14 h-14 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                title={isFullscreen ? t('exitFullscreen') : t('enterFullscreen')}
              >
                {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (callState.phase === 'ended') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">{t('ended')}</h2>
              <p className="text-gray-600 mb-6">
                {t('redirecting')}
              </p>
              <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (callState.phase === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-500" />
                {t('error')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">{callState.error}</p>
              <div className="flex gap-4">
                <Button onClick={() => router.push('/dashboard/user')} variant="outline">
                  {t('backToDashboard')}
                </Button>
                <Button onClick={() => window.location.reload()}>
                  {t('retry')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
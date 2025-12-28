'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Video, VideoOff, Mic, MicOff, Phone, Settings, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DailyIframe, { DailyCall, DailyEvent, DailyEventObjectParticipant } from '@daily-co/daily-js';

// Debug flag - set to true to see logs in console
const DEBUG_MODE = false;

const debugLog = (...args: any[]) => {
  if (DEBUG_MODE) {
    console.log('[CallPage Debug]', ...args);
  }
};

interface CallState {
  phase: 'loading' | 'waiting' | 'pre-call' | 'in-call' | 'ended' | 'error';
  error?: string;
  callStartTime?: Date;
}

export default function CallPage({ params }: { params: Promise<{ bookingId: string }> | { bookingId: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [callState, setCallState] = useState<CallState>({ phase: 'loading' });
  const [timeUntilCall, setTimeUntilCall] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  
  // Media controls
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isTestingMedia, setIsTestingMedia] = useState(false);
  
  // Daily.co
  const callFrameRef = useRef<DailyCall | null>(null);
  const callContainerRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

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

  useEffect(() => {
    if (bookingId) {
      initCall();
    }
    
    return () => {
      cleanup();
    };
  }, [bookingId]);

  // Timer for countdown and elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      if (booking) {
        const callTime = new Date(booking.callOffer.dateTime).getTime();
        const now = Date.now();
        const fifteenMinutesBefore = callTime - 15 * 60 * 1000;
        
        if (callState.phase === 'waiting') {
          setTimeUntilCall(Math.max(0, Math.floor((fifteenMinutesBefore - now) / 1000)));
          
          // Automatically move to pre-call when time is reached
          if (now >= fifteenMinutesBefore) {
            setCallState({ phase: 'pre-call' });
            logCallEvent('PRE_CALL_ENTERED', { timestamp: new Date().toISOString() });
          }
        } else if (callState.phase === 'in-call' && callState.callStartTime) {
          const elapsed = Math.floor((now - callState.callStartTime.getTime()) / 1000);
          setElapsedTime(elapsed);
          
          const scheduledDuration = booking.callOffer.duration * 60; // in seconds
          const remaining = Math.max(0, scheduledDuration - elapsed);
          setTimeRemaining(remaining);
          
          // Auto-end call when time is up (mais pas pour les bookings de test)
          if (!booking?.isTestBooking && remaining === 0 && callFrameRef.current) {
            endCall();
          }
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [booking, callState]);

  const initCall = async () => {
    if (!bookingId) return;

    try {
      debugLog('Initializing call for booking:', bookingId);
      
      // Get booking details
      const bookingResponse = await fetch(`/api/bookings/${bookingId}`);
      if (!bookingResponse.ok) {
        throw new Error('Réservation introuvable');
      }
      const bookingData = await bookingResponse.json();
      const fetchedBooking = bookingData?.booking;
      setBooking(fetchedBooking);
      
      debugLog('Booking data:', fetchedBooking);

      // Check if call is accessible
      // 🧪 Les bookings de test sont toujours accessibles immédiatement
      if (!fetchedBooking?.isTestBooking) {
        const callTime = new Date(fetchedBooking?.callOffer?.dateTime).getTime();
        const now = Date.now();
        const fifteenMinutesBefore = callTime - 15 * 60 * 1000;

        if (now < fifteenMinutesBefore) {
          const minutesUntil = Math.ceil((fifteenMinutesBefore - now) / 60000);
          setCallState({ 
            phase: 'waiting', 
            error: `L'accès à l'appel sera disponible dans ${minutesUntil} minutes` 
          });
          return;
        }
      }

      // Move to pre-call state
      setCallState({ phase: 'pre-call' });
      await logCallEvent('PRE_CALL_ENTERED', { timestamp: new Date().toISOString() });
      
    } catch (error: any) {
      debugLog('Init call error:', error);
      setCallState({ 
        phase: 'error', 
        error: error?.message ?? 'Une erreur est survenue' 
      });
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error?.message ?? 'Une erreur est survenue',
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
        title: 'Test réussi',
        description: 'Votre caméra et micro fonctionnent correctement',
      });
    } catch (error) {
      debugLog('Media devices test error:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible d\'accéder à la caméra ou au micro',
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

      // Get meeting token
      const tokenResponse = await fetch('/api/daily/get-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        throw new Error(error?.error ?? 'Impossible d\'accéder à l\'appel');
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
        showLeaveButton: true,
        showFullscreenButton: true,
      });

      callFrameRef.current = callFrame;

      // Set up event listeners
      callFrame
        .on('joined-meeting', handleJoinedMeeting)
        .on('participant-joined', handleParticipantJoined)
        .on('participant-left', handleParticipantLeft)
        .on('left-meeting', handleLeftMeeting)
        .on('error', handleCallError);

      // Join the call
      await callFrame.join({
        url: booking.dailyRoomUrl,
        token: tokenData.token,
      });

      debugLog('Call joined successfully');
      
      setCallState({ 
        phase: 'in-call',
        callStartTime: new Date(),
      });
      
      await logCallEvent('CALL_JOINED', { 
        timestamp: new Date().toISOString(),
        roomUrl: booking.dailyRoomUrl,
      });

    } catch (error: any) {
      debugLog('Join call error:', error);
      setCallState({ 
        phase: 'error', 
        error: error?.message ?? 'Impossible de rejoindre l\'appel' 
      });
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error?.message ?? 'Impossible de rejoindre l\'appel',
      });
      
      await logCallEvent('CALL_ERROR', {
        error: error?.message,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleJoinedMeeting = async (event?: DailyEvent) => {
    debugLog('Joined meeting event:', event);
    await logCallEvent('CALL_STARTED', {
      timestamp: new Date().toISOString(),
      participants: event?.participants ? Object.keys(event.participants).length : 1,
    });
  };

  const handleParticipantJoined = async (event?: DailyEventObjectParticipant) => {
    debugLog('Participant joined:', event);
    await logCallEvent('PARTICIPANT_JOINED', {
      participantId: event?.participant?.user_id,
      timestamp: new Date().toISOString(),
    });
  };

  const handleParticipantLeft = async (event?: DailyEventObjectParticipant) => {
    debugLog('Participant left:', event);
    await logCallEvent('PARTICIPANT_LEFT', {
      participantId: event?.participant?.user_id,
      timestamp: new Date().toISOString(),
    });
  };

  const handleLeftMeeting = async () => {
    debugLog('Left meeting');
    await logCallEvent('CALL_ENDED', {
      timestamp: new Date().toISOString(),
      duration: elapsedTime,
    });
    
    setCallState({ phase: 'ended' });
    
    // Redirect to summary page after a short delay
    setTimeout(() => {
      router.push(`/call/${bookingId}/summary`);
    }, 2000);
  };

  const handleCallError = async (event?: any) => {
    debugLog('Call error:', event);
    await logCallEvent('CALL_ERROR', {
      error: event?.errorMsg || event?.error || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    
    toast({
      variant: 'destructive',
      title: 'Erreur durant l\'appel',
      description: event?.errorMsg || 'Une erreur est survenue',
    });
  };

  const toggleCamera = async () => {
    if (callFrameRef.current) {
      try {
        await callFrameRef.current.setLocalVideo(!isCameraOn);
        setIsCameraOn(!isCameraOn);
        await logCallEvent('CAMERA_TOGGLED', {
          enabled: !isCameraOn,
          timestamp: new Date().toISOString(),
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
        await logCallEvent('MIC_TOGGLED', {
          enabled: !isMicOn,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        debugLog('Toggle mic error:', error);
      }
    }
  };

  const endCall = async () => {
    if (callFrameRef.current) {
      debugLog('Ending call...');
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

  const logCallEvent = async (event: string, metadata?: any) => {
    if (!bookingId) return;
    
    try {
      debugLog('Logging event:', event, metadata);
      
      await fetch('/api/call-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          event,
          metadata,
        }),
      });
    } catch (error) {
      debugLog('Log event error:', error);
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

  // Render loading state
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

  // Render waiting state (countdown)
  if (callState.phase === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-6 h-6 text-purple-600" />
                Appel à venir
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">{booking?.callOffer?.title}</h2>
                <p className="text-gray-600 mb-6">
                  avec {booking?.callOffer?.creator?.user?.name}
                </p>
                
                <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-8 mb-6">
                  <p className="text-sm text-gray-600 mb-2">L'appel sera accessible dans</p>
                  <div className="text-5xl font-bold text-purple-600 mb-2">
                    {formatCountdown(timeUntilCall)}
                  </div>
                  <p className="text-sm text-gray-500">
                    Prévu le {new Date(booking?.callOffer?.dateTime).toLocaleString('fr-FR')}
                  </p>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <p>✓ Vous pourrez rejoindre l'appel 15 minutes avant l'heure prévue</p>
                  <p>✓ Assurez-vous d'avoir une bonne connexion internet</p>
                  <p>✓ Préparez votre caméra et votre microphone</p>
                </div>
              </div>
              
              <div className="flex gap-4 justify-center">
                <Button onClick={() => router.push('/dashboard/user')} variant="outline">
                  Retour au dashboard
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Actualiser
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render pre-call state (camera/mic test)
  if (callState.phase === 'pre-call') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 flex-wrap">
                Prêt à rejoindre l'appel
                {booking?.isTestBooking && (
                  <Badge className="bg-blue-500 text-white">
                    🧪 Mode Test
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold mb-2">{booking?.callOffer?.title}</h2>
                  <p className="text-gray-600">avec {booking?.callOffer?.creator?.user?.name}</p>
                  <p className="text-sm text-gray-500">
                    Durée prévue: {booking?.callOffer?.duration} minutes
                  </p>
                  {booking?.isTestBooking && (
                    <p className="text-sm text-blue-600 font-medium mt-2">
                      ℹ️ Ceci est un appel de test pour le développement
                    </p>
                  )}
                </div>

                <div className="bg-gray-100 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold">Testez vos équipements</h3>
                  
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
                        Test en cours...
                      </>
                    ) : (
                      <>
                        <Settings className="w-4 h-4 mr-2" />
                        Tester caméra et micro
                      </>
                    )}
                  </Button>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p>✓ Vérifiez que votre caméra fonctionne</p>
                    <p>✓ Testez votre microphone</p>
                    <p>✓ Trouvez un endroit calme</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button onClick={() => router.push('/dashboard/user')} variant="outline" className="flex-1">
                  Annuler
                </Button>
                <Button 
                  onClick={joinCall} 
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  <Video className="w-4 h-4 mr-2" />
                  Rejoindre l'appel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render in-call state
  if (callState.phase === 'in-call') {
    return (
      <div className="h-screen bg-black flex flex-col">
        {/* Call container */}
        <div className="flex-1 relative">
          <div ref={callContainerRef} className="w-full h-full" />
          
          {/* Timer overlay */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full">
            <div className="flex items-center gap-4">
              {booking?.isTestBooking && (
                <Badge className="bg-blue-500 text-white">
                  🧪 Test
                </Badge>
              )}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(elapsedTime)}</span>
              </div>
              {!booking?.isTestBooking && (
                <div className="text-sm text-gray-300">
                  Temps restant: {formatTime(timeRemaining)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-900 p-4">
          <div className="container mx-auto max-w-4xl flex items-center justify-center gap-4">
            <Button
              onClick={toggleCamera}
              variant={isCameraOn ? "default" : "destructive"}
              size="lg"
              className="rounded-full w-14 h-14"
            >
              {isCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </Button>
            
            <Button
              onClick={toggleMic}
              variant={isMicOn ? "default" : "destructive"}
              size="lg"
              className="rounded-full w-14 h-14"
            >
              {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </Button>
            
            <Button
              onClick={endCall}
              variant="destructive"
              size="lg"
              className="rounded-full w-14 h-14"
            >
              <Phone className="w-6 h-6 rotate-135" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render ended state
  if (callState.phase === 'ended') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <Phone className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Appel terminé</h2>
              <p className="text-gray-600 mb-6">
                Redirection vers le résumé...
              </p>
              <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render error state
  if (callState.phase === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-500" />
                Erreur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">{callState.error}</p>
              <div className="flex gap-4">
                <Button onClick={() => router.push('/dashboard/user')} variant="outline">
                  Retour au dashboard
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Réessayer
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

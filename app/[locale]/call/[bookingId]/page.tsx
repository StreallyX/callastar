// ==============================
// app/[locale]/call/[bookingId]/page.tsx  (CallPage)
// ==============================
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logCallEvent } from '@/lib/call-types';
import { useTranslations } from 'next-intl';
import { WaitingRoom } from './components/WaitingRoom';
import { CallInterface } from './components/CallInterface';

const DEBUG_MODE = process.env.NODE_ENV === 'development';
const debugLog = (...args: any[]) => {
  if (DEBUG_MODE) console.log('[CallPage]', ...args);
};

type CallPhase = 'loading' | 'waiting' | 'in-call' | 'ended' | 'error';

interface CallState {
  phase: CallPhase;
  error?: string;
}

type PageProps = {
  params: { bookingId: string; locale: string };
};

export default function CallPage({ params }: PageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('call.room');

  const bookingId = params?.bookingId;

  const [booking, setBooking] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [callState, setCallState] = useState<CallState>({ phase: 'loading' });
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  // Prevent accidental page close during call
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (callState.phase === 'in-call' && bookingId) {
        logCallEvent(bookingId, 'DISCONNECTION_INVOLUNTARY', { reason: 'page-unload' });
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [callState.phase, bookingId]);

  const initCall = useCallback(async () => {
    if (!bookingId) {
      setCallState({ phase: 'error', error: t('bookingNotFound') });
      return;
    }

    try {
      debugLog('Initializing call for booking:', bookingId);

      const bookingResponse = await fetch(`/api/bookings/${bookingId}`);
      if (!bookingResponse.ok) throw new Error(t('bookingNotFound'));

      const bookingData = await bookingResponse.json();
      const fetchedBooking = bookingData?.booking;

      if (!fetchedBooking?.callOffer?.dateTime || !fetchedBooking?.callOffer?.duration) {
        throw new Error(t('bookingNotFound'));
      }

      setBooking(fetchedBooking);
      debugLog('Booking data:', fetchedBooking);

      // Check if call is in the past (sauf test booking)
      const callTime = new Date(fetchedBooking.callOffer.dateTime).getTime();
      const now = Date.now();
      const durationMs = Number(fetchedBooking.callOffer.duration) * 60 * 1000;

      if (Number.isFinite(callTime) && Number.isFinite(durationMs)) {
        if (now > callTime + durationMs && !fetchedBooking.isTestBooking) {
          throw new Error(t('callEnded'));
        }
      }

      setCallState({ phase: 'waiting' });

      await logCallEvent(bookingId, 'PRE_CALL_ENTERED', { timestamp: new Date().toISOString() });
    } catch (error: any) {
      debugLog('Init call error:', error);

      const msg = error?.message ?? t('callError');
      setCallState({ phase: 'error', error: msg });

      toast({
        variant: 'destructive',
        title: t('error'),
        description: msg,
      });

      if (bookingId) {
        await logCallEvent(bookingId, 'CALL_ERROR', { error: msg, stage: 'init' });
      }
    }
  }, [bookingId, t, toast]);

  // Initialize call
  useEffect(() => {
    initCall();
  }, [initCall]);

  const handleTestMedia = useCallback(async () => {
    try {
      debugLog('Testing media devices...');
      toast({ title: t('testSuccess'), description: t('testSuccessDesc') });
    } catch (error) {
      debugLog('Media devices test error:', error);

      toast({
        variant: 'destructive',
        title: t('testError'),
        description: t('testErrorDesc'),
      });

      if (bookingId) {
        await logCallEvent(bookingId, 'CALL_ERROR', {
          error: 'media-devices-access-denied',
          stage: 'pre-call',
        });
      }
    }
  }, [bookingId, t, toast]);

  const handleJoinCall = useCallback(async () => {
    if (!bookingId || !booking) return;

    try {
      debugLog('Joining call...');
      setCallState({ phase: 'loading' });

      const tokenResponse = await fetch('/api/daily/get-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });

      let tokenPayload: any = null;
      try {
        tokenPayload = await tokenResponse.json();
      } catch {
        tokenPayload = null;
      }

      if (!tokenResponse.ok) {
        throw new Error(tokenPayload?.error ?? t('cannotAccessCall'));
      }

      if (!tokenPayload?.token) {
        throw new Error(t('cannotJoinCall'));
      }

      setToken(tokenPayload.token);
      setSessionStartTime(new Date());

      debugLog('Token received, switching to in-call...');
      setCallState({ phase: 'in-call' });
    } catch (error: any) {
      debugLog('Join call error:', error);

      const msg = error?.message ?? t('cannotJoinCall');
      setCallState({ phase: 'error', error: msg });

      toast({
        variant: 'destructive',
        title: t('error'),
        description: msg,
      });

      if (bookingId) {
        await logCallEvent(bookingId, 'CALL_ERROR', { error: msg, stage: 'join' });
      }
    }
  }, [bookingId, booking, t, toast]);

  const handleCallEnd = useCallback(() => {
    debugLog('Call ended');
    setCallState({ phase: 'ended' });

    // Redirect to summary page
    if (bookingId) {
      window.setTimeout(() => {
        router.push(`/call/${bookingId}/summary`);
      }, 2000);
    }
  }, [bookingId, router]);

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

  if (callState.phase === 'waiting' && booking) {
    return <WaitingRoom booking={booking} onJoinCall={handleJoinCall} onTestMedia={handleTestMedia} />;
  }

  if (callState.phase === 'in-call' && booking && token && sessionStartTime && bookingId) {
    return (
      <CallInterface
        booking={booking}
        bookingId={bookingId}
        roomUrl={booking.dailyRoomUrl}
        token={token}
        onCallEnd={handleCallEnd}
        startTime={sessionStartTime}
      />
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
              <p className="text-gray-600 mb-6">{t('redirecting')}</p>
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
              <div className="flex gap-4 flex-col sm:flex-row">
                <Button onClick={() => router.push('/dashboard/user')} variant="outline" className="flex-1">
                  {t('backToDashboard')}
                </Button>
                <Button onClick={() => window.location.reload()} className="flex-1">
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

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CallPage({ params }: { params: Promise<{ bookingId: string }> | { bookingId: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Handle both Promise and plain object params (Next.js 14+ compatibility)
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
  }, [bookingId]);

  const initCall = async () => {
    if (!bookingId) return;

    try {
      // Get booking details
      const bookingResponse = await fetch(`/api/bookings/${bookingId}`);
      if (!bookingResponse.ok) {
        throw new Error('Réservation introuvable');
      }
      const bookingData = await bookingResponse.json();
      const fetchedBooking = bookingData?.booking;
      setBooking(fetchedBooking);

      // Check if call is accessible
      const callTime = new Date(fetchedBooking?.callOffer?.dateTime).getTime();
      const now = Date.now();
      const fifteenMinutesBefore = callTime - 15 * 60 * 1000;

      if (now < fifteenMinutesBefore) {
        const minutesUntil = Math.round((fifteenMinutesBefore - now) / 60000);
        setError(`L'accès à l'appel sera disponible dans ${minutesUntil} minutes`);
        setLoading(false);
        return;
      }

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
    } catch (error: any) {
      setError(error?.message ?? 'Une erreur est survenue');
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error?.message ?? 'Une erreur est survenue',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-orange-500" />
                Appel non disponible
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">{error}</p>
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

  if (!booking || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Erreur de chargement</h1>
          <Button onClick={() => router.push('/dashboard/user')} variant="outline">
            Retour au dashboard
          </Button>
        </div>
      </div>
    );
  }

  const dailyUrl = `${booking?.dailyRoomUrl}?t=${token}`;

  return (
    <div className="min-h-screen bg-black">
      <div className="w-full h-screen">
        <iframe
          ref={iframeRef}
          src={dailyUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}

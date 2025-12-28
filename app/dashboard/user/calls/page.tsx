'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Video, Loader2, Download, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { CurrencyDisplay } from '@/components/ui/currency-display';

export default function CallsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (!userResponse.ok) {
        router.push('/auth/login');
        return;
      }
      const userData = await userResponse.json();
      setUser(userData?.user);

      const bookingsResponse = await fetch('/api/bookings');
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        setBookings(bookingsData?.bookings ?? []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCalendar = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/calendar`);
      if (!response.ok) {
        throw new Error('Impossible de télécharger le fichier calendrier');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `appel-${bookingId}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Fichier calendrier téléchargé !');
    } catch (error) {
      toast.error('Erreur lors du téléchargement');
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

  const upcomingBookings = bookings.filter((b: any) => {
    const callDate = new Date(b?.callOffer?.dateTime ?? new Date());
    return (b?.status === 'CONFIRMED' || b?.status === 'PENDING') && callDate.getTime() > Date.now();
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge className="bg-green-500">Confirmé</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-500">En attente</Badge>;
      case 'COMPLETED':
        return <Badge variant="outline">Terminé</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Annulé</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const canJoinCall = (booking: any) => {
    const callTime = new Date(booking?.callOffer?.dateTime ?? new Date()).getTime();
    const now = Date.now();
    const fifteenMinutesBefore = callTime - 15 * 60 * 1000;
    const twentyFourHoursAfter = callTime + 24 * 60 * 60 * 1000;
    
    return now >= fifteenMinutesBefore && now <= twentyFourHoursAfter;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard/user">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au dashboard
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Mes Appels à Venir</h1>
          <p className="text-gray-600">Tous vos appels confirmés et à venir</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Appels à venir</CardTitle>
            <CardDescription>Vous avez {upcomingBookings.length} appel(s) à venir</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingBookings.length > 0 ? (
              <div className="space-y-4">
                {upcomingBookings.map((booking: any) => {
                  const callDate = new Date(booking?.callOffer?.dateTime ?? new Date());
                  const formattedDate = callDate.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  });
                  const formattedTime = callDate.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <Card key={booking?.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-lg">{booking?.callOffer?.title}</h3>
                              {getStatusBadge(booking?.status)}
                            </div>
                            <p className="text-sm text-gray-600">avec {booking?.callOffer?.creator?.user?.name}</p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Calendar className="w-4 h-4" />
                              <span>{formattedDate}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Clock className="w-4 h-4" />
                              <span>{formattedTime} - {booking?.callOffer?.duration} minutes</span>
                            </div>
                            <div className="text-sm text-gray-500">
                              <CurrencyDisplay 
                                amount={Number(booking?.totalPrice)} 
                                currency={booking?.callOffer?.currency || 'EUR'} 
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {canJoinCall(booking) && (
                              <Button
                                onClick={() => router.push(`/call/${booking?.id}`)}
                                className="bg-gradient-to-r from-purple-600 to-pink-600"
                              >
                                <Video className="w-4 h-4 mr-2" />
                                Rejoindre
                              </Button>
                            )}
                            <Button
                              onClick={() => handleDownloadCalendar(booking?.id)}
                              variant="outline"
                              size="sm"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Calendrier
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Aucun appel à venir</p>
                <Link href="/creators">
                  <Button variant="outline" className="mt-4">
                    Parcourir les créateurs
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

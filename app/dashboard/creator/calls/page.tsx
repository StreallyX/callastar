'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Loader2, ArrowLeft, Video, User, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { CurrencyDisplay } from '@/components/ui/currency-display';

export default function CallsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');
  const [creatorCurrency, setCreatorCurrency] = useState<string>('EUR');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (!userResponse.ok) {
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        router.push('/auth/login');
        return;
      }
      const userData = await userResponse.json();
      
      if (userData?.user?.role !== 'CREATOR') {
        router.push('/dashboard/user');
        return;
      }
      
      setUser(userData?.user);
      
      const creatorId = userData?.user?.creator?.id;

      // ✅ FIX: Get real Stripe currency from balance API
      if (creatorId) {
        const balanceResponse = await fetch(`/api/stripe/balance/${creatorId}`);
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          setCreatorCurrency(balanceData.stripeCurrency || balanceData.currency || 'EUR');
        }
      }

      // Get bookings
      const bookingsResponse = await fetch('/api/bookings/creator');
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        setBookings(bookingsData?.bookings ?? []);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
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

  // Filter bookings
  const now = new Date();
  const upcomingBookings = bookings.filter((b) => {
    const callDate = new Date(b.callOffer?.dateTime);
    return (b.status === 'CONFIRMED' || b.status === 'PENDING') && callDate > now;
  });
  const pastBookings = bookings.filter((b) => {
    const callDate = new Date(b.callOffer?.dateTime);
    return b.status === 'COMPLETED' || (callDate <= now && b.status !== 'CANCELLED');
  });
  const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED');

  const filteredBookings = 
    filter === 'UPCOMING' ? upcomingBookings :
    filter === 'PAST' ? pastBookings :
    filter === 'CANCELLED' ? cancelledBookings :
    bookings;

  const statusCounts = {
    ALL: bookings.length,
    UPCOMING: upcomingBookings.length,
    PAST: pastBookings.length,
    CANCELLED: cancelledBookings.length,
  };

  const getStatusInfo = (booking: any) => {
    const callDate = new Date(booking.callOffer?.dateTime);
    const now = new Date();
    
    if (booking.status === 'CANCELLED') {
      return { label: 'Annulé', color: 'bg-red-500' };
    } else if (booking.status === 'COMPLETED') {
      return { label: 'Terminé', color: 'bg-blue-500' };
    } else if (booking.status === 'CONFIRMED' && callDate > now) {
      return { label: 'Confirmé', color: 'bg-green-500' };
    } else if (booking.status === 'PENDING') {
      return { label: 'En attente', color: 'bg-yellow-500' };
    } else {
      return { label: 'Passé', color: 'bg-gray-500' };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/creator">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Mes Appels</h1>
          <p className="text-gray-600">Gérez vos appels passés et à venir</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{statusCounts.ALL}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">À venir</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{statusCounts.UPCOMING}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Passés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{statusCounts.PAST}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Annulés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{statusCounts.CANCELLED}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Buttons */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === 'ALL' ? 'default' : 'outline'}
                onClick={() => setFilter('ALL')}
                size="sm"
              >
                Tous ({statusCounts.ALL})
              </Button>
              <Button
                variant={filter === 'UPCOMING' ? 'default' : 'outline'}
                onClick={() => setFilter('UPCOMING')}
                size="sm"
                className={filter === 'UPCOMING' ? 'bg-green-500' : ''}
              >
                À venir ({statusCounts.UPCOMING})
              </Button>
              <Button
                variant={filter === 'PAST' ? 'default' : 'outline'}
                onClick={() => setFilter('PAST')}
                size="sm"
                className={filter === 'PAST' ? 'bg-blue-500' : ''}
              >
                Passés ({statusCounts.PAST})
              </Button>
              <Button
                variant={filter === 'CANCELLED' ? 'default' : 'outline'}
                onClick={() => setFilter('CANCELLED')}
                size="sm"
                className={filter === 'CANCELLED' ? 'bg-red-500' : ''}
              >
                Annulés ({statusCounts.CANCELLED})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Calls List */}
        {filteredBookings.length > 0 ? (
          <div className="space-y-4">
            {filteredBookings.map((booking: any) => {
              const callDate = new Date(booking?.callOffer?.dateTime ?? new Date());
              const statusInfo = getStatusInfo(booking);
              const canJoin = booking.status === 'CONFIRMED' && callDate > now && callDate <= new Date(now.getTime() + 30 * 60000);
              
              return (
                <Card key={booking?.id}>
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-3 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                            <Video className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-lg">{booking?.callOffer?.title}</h3>
                              <Badge className={statusInfo.color}>
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <User className="w-4 h-4" />
                              <span>Avec: {booking?.user?.name}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-600 ml-16">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{callDate.toLocaleDateString('fr-FR')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{callDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            <CurrencyDisplay 
                              amount={Number(booking?.callOffer?.price ?? 0)} 
                              currency={booking?.callOffer?.currency || creatorCurrency} 
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{booking?.callOffer?.duration} min</span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        {canJoin ? (
                          <Button
                            onClick={() => router.push(`/call/${booking?.id}`)}
                            className="bg-gradient-to-r from-purple-600 to-pink-600"
                          >
                            <Video className="w-4 h-4 mr-2" />
                            Rejoindre
                          </Button>
                        ) : booking.status === 'CONFIRMED' && callDate > now ? (
                          <Button variant="outline" disabled>
                            Débute bientôt
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {filter === 'ALL' 
                  ? 'Aucun appel' 
                  : filter === 'UPCOMING'
                  ? 'Aucun appel à venir'
                  : filter === 'PAST'
                  ? 'Aucun appel passé'
                  : 'Aucun appel annulé'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

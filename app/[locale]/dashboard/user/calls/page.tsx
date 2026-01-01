'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Video, Loader2, Download, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/navigation';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { safeToNumberOrZero } from '@/lib/price-validation';
import { DateTimeDisplay, LiveCountdown } from '@/components/ui/datetime-display';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';

export default function CallsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard.user.calls');
  const st = useTranslations('dashboard.user.status');

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
      toast.error(t('errors.load'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCalendar = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/calendar`);
      if (!response.ok) {
        throw new Error();
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-${bookingId}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(t('calendar.downloadSuccess'));
    } catch (error) {
      toast.error(t('calendar.downloadError'));
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
    return (
      (b?.status === 'CONFIRMED' || b?.status === 'PENDING') &&
      callDate.getTime() > Date.now()
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge className="bg-green-500">{st('confirmed')}</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-500">{st('pending')}</Badge>;
      case 'COMPLETED':
        return <Badge variant="outline">{st('completed')}</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">{st('cancelled')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const canJoinCall = (booking: any) => {
    if (booking?.isTestBooking) {
      return true;
    }

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
              {t('backToDashboard')}
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </CardHeader>

          <CardContent>
            {upcomingBookings.length > 0 ? (
              <div className="space-y-4">
                {upcomingBookings.map((booking: any) => (
                  <Card key={booking?.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-semibold text-lg">
                              {booking?.callOffer?.title}
                            </h3>
                            {getStatusBadge(booking?.status)}
                            {booking?.isTestBooking && (
                              <Badge className="bg-blue-500 text-white">
                                {t('testMode')}
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm text-gray-600">
                            {t('with')} {booking?.callOffer?.creator?.user?.name}
                          </p>

                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="w-4 h-4" />
                            <DateTimeDisplay
                              date={booking?.callOffer?.dateTime}
                              timezone={user?.timezone}
                              format="full"
                            />
                          </div>

                          <div className="flex items-center gap-2 text-sm font-medium text-purple-600">
                            <Clock className="w-4 h-4" />
                            <LiveCountdown
                              date={booking?.callOffer?.dateTime}
                              timezone={user?.timezone}
                            />
                          </div>

                          <div className="text-sm text-gray-500">
                            {t('duration')} : {booking?.callOffer?.duration}{' '}
                            {t('minutes')}
                          </div>

                          <div className="text-sm text-gray-500">
                            <CurrencyDisplay
                              amount={safeToNumberOrZero(booking?.totalPrice)}
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
                              {t('join')}
                            </Button>
                          )}

                          <Button
                            onClick={() => handleDownloadCalendar(booking?.id)}
                            variant="outline"
                            size="sm"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {t('calendar.download')}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">{t('noCalls')}</p>
                <Link href="/creators">
                  <Button variant="outline" className="mt-4">
                    {t('browseCreators')}
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

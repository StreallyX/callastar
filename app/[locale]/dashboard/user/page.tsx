'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Video, 
  MessageSquare, 
  Star, 
  Bell,
  Settings,
  ArrowRight,
  Phone
} from 'lucide-react';
import { Link } from '@/navigation';

interface NavigationCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  badge?: {
    text: string;
    variant: 'default' | 'destructive' | 'outline' | 'secondary';
  };
  count?: number;
}

interface Booking {
  status?: string;
  callOffer?: {
    dateTime?: string;
  };
}

interface CallRequest {
  status?: string;
}

export default function UserDashboard() {
  const router = useRouter();
  const t = useTranslations('dashboard.user');
  const tCards = useTranslations('dashboard.user.cards');
  const tCommon = useTranslations('dashboard.common');
  const [user, setUser] = useState<{ name?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [stats, setStats] = useState({
    upcomingCalls: 0,
    pendingRequests: 0,
    completedCalls: 0,
    unreadNotifications: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      // Get user data
      const userResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (!userResponse.ok) {
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        router.push('/auth/login');
        return;
      }
      const userData = await userResponse.json();
      setUser(userData?.user);
      setAuthChecked(true);

      // Get bookings
      const bookingsResponse = await fetch('/api/bookings');
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        const bookings = bookingsData?.bookings ?? [];
        
        // Count upcoming calls
        const upcomingCalls = bookings.filter((b: Booking) => {
          const callDate = new Date(b?.callOffer?.dateTime ?? new Date());
          return (b?.status === 'CONFIRMED' || b?.status === 'PENDING') && callDate.getTime() > Date.now();
        }).length;

        // Count completed calls
        const completedCalls = bookings.filter((b: Booking) => {
          const callDate = new Date(b?.callOffer?.dateTime ?? new Date());
          return b?.status === 'COMPLETED' || callDate.getTime() <= Date.now();
        }).length;

        setStats((prev) => ({ ...prev, upcomingCalls, completedCalls }));
      }

      // Get call requests
      const requestsResponse = await fetch('/api/call-requests?type=sent');
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        const requests = Array.isArray(requestsData) ? requestsData : [];
        const pendingRequests = requests.filter((r: CallRequest) => r?.status === 'PENDING').length;
        setStats((prev) => ({ ...prev, pendingRequests }));
      }

      // Get unread notifications count
      const notificationsResponse = await fetch('/api/notifications?read=false');
      if (notificationsResponse.ok) {
        const notificationsData = await notificationsResponse.json();
        const unreadNotifications = notificationsData?.unreadCount ?? 0;
        setStats((prev) => ({ ...prev, unreadNotifications }));
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  // Navigation cards configuration
  const navigationCards: NavigationCard[] = [
    {
      title: tCards('calls.title'),
      description: tCards('calls.description'),
      icon: <Phone className="w-6 h-6" />,
      href: '/dashboard/user/calls',
      count: stats.upcomingCalls,
    },
    {
      title: tCards('requests.title'),
      description: tCards('requests.description'),
      icon: <MessageSquare className="w-6 h-6" />,
      href: '/dashboard/user/requests',
      count: stats.pendingRequests,
      badge: stats.pendingRequests > 0 ? {
        text: tCards('requests.pending', { count: stats.pendingRequests }),
        variant: 'destructive'
      } : undefined,
    },
    {
      title: tCards('history.title'),
      description: tCards('history.description'),
      icon: <Star className="w-6 h-6" />,
      href: '/dashboard/user/history',
      count: stats.completedCalls,
    },
    {
      title: tCards('notifications.title'),
      description: tCards('notifications.description'),
      icon: <Bell className="w-6 h-6" />,
      href: '/dashboard/user/notifications',
      count: stats.unreadNotifications,
      badge: stats.unreadNotifications > 0 ? {
        text: tCards('notifications.unread', { count: stats.unreadNotifications }),
        variant: 'destructive'
      } : undefined,
    },
    {
      title: tCards('settings.title'),
      description: tCards('settings.description'),
      icon: <Settings className="w-6 h-6" />,
      href: '/dashboard/user/settings',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{tCommon('myDashboard')}</h1>
          <p className="text-gray-600">{t('welcome', { name: user?.name })}</p>
        </div>

        {/* Navigation Hub */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6">{t('navigation')}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {navigationCards.map((card) => (
              <Link key={card.href} href={card.href}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="p-3 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                        {card.icon}
                      </div>
                      {card.badge && (
                        <Badge variant={card.badge.variant}>
                          {card.badge.text}
                        </Badge>
                      )}
                      {card.count !== undefined && !card.badge && (
                        <Badge variant="outline">
                          {card.count}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl mt-4">{card.title}</CardTitle>
                    <CardDescription>{card.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-purple-600 font-medium">
                      {t('navigation')}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Link to Creators */}
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-1">Découvrir les créateurs</h3>
                <p className="text-sm text-gray-600">
                  Parcourez tous nos créateurs et réservez votre premier appel
                </p>
              </div>
              <Link href="/creators">
                <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Parcourir
                </button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

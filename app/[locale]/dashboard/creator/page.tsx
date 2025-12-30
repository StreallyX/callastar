'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  Loader2, 
  Video, 
  TrendingUp, 
  MessageSquare, 
  Star, 
  CreditCard, 
  ArrowRight,
  Bell,
  FileText,
  Phone,
  Package
} from 'lucide-react';
import { toast } from 'sonner';
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

export default function CreatorDashboard() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard.creator');
  const tCards = useTranslations('dashboard.creator.cards');
  const tPayment = useTranslations('dashboard.creator.paymentSetup');
  const tToast = useTranslations('toast.stripe');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [stripeOnboarding, setStripeOnboarding] = useState({
    onboarded: false,
    loading: true,
  });
  const [stats, setStats] = useState({
    activeOffers: 0,
    pendingRequests: 0,
    upcomingCalls: 0,
    unreadNotifications: 0,
  });

  useEffect(() => {
    fetchData();
    
    // Check if returning from Stripe onboarding
    const params = new URLSearchParams(window.location.search);
    const onboardingParam = params.get('onboarding');
    
    if (onboardingParam === 'success' || onboardingParam === 'refresh') {
      console.log('[Onboarding Return] Re-verifying account status...');
      
      if (onboardingParam === 'success') {
        toast.info(tToast('verifying'));
      }
      
      setTimeout(async () => {
        try {
          const response = await fetch('/api/stripe/connect-onboard');
          if (response.ok) {
            const data = await response.json();
            setStripeOnboarding({
              onboarded: data?.onboarded ?? false,
              loading: false,
            });
            
            if (data?.onboarded) {
              toast.success(tToast('configured'));
            } else if (data?.issues && data.issues.length > 0) {
              toast.warning(tToast('incompleteConfig', { issue: data.issues[0] }));
            } else {
              toast.info(tToast('verificationInProgress'));
            }
          }
        } catch (error) {
          console.error('[Onboarding Return] Error re-verifying:', error);
        }
        
        window.history.replaceState({}, '', window.location.pathname);
      }, 2000);
    }
  }, []);

  const fetchData = async () => {
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
      
      if (userData?.user?.role !== 'CREATOR') {
        router.push('/dashboard/user');
        return;
      }
      
      setUser(userData?.user);
      setAuthChecked(true);

      // Get offers count
      const offersResponse = await fetch(`/api/call-offers?creatorId=${userData?.user?.creator?.id}`);
      if (offersResponse.ok) {
        const offersData = await offersResponse.json();
        const activeOffers = offersData?.callOffers?.filter((o: any) => o?.status === 'AVAILABLE').length ?? 0;
        setStats((prev) => ({ ...prev, activeOffers }));
      }

      // Get pending requests count
      const requestsResponse = await fetch('/api/call-requests?type=received');
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        // L'API retourne directement le tableau, pas un objet avec une propriété callRequests
        const requests = Array.isArray(requestsData) ? requestsData : [];
        const pendingRequests = requests.filter((r: any) => r?.status === 'PENDING').length;
        setStats((prev) => ({ ...prev, pendingRequests }));
      }

      // Get upcoming calls count
      const bookingsResponse = await fetch('/api/bookings/creator');
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        const allBookings = bookingsData?.bookings ?? [];
        const upcomingCalls = allBookings.filter((b: any) => 
          b?.status === 'CONFIRMED' || b?.status === 'PENDING'
        ).length;
        setStats((prev) => ({ ...prev, upcomingCalls }));
      }

      // Get unread notifications count
      const notificationsResponse = await fetch('/api/notifications?read=false');
      if (notificationsResponse.ok) {
        const notificationsData = await notificationsResponse.json();
        const unreadNotifications = notificationsData?.unreadCount ?? 0;
        setStats((prev) => ({ ...prev, unreadNotifications }));
      }

      // Check Stripe Connect onboarding status
      const onboardingResponse = await fetch('/api/stripe/connect-onboard');
      if (onboardingResponse.ok) {
        const onboardingData = await onboardingResponse.json();
        setStripeOnboarding({
          onboarded: onboardingData?.onboarded ?? false,
          loading: false,
        });
      } else {
        setStripeOnboarding({ onboarded: false, loading: false });
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartStripeOnboarding = async () => {
    const toastId = toast(tToast('redirecting'), { duration: Infinity });
    
    try {
      const response = await fetch('/api/stripe/connect-onboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        toast.dismiss(toastId);
        toast.success(tToast('redirectingSuccess'));
        window.location.href = data.url;
      } else {
        const error = await response.json();
        toast.dismiss(toastId);
        toast.error(error?.error ?? tToast('onboardingError'));
        console.error('Stripe onboarding error:', error);
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(tToast('unknownError', { error: error?.message || tToast('genericError') }));
      console.error('Stripe onboarding error:', error);
    }
  };

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
      title: tCards('offers.title'),
      description: tCards('offers.description'),
      icon: <Calendar className="w-6 h-6" />,
      href: '/dashboard/creator/offers',
      count: stats.activeOffers,
    },
    {
      title: tCards('requests.title'),
      description: tCards('requests.description'),
      icon: <FileText className="w-6 h-6" />,
      href: '/dashboard/creator/requests',
      count: stats.pendingRequests,
      badge: stats.pendingRequests > 0 ? {
        text: tCards('requests.pending', { count: stats.pendingRequests }),
        variant: 'destructive'
      } : undefined,
    },
    {
      title: tCards('calls.title'),
      description: tCards('calls.description'),
      icon: <Phone className="w-6 h-6" />,
      href: '/dashboard/creator/calls',
      count: stats.upcomingCalls,
    },
    {
      title: tCards('reviews.title'),
      description: tCards('reviews.description'),
      icon: <Star className="w-6 h-6" />,
      href: '/dashboard/creator/reviews',
    },
    {
      title: tCards('payments.title'),
      description: tCards('payments.description'),
      icon: <CreditCard className="w-6 h-6" />,
      href: '/dashboard/creator/payments',
    },
    {
      title: tCards('earnings.title'),
      description: tCards('earnings.description'),
      icon: <TrendingUp className="w-6 h-6" />,
      href: '/dashboard/creator/earnings',
    },
    {
      title: tCards('fees.title'),
      description: tCards('fees.description'),
      icon: <Package className="w-6 h-6" />,
      href: '/dashboard/creator/fees',
    },
    {
      title: tCards('notifications.title'),
      description: tCards('notifications.description'),
      icon: <Bell className="w-6 h-6" />,
      href: '/dashboard/creator/notifications',
      count: stats.unreadNotifications,
      badge: stats.unreadNotifications > 0 ? {
        text: tCards('notifications.unread', { count: stats.unreadNotifications }),
        variant: 'destructive'
      } : undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('welcome', { name: user?.name })}</p>
        </div>

        {/* Stripe Connect Onboarding Alert */}
        {!stripeOnboarding.loading && !stripeOnboarding.onboarded && (
          <Card className="mb-8 border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800">
                <DollarSign className="w-5 h-5" />
                {tPayment('required')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-yellow-700 mb-4">
                {tPayment('completeSetup')}
              </p>
              <Button 
                onClick={handleStartStripeOnboarding}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                {tPayment('configureStripe')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Payment Setup Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {tPayment('title')}
            </CardTitle>
            <CardDescription>
              {tPayment('description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {stripeOnboarding.loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                ) : stripeOnboarding.onboarded ? (
                  <Badge className="bg-green-500 text-white">
                    Paiements activés
                  </Badge>
                ) : (
                  <Badge className="bg-red-500 text-white">
                    Configuration incomplète
                  </Badge>
                )}
                <span className="text-sm text-gray-600">
                  {stripeOnboarding.onboarded 
                    ? tPayment('accountReady')
                    : tPayment('completeConfig')
                  }
                </span>
              </div>
              <Link href="/dashboard/creator/payment-setup">
                <Button variant="outline" size="sm">
                  {stripeOnboarding.onboarded ? tPayment('viewDetails') : tPayment('configure')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* {t('navigation')} Hub */}
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

        {/* Additional Quick Links */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-1">{tCards('payouts.title')}</h3>
                  <p className="text-sm text-gray-600">
                    {tCards('payouts.description')}
                  </p>
                </div>
                <Link href="/dashboard/creator/payouts">
                  <Button variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-100">
                    <Package className="w-4 h-4 mr-2" />
                    Payouts
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-gray-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-1">Paramètres</h3>
                  <p className="text-sm text-gray-600">
                    {tCards('settings.description')}
                  </p>
                </div>
                <Link href="/dashboard/creator/settings">
                  <Button variant="outline">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Paramètres
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

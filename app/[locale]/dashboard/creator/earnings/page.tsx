'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, TrendingUp, DollarSign, Calendar, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/navigation';
import { CurrencyDisplay } from '@/components/ui/currency-display';

export default function EarningsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard.creator.earnings');
  const [user, setUser] = useState<any>(null);
  const [payoutData, setPayoutData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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

      // ✅ FIX: Get real Stripe currency from balance API (like payouts page)
      if (creatorId) {
        const balanceResponse = await fetch(`/api/stripe/balance/${creatorId}`);
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          setCreatorCurrency(balanceData.stripeCurrency || balanceData.currency || 'EUR');
        }
      }

      // ✅ FIX: Get earnings data from new endpoint
      const earningsResponse = await fetch('/api/creator/earnings');
      if (earningsResponse.ok) {
        const earningsData = await earningsResponse.json();
        setPayoutData(earningsData);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('loadError'));
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/creator">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('backToDashboard')}
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        {/* Revenue Summary Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{t('totalTransferred')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                <CurrencyDisplay 
                  amount={payoutData?.summary?.totalEarnings ?? 0} 
                  currency={creatorCurrency} 
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('onStripeAccount')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{t('pending')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                <CurrencyDisplay 
                  amount={payoutData?.summary?.pendingEarnings ?? 0} 
                  currency={creatorCurrency} 
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('securityPeriod')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{t('available')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                <CurrencyDisplay 
                  amount={payoutData?.summary?.readyForPayout ?? 0} 
                  currency={creatorCurrency} 
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('readyForTransfer')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-1">{t('requestPayout')}</h3>
                  <p className="text-sm text-gray-600">
                    {t('requestPayoutDesc')}
                  </p>
                </div>
                <Link href="/dashboard/creator/payouts">
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <DollarSign className="w-4 h-4 mr-2" />
                    {t('payouts')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-gray-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-1">{t('paymentHistory')}</h3>
                  <p className="text-sm text-gray-600">
                    {t('paymentHistoryDesc')}
                  </p>
                </div>
                <Link href="/dashboard/creator/payments">
                  <Button variant="outline">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    {t('view')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Payments */}
        {payoutData?.payments && payoutData.payments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('recentPayments')}</CardTitle>
              <CardDescription>{t('recentPaymentsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payoutData.payments.slice(0, 5).map((payment: any) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="font-medium">{payment.booking?.callOffer?.title}</div>
                      <div className="text-sm text-gray-500">
                        {payment.booking?.user?.name} • {new Date(payment.booking?.callOffer?.dateTime).toLocaleDateString(locale)}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-semibold text-lg">
                        <CurrencyDisplay 
                          amount={Number(payment.amount)} 
                          currency={payment.currency || creatorCurrency} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {payoutData.payments.length > 5 && (
                <div className="mt-4 text-center">
                  <Link href="/dashboard/creator/payments">
                    <Button variant="outline" size="sm">
                      {t('viewAllPayments')}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800 text-base">📋 {t('howItWorks')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-700 space-y-2">
            <p><strong>1. {t('securityPeriod')}:</strong> {t('securityPeriodDesc')}</p>
            <p><strong>2. {t('availability')}:</strong> {t('availabilityDesc')}</p>
            <p><strong>3. {t('requestPayout')}:</strong> {t('requestPayoutInfo')}</p>
            <p><strong>4. {t('automaticTransfer')}:</strong> {t('automaticTransferDesc')}</p>
            <p className="pt-2 border-t border-blue-300 mt-2">
              <strong>{t('bankSetup')}:</strong> {t('bankSetupDesc')}{' '}
              <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                {t('stripeDashboard')}
              </a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/navigation';
import { CurrencyDisplay } from '@/components/ui/currency-display';

type PayoutStatus = 'PAID' | 'READY' | 'HELD' | 'PROCESSING' | 'PENDING';

type Payment = {
  id: string;
  amount: number;
  currency?: string;
  payoutStatus: PayoutStatus;
  payoutDate?: string;
  payoutReleaseDate?: string;
  booking?: {
    user?: { name?: string };
    callOffer?: {
      title?: string;
      dateTime?: string;
    };
  };
};

export default function PaymentsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard.creator.payments');

  const [user, setUser] = useState<any>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatorCurrency, setCreatorCurrency] = useState<string>('EUR');
 
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userResponse = await fetch('/api/auth/me', { credentials: 'include' });

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

      if (creatorId) {
        const balanceResponse = await fetch(`/api/stripe/balance/${creatorId}`);
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          setCreatorCurrency(balanceData.stripeCurrency || balanceData.currency || 'EUR');
        }
      }

      const earningsResponse = await fetch('/api/creator/earnings');
      if (earningsResponse.ok) {
        const earningsData = await earningsResponse.json();
        setPayments(earningsData?.payments ?? []);
      }
    } catch (error) {
      console.error(error);
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const paid = payments.filter(p => p.payoutStatus === 'PAID');
  const pending = payments.filter(p => p.payoutStatus === 'HELD' || p.payoutStatus === 'PENDING');
  const ready = payments.filter(p => p.payoutStatus === 'READY');

  const statusMap: Record<PayoutStatus, { label: string; color: string }> = {
    PAID: { label: t('status.paid'), color: 'bg-green-500' },
    READY: { label: t('status.ready'), color: 'bg-purple-500' },
    HELD: { label: t('status.held'), color: 'bg-yellow-500' },
    PROCESSING: { label: t('status.processing'), color: 'bg-blue-500' },
    PENDING: { label: t('status.pending'), color: 'bg-yellow-500' },
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
              {t('back')}
            </Button>
          </Link>

          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">{t('total')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CurrencyDisplay amount={totalAmount} currency={creatorCurrency} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">{t('transferred')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{paid.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">{t('pending')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pending.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">{t('available')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{ready.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Payments list */}
        {payments.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('allPayments')}</CardTitle>
              <CardDescription>{t('allPaymentsDesc')}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {payments.map(payment => {
                const status = statusMap[payment.payoutStatus] ?? {
                  label: payment.payoutStatus,
                  color: 'bg-gray-500',
                };

                const callDate = payment.booking?.callOffer?.dateTime;

                return (
                  <div key={payment.id} className="flex justify-between p-4 border rounded-lg">
                    <div className="flex gap-3">
                      <div className="p-2 bg-purple-100 rounded-full">
                        <CreditCard className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-medium">{payment.booking?.callOffer?.title}</div>
                        <div className="text-sm text-gray-500">
                          {payment.booking?.user?.name ?? t('unknownUser')} •{' '}
                          {callDate
                            ? new Date(callDate).toLocaleDateString(locale)
                            : t('unknownDate')}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <CurrencyDisplay amount={Number(payment.amount)} currency={payment.currency || creatorCurrency} />
                      <Badge className={status.color}>{status.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">{t('noPayments')}</p>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800">{t('info.title')}</CardTitle>
          </CardHeader>
          <CardContent className="text-blue-700 space-y-2 text-sm">
            <p>{t('info.amounts')}</p>
            <p>{t('info.security')}</p>
            <p>{t('info.transfer')}</p>
            <p>{t('info.payouts')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

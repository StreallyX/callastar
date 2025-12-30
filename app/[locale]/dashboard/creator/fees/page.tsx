'use client';

import { useEffect, useState } from 'react';
import { useRouter, Link } from '@/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Info, Calculator, CreditCard, DollarSign } from 'lucide-react';

export default function FeesPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard.creator.fees');

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [platformFee, setPlatformFee] = useState(15); // %

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

      setUser(userData.user);

      try {
        const settingsResponse = await fetch('/api/admin/settings/platform-fee');
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          if (settingsData?.platformFeePercentage) {
            setPlatformFee(Number(settingsData.platformFeePercentage));
          }
        }
      } catch (err) {
        console.error('Error fetching platform fee:', err);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const exampleAmount = 100;
  const platformFeeAmount = (exampleAmount * platformFee) / 100;
  const stripeFeeAmount = 2.9 + (exampleAmount * 0.30) / 100;
  const netAmount = exampleAmount - platformFeeAmount - stripeFeeAmount;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-4xl px-4 py-8">
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

        {/* Platform Fee */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-purple-600" />
              {t('platformFee.title')}
            </CardTitle>
            <CardDescription>
              {t('platformFee.description', { fee: platformFee })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              {t('platformFee.details')}
            </p>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-purple-900">
                  {t('platformFee.current')}
                </span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{platformFee}%</p>
            </div>
          </CardContent>
        </Card>

        {/* Stripe Fees */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              {t('stripe.title')}
            </CardTitle>
            <CardDescription>{t('stripe.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              {t('stripe.details')}
            </p>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-2xl font-bold text-blue-600">2.9% + 0.30 EUR</p>
              <p className="text-xs text-blue-700 mt-1">
                {t('stripe.standardFees')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Example */}
        <Card className="mb-6 border-2 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-green-600" />
              {t('example.title')}
            </CardTitle>
            <CardDescription>
              {t('example.subtitle', { amount: exampleAmount.toFixed(2) })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>{t('example.paidByUser')}</span>
              <span className="font-semibold">{exampleAmount.toFixed(2)} EUR</span>
            </div>

            <div className="border-t pt-2 flex justify-between text-red-600 text-sm">
              <span>{t('example.platformFee', { fee: platformFee })}</span>
              <span>-{platformFeeAmount.toFixed(2)} EUR</span>
            </div>

            <div className="border-t pt-2 flex justify-between text-red-600 text-sm">
              <span>{t('example.stripeFee')}</span>
              <span>-{stripeFeeAmount.toFixed(2)} EUR</span>
            </div>

            <div className="border-t-2 border-green-600 pt-3 flex justify-between">
              <span className="font-bold text-green-700">{t('example.net')}</span>
              <span className="font-bold text-2xl text-green-600">
                {netAmount.toFixed(2)} EUR
              </span>
            </div>

            <p className="text-xs text-gray-500">
              {t('example.percent', {
                percent: ((netAmount / exampleAmount) * 100).toFixed(1),
              })}
            </p>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-800 text-base">
              📋 {t('notes.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-yellow-700 space-y-2">
            <p>{t('notes.amounts')}</p>
            <p>{t('notes.security')}</p>
            <p>
              {t('notes.payouts')}{' '}
              <Link href="/dashboard/creator/payouts" className="underline font-semibold">
                {t('notes.payoutLink')}
              </Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

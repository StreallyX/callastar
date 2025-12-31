'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  LoadingSpinner, 
  CurrencyDisplay, 
  MultiCurrencyDisplay,
  MultiCurrencyDisplayCard,
  DateDisplay, 
  StatusBadge 
} from '@/components/admin';
import {
  DollarSign,
  AlertTriangle,
  Users,
  XCircle,
  TrendingUp,
  Calendar,
  RefreshCw,
  Play,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

interface DashboardData {
  pendingPayouts: {
    count: number;
    totalAmount: number;
  };
  failedPayouts: {
    count: number;
    totalAmountByCurrency: Record<string, number>;
    recent: Array<{
      id: string;
      creatorName: string;
      amount: number;
      currency: string;
      failureReason: string;
      createdAt: string;
    }>;
  };
  blockedCreators: {
    count: number;
    creators: Array<{
      id: string;
      name: string;
      email: string;
      reason: string;
    }>;
  };
  eligibilityIssues: {
    count: number;
    creators: Array<{
      id: string;
      name: string;
      reasons: string[];
    }>;
  };
  payoutVolume30Days: {
    totalAmountByCurrency: Record<string, number>;
    totalFeesByCurrency: Record<string, number>;
    count: number;
  };
  readyPayments: {
    count: number;
    totalAmountByCurrency: Record<string, number>;
  };
  stripeBalance?: Record<string, { available: number; pending: number }>;
  nextPayoutDate: string | null;
}

export default function PayoutDashboard() {
  const router = useRouter();
  const t = useTranslations('dashboard.admin');
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/admin/payouts/dashboard');
      const data = await response.json();

      if (response.ok && data.success) {
        // Transform the API response to match our interface
        const transformedData = {
          pendingPayouts: {
            count: data.summary.pendingPayouts,
            totalAmount: 0, // Not provided by new API
          },
          failedPayouts: {
            count: data.summary.failedPayouts,
            totalAmountByCurrency: {}, // Will be calculated from failedPayouts array
            recent: data.failedPayouts.slice(0, 5).map((p: any) => ({
              id: p.id,
              creatorName: p.creatorName,
              amount: parseFloat(p.amount),
              currency: p.currency,
              failureReason: p.failureReason,
              createdAt: p.createdAt,
            })),
          },
          blockedCreators: {
            count: data.summary.blockedCreators,
            creators: data.blockedCreators.map((c: any) => ({
              id: c.id,
              name: c.name,
              email: c.email,
              reason: c.reason,
            })),
          },
          eligibilityIssues: {
            count: data.summary.creatorsWithIssues,
            creators: data.creatorsWithIssues.map((c: any) => ({
              id: c.id,
              name: c.name,
              reasons: c.issues,
            })),
          },
          payoutVolume30Days: {
            totalAmountByCurrency: data.summary.totalPayoutVolumeByCurrency,
            totalFeesByCurrency: data.summary.totalFeesByCurrency,
            count: data.summary.successfulPayouts,
          },
          readyPayments: {
            count: data.summary.paymentsReady,
            totalAmountByCurrency: data.summary.totalReadyAmountByCurrency,
          },
          stripeBalance: data.summary.stripeBalance || {},
          nextPayoutDate: data.nextScheduledPayout?.nextPayoutDate || null,
        };
        setDashboardData(transformedData);
      } else {
        toast.error(data.error || t('common.error'));
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleTriggerPayouts = async () => {
    if (!confirm(t('payoutsDashboard.confirmProcess') || 'Do you really want to trigger payment processing now?')) {
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/cron/process-payouts', {
        method: 'POST',
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(t('payoutsDashboard.processSuccess') || 'Payment processing started');
        // Refresh dashboard after processing
        setTimeout(fetchDashboard, 2000);
      } else {
        toast.error(data.error || t('common.error'));
      }
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <LoadingSpinner text={t('common.loading') || 'Loading...'} />
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{t('payoutsDashboard.dataLoadError') || 'Unable to load dashboard data'}</AlertDescription>
          </Alert>
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <TrendingUp className="w-8 h-8" />
                {t('payoutsDashboard.title') || 'Payments Dashboard'}
              </h1>
              <p className="text-gray-600">
                {t('payoutsDashboard.description') || 'Complete overview of all creator payments'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchDashboard}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {t('common.refresh') || 'Refresh'}
              </Button>
              <Button
                onClick={handleTriggerPayouts}
                disabled={processing}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Play className={`w-4 h-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
                {t('payoutsDashboard.processingPayouts') || 'Process payments'}
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/admin')}>
                {t('common.back') || 'Back'}
              </Button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                {t('payoutsDashboard.cards.pendingPayouts') || 'Pending payments'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {dashboardData.pendingPayouts.count}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {t('payoutsDashboard.cards.total') || 'Total:'} <CurrencyDisplay amount={dashboardData.pendingPayouts.totalAmount} />
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {t('payoutsDashboard.cards.failedPayouts') || 'Failed payments (30d)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {dashboardData.failedPayouts.count}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {t('payoutsDashboard.cards.total') || 'Total:'} <MultiCurrencyDisplay
                  amounts={dashboardData.failedPayouts.totalAmountByCurrency}
                  emptyMessage="-"
                />
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                {t('payoutsDashboard.cards.blockedCreators') || 'Blocked creators'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {dashboardData.blockedCreators.count}
              </div>
              <p className="text-sm text-gray-600 mt-1">{t('payoutsDashboard.cards.blockedPayments') || 'Blocked payments'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {t('payoutsDashboard.cards.eligibilityIssues') || 'Eligibility issues'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {dashboardData.eligibilityIssues.count}
              </div>
              <p className="text-sm text-gray-600 mt-1">{t('payoutsDashboard.cards.affectedCreators') || 'Affected creators'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                {t('payoutsDashboard.cards.volume30Days') || 'Volume (last 30 days)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 mb-2">
                <MultiCurrencyDisplay 
                  amounts={dashboardData.payoutVolume30Days.totalAmountByCurrency}
                  emptyMessage={t('payoutsDashboard.cards.noAmount') || 'No payments'}
                />
              </div>
              <p className="text-sm text-gray-600">
                {dashboardData.payoutVolume30Days.count} {t('payoutsDashboard.cards.payments') || 'payments'}
              </p>
              {Object.keys(dashboardData.payoutVolume30Days.totalFeesByCurrency).length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-1">{t('payoutsDashboard.cards.platformFees') || 'Platform fees:'}</p>
                  <div className="text-sm font-medium text-purple-600">
                    <MultiCurrencyDisplay 
                      amounts={dashboardData.payoutVolume30Days.totalFeesByCurrency}
                      emptyMessage="-"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                {t('payoutsDashboard.cards.readyPayments') || 'Ready payments'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {dashboardData.readyPayments.count}
              </div>
              <div className="text-sm text-gray-600">
                <MultiCurrencyDisplay 
                  amounts={dashboardData.readyPayments.totalAmountByCurrency}
                  emptyMessage={t('payoutsDashboard.cards.noAmount') || 'No amount'}
                  orientation="horizontal"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {t('payoutsDashboard.cards.nextPayout') || 'Next payout scheduled'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData.nextPayoutDate ? (
                <div className="text-xl font-bold text-blue-600">
                  <DateDisplay date={dashboardData.nextPayoutDate} format="short" locale={locale} />
                </div>
              ) : (
                <div className="text-xl font-bold text-gray-400">N/A</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stripe Balance Card */}
        {dashboardData.stripeBalance && Object.keys(dashboardData.stripeBalance).length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {t('payoutsDashboard.stripeBalance.title') || 'Stripe Balance'}
              </CardTitle>
              <CardDescription>{t('payoutsDashboard.stripeBalance.description') || 'Available and pending balances on your Stripe account'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-700 font-medium mb-2">{t('payoutsDashboard.stripeBalance.available') || '💰 Available'}</p>
                  <div className="text-xl font-bold text-green-800">
                    <MultiCurrencyDisplay 
                      amounts={Object.entries(dashboardData.stripeBalance).reduce((acc, [currency, data]) => {
                        acc[currency] = data.available;
                        return acc;
                      }, {} as Record<string, number>)}
                      emptyMessage="0.00"
                    />
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-700 font-medium mb-2">{t('payoutsDashboard.stripeBalance.pending') || '⏳ Pending'}</p>
                  <div className="text-xl font-bold text-yellow-800">
                    <MultiCurrencyDisplay 
                      amounts={Object.entries(dashboardData.stripeBalance).reduce((acc, [currency, data]) => {
                        acc[currency] = data.pending;
                        return acc;
                      }, {} as Record<string, number>)}
                      emptyMessage="0.00"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Failed Payouts */}
        {dashboardData.failedPayouts.recent.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                {t('payoutsDashboard.failedPayoutsSection.title') || 'Recent Failed Payments'}
              </CardTitle>
              <CardDescription>{t('payoutsDashboard.failedPayoutsSection.description') || 'Latest failed payment attempts'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData.failedPayouts.recent.map((payout) => (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-red-900">{payout.creatorName}</p>
                      <p className="text-sm text-red-700 mt-1">{payout.failureReason}</p>
                      <p className="text-xs text-red-600 mt-1">
                        <DateDisplay date={payout.createdAt} format="relative" locale={locale} />
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">
                        <CurrencyDisplay amount={payout.amount} currency={payout.currency} />
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => router.push(`/dashboard/admin/creators/${payout.id}/stripe`)}
                      >
                        {t('payoutsDashboard.failedPayoutsSection.viewDetails') || 'View details'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Blocked Creators */}
          {dashboardData.blockedCreators.creators.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5" />
                  {t('payoutsDashboard.blockedCreatorsSection.title') || 'Blocked Creators'}
                </CardTitle>
                <CardDescription>{t('payoutsDashboard.blockedCreatorsSection.description') || 'Creators whose payments are blocked'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData.blockedCreators.creators.map((creator) => (
                    <div
                      key={creator.id}
                      className="p-4 bg-orange-50 border border-orange-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-orange-900">{creator.name}</p>
                          <p className="text-sm text-orange-700">{creator.email}</p>
                          <p className="text-sm text-orange-800 mt-2">
                            <span className="font-medium">{t('payoutsDashboard.blockedCreatorsSection.reason') || 'Reason:'} </span>
                            {creator.reason}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/dashboard/admin/creators/${creator.id}/stripe`)}
                        >
                          {t('payoutsDashboard.blockedCreatorsSection.unblock') || 'Unblock'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Eligibility Issues */}
          {dashboardData.eligibilityIssues.creators.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  {t('payoutsDashboard.eligibilitySection.title') || 'Eligibility Issues'}
                </CardTitle>
                <CardDescription>{t('payoutsDashboard.eligibilitySection.description') || 'Creators with eligibility issues'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData.eligibilityIssues.creators.map((creator) => (
                    <div
                      key={creator.id}
                      className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-yellow-900">{creator.name}</p>
                          <ul className="list-disc list-inside text-sm text-yellow-800 mt-2 space-y-1">
                            {creator.reasons.map((reason, idx) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/dashboard/admin/creators/${creator.id}/stripe`)}
                        >
                          {t('payoutsDashboard.eligibilitySection.resolve') || 'Resolve'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

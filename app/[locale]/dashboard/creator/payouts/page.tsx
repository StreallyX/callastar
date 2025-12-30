'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  DollarSign,
  TrendingUp,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Settings,
  History,
  Wallet,
  ExternalLink,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Link } from '@/navigation';
import { CurrencyDisplay } from '@/components/ui/currency-display';

interface BalanceData {
  available: number;
  pending: number;
  inTransit: number; // Amount in transit to bank
  lifetimeTotal: number; // Lifetime total volume
  currency: string; // Database currency (EUR)
  stripeCurrency?: string; // Stripe account currency (may differ from database)
}

interface PayoutSettings {
  schedule: 'DAILY' | 'WEEKLY' | 'MANUAL';
  minimum: number;
}

interface AccountStatus {
  isFullyOnboarded: boolean;
  canReceivePayments: boolean;
  canReceivePayouts: boolean;
  detailsSubmitted: boolean;
  requirementsPending: boolean;
  requirementsCurrentlyDue: string[];
  requirementsPastDue: string[];
}

interface PayoutHistoryItem {
  id: string;
  action: string;
  amount: number;
  stripePayoutId: string | null;
  triggeredBy: string;
  createdAt: string;
  status: string;
}

export default function PayoutsPage() {
  const router = useRouter();
  const t = useTranslations('dashboard.creator.payouts');
  const locale = useLocale();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [settings, setSettings] = useState<PayoutSettings | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PayoutHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) setRefreshing(true);

      // Get user data to get creator ID
      const userResponse = await fetch('/api/auth/me');
      if (!userResponse.ok) {
        router.push('/auth/login');
        return;
      }

      const userData = await userResponse.json();

      if (userData?.user?.role !== 'CREATOR') {
        router.push('/dashboard/user');
        return;
      }

      const cId = userData?.user?.creator?.id as string | undefined;
      if (!cId) {
        setError(t('errors.noCreatorId'));
        return;
      }

      setCreatorId(cId);

      // Fetch balance - use comprehensive account status from API
      const balanceResponse = await fetch(`/api/stripe/balance/${cId}`);
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();

        setBalance({
          available: balanceData.available || 0,
          pending: balanceData.pending || 0,
          inTransit: balanceData.inTransit || 0,
          lifetimeTotal: balanceData.lifetimeTotal || 0,
          currency: balanceData.currency || 'EUR',
          stripeCurrency: balanceData.stripeCurrency || 'EUR',
        });

        setAccountStatus(
          balanceData.accountStatus || {
            isFullyOnboarded: false,
            canReceivePayments: false,
            canReceivePayouts: false,
            detailsSubmitted: balanceData.detailsSubmitted || false,
            requirementsPending: true,
            requirementsCurrentlyDue: [],
            requirementsPastDue: [],
          }
        );
      } else {
        const errorData = await balanceResponse.json().catch(() => null);
        setError(errorData?.error || t('errors.balanceFetch'));
      }

      // Fetch payout settings
      const settingsResponse = await fetch('/api/creators/payout-settings');
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSettings({
          schedule: settingsData.payoutSchedule || 'MANUAL',
          minimum: settingsData.payoutMinimum || 10,
        });
      }

      // Fetch payout history
      await fetchHistory();

      if (showRefreshToast) {
        toast.success(t('toasts.refreshed'));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(t('errors.generic'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch('/api/creators/payouts/history?limit=10');
      if (response.ok) {
        const data = await response.json();
        setHistory(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchData(true);
  };

  const scheduleLabel = (schedule: PayoutSettings['schedule']) => {
    if (schedule === 'DAILY') return t('settings.schedule.daily');
    if (schedule === 'WEEKLY') return t('settings.schedule.weekly');
    return t('settings.schedule.manual');
  };

  const scheduleHint = (schedule: PayoutSettings['schedule']) => {
    if (schedule === 'DAILY') return t('settings.scheduleHint.daily');
    if (schedule === 'WEEKLY') return t('settings.scheduleHint.weekly');
    return t('settings.scheduleHint.manual');
  };

  const historyStatusToBadge = (status: string) => {
    const s = status?.toLowerCase?.() ?? '';
    if (s.includes('pay') || s.includes('paid')) {
      return { variant: 'default' as const, className: 'bg-green-500', label: t('history.status.paid') };
    }
    if (s.includes('échou') || s.includes('fail')) {
      return { variant: 'destructive' as const, className: 'bg-red-500', label: t('history.status.failed') };
    }
    if (s.includes('cours') || s.includes('processing') || s.includes('pending')) {
      return { variant: 'secondary' as const, className: 'bg-yellow-500', label: t('history.status.processing') };
    }
    return { variant: 'secondary' as const, className: '', label: status || t('history.status.unknown') };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <div className="mb-8">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
            <p className="text-gray-600">{t('subtitle')}</p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {t('actions.refresh')}
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-8 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {/* Setup Required Alert */}
        {accountStatus && (!accountStatus.detailsSubmitted || accountStatus.requirementsPending) && (
          <Alert className="mb-8 bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-700">
              {t('setup.incomplete')}{' '}
              <Link href="/dashboard/creator/payment-setup" className="underline font-semibold">
                {t('setup.completeLink')}
              </Link>
              {accountStatus.requirementsCurrentlyDue.length > 0 && (
                <span className="block mt-1 text-sm">
                  {t('setup.requiredInfoCount', { count: accountStatus.requirementsCurrentlyDue.length })}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Balance Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Available Balance */}
          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                {t('balance.available.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {balance?.available?.toFixed(2) || '0.00'} {balance?.stripeCurrency || 'EUR'}
              </div>
              <p className="text-xs text-gray-500 mt-2">{t('balance.available.help')}</p>
            </CardContent>
          </Card>

          {/* Pending Balance */}
          <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t('balance.pending.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {balance?.pending?.toFixed(2) || '0.00'} {balance?.stripeCurrency || 'EUR'}
              </div>
              <p className="text-xs text-gray-500 mt-2">{t('balance.pending.help')}</p>
            </CardContent>
          </Card>

          {/* In Transit */}
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                {t('balance.inTransit.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {balance?.inTransit?.toFixed(2) || '0.00'} {balance?.stripeCurrency || 'EUR'}
              </div>
              <p className="text-xs text-gray-500 mt-2">{t('balance.inTransit.help')}</p>
            </CardContent>
          </Card>

          {/* Lifetime */}
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                {t('balance.lifetime.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {balance?.lifetimeTotal?.toFixed(2) || '0.00'} {balance?.stripeCurrency || 'EUR'}
              </div>
              <p className="text-xs text-gray-500 mt-2">{t('balance.lifetime.help')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Currency Information Alert */}
        {balance?.stripeCurrency && balance.stripeCurrency !== 'EUR' && (
          <Alert className="mb-8 bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              <strong>{t('currencyAlert.title')}</strong>{' '}
              {t('currencyAlert.body', { stripeCurrency: balance.stripeCurrency })}
            </AlertDescription>
          </Alert>
        )}

        {/* Payout Status */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  {t('statusCard.title')}
                </CardTitle>
                <CardDescription className="mt-1">{t('statusCard.subtitle')}</CardDescription>
              </div>

              {accountStatus?.isFullyOnboarded && !accountStatus?.requirementsPending && (
                <Badge className="bg-green-500 text-white">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {t('statusCard.badge.operational')}
                </Badge>
              )}

              {accountStatus?.detailsSubmitted && accountStatus?.requirementsPending && (
                <Badge className="bg-yellow-500 text-white">
                  <Clock className="w-4 h-4 mr-2" />
                  {t('statusCard.badge.verifying')}
                </Badge>
              )}

              {!accountStatus?.detailsSubmitted && (
                <Badge className="bg-red-500 text-white">
                  <XCircle className="w-4 h-4 mr-2" />
                  {t('statusCard.badge.setupRequired')}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {accountStatus?.isFullyOnboarded && !accountStatus?.requirementsPending ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    {t('statusCard.alert.operational')}
                  </AlertDescription>
                </Alert>
              ) : accountStatus?.detailsSubmitted && accountStatus?.requirementsPending ? (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-700">
                    {t('statusCard.alert.verifying')}
                    {accountStatus.requirementsCurrentlyDue.length > 0 && (
                      <span className="block mt-2 text-sm">
                        {t('statusCard.alert.requiredItems', {
                          items: accountStatus.requirementsCurrentlyDue.join(', '),
                        })}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="bg-red-50 border-red-200">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">
                    {t('statusCard.alert.incomplete')}
                  </AlertDescription>
                </Alert>
              )}

              {/* Account Details */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">{t('statusCard.details.submitted.title')}</div>
                  <Badge variant={accountStatus?.detailsSubmitted ? 'default' : 'secondary'}>
                    {accountStatus?.detailsSubmitted ? t('statusCard.details.submitted.yes') : t('statusCard.details.submitted.no')}
                  </Badge>
                </div>

                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">{t('statusCard.details.verifications.title')}</div>
                  <Badge variant={!accountStatus?.requirementsPending ? 'default' : 'secondary'}>
                    {!accountStatus?.requirementsPending
                      ? t('statusCard.details.verifications.complete')
                      : t('statusCard.details.verifications.pendingCount', {
                          count: accountStatus?.requirementsCurrentlyDue?.length || 0,
                        })}
                  </Badge>
                </div>

                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">{t('statusCard.details.payouts.title')}</div>
                  <Badge variant={accountStatus?.canReceivePayouts ? 'default' : 'secondary'}>
                    {accountStatus?.canReceivePayouts ? t('statusCard.details.payouts.enabled') : t('statusCard.details.payouts.disabled')}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payout Settings */}
        {settings && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    {t('settingsCard.title')}
                  </CardTitle>
                  <CardDescription className="mt-1">{t('settingsCard.subtitle')}</CardDescription>
                </div>
                <Link href="/dashboard/creator/payouts/settings">
                  <Button variant="outline" size="sm">{t('actions.edit')}</Button>
                </Link>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm text-gray-600 mb-2">{t('settingsCard.scheduleTitle')}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-base px-3 py-1">
                      {scheduleLabel(settings.schedule)}
                    </Badge>
                    <span className="text-sm text-gray-500">{scheduleHint(settings.schedule)}</span>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-600 mb-2">{t('settingsCard.minimumTitle')}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-base px-3 py-1">
                      <CurrencyDisplay amount={settings.minimum} currency={balance?.stripeCurrency || 'EUR'} />
                    </Badge>
                    <span className="text-sm text-gray-500">{t('settingsCard.minimumHint')}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual Payout Request */}
        {settings?.schedule === 'MANUAL' &&
          accountStatus?.canReceivePayouts &&
          balance &&
          balance.available >= (settings?.minimum || 10) && (
            <Card className="mb-8 border-purple-200 bg-purple-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{t('manual.title')}</h3>
                    <p className="text-sm text-gray-600">
                      {t('manual.body', {
                        amount: balance.available.toFixed(2),
                        currency: balance.stripeCurrency ?? 'EUR',
                      })}
                      {balance.stripeCurrency !== 'EUR' && (
                        <span className="block text-xs text-gray-500 mt-1">{t('manual.baseNote')}</span>
                      )}
                    </p>
                  </div>
                  <Link href="/dashboard/creator/payouts/request">
                    <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                      <DollarSign className="w-4 h-4 mr-2" />
                      {t('manual.action')}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

        {/* Payout History */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              {t('historyCard.title')}
            </CardTitle>
            <CardDescription>{t('historyCard.subtitle')}</CardDescription>
          </CardHeader>

          <CardContent>
            {historyLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p>{t('historyCard.emptyTitle')}</p>
                <p className="text-sm mt-2">{t('historyCard.emptySubtitle')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('historyCard.table.date')}</TableHead>
                      <TableHead>{t('historyCard.table.amount')}</TableHead>
                      <TableHead>{t('historyCard.table.status')}</TableHead>
                      <TableHead>{t('historyCard.table.type')}</TableHead>
                      <TableHead>{t('historyCard.table.stripeId')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => {
                      const badge = historyStatusToBadge(item.status);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {new Date(item.createdAt).toLocaleDateString(locale, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {item.amount ? (
                              <CurrencyDisplay amount={item.amount} currency={balance?.stripeCurrency || 'EUR'} />
                            ) : (
                              t('common.dash')
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={badge.variant} className={badge.className}>
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">{item.triggeredBy}</span>
                          </TableCell>
                          <TableCell>
                            {item.stripePayoutId ? (
                              <a
                                href={`https://dashboard.stripe.com/payouts/${item.stripePayoutId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-purple-600 hover:text-purple-700 text-sm"
                              >
                                {item.stripePayoutId.slice(0, 12)}...
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-sm text-gray-400">{t('common.dash')}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800 text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {t('info.title')}
            </CardTitle>
          </CardHeader>

          <CardContent className="text-sm text-blue-700 space-y-3">
            <div>
              <strong>{t('info.auto.title')}</strong>
              <ul className="ml-4 mt-1 space-y-1 list-disc">
                <li>
                  <strong>{t('info.auto.daily.title')}</strong> {t('info.auto.daily.body')}
                </li>
                <li>
                  <strong>{t('info.auto.weekly.title')}</strong> {t('info.auto.weekly.body')}
                </li>
                <li>
                  <strong>{t('info.auto.manual.title')}</strong> {t('info.auto.manual.body')}
                </li>
              </ul>
            </div>

            <div className="pt-2 border-t border-blue-300">
              <strong>{t('info.processing.title')}</strong>
              <p className="mt-1">{t('info.processing.body')}</p>
            </div>

            <div className="pt-2 border-t border-blue-300">
              <strong>{t('info.bank.title')}</strong>
              <p className="mt-1">
                {t('info.bank.bodyStart')}{' '}
                <a
                  href="https://dashboard.stripe.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold"
                >
                  {t('info.bank.stripeDashboard')}
                </a>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  ExternalLink
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import Link from 'next/link';
import { CurrencyDisplay } from '@/components/ui/currency-display';

interface BalanceData {
  available: number;
  pending: number;
  inTransit: number; // ✅ NEW: Amount in transit to bank
  lifetimeTotal: number; // ✅ NEW: Lifetime total volume
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

      const cId = userData?.user?.creator?.id;
      setCreatorId(cId);

      // Fetch balance - ✅ FIX: Use comprehensive account status from API
      const balanceResponse = await fetch(`/api/stripe/balance/${cId}`);
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        setBalance({
          available: balanceData.available || 0,
          pending: balanceData.pending || 0,
          inTransit: balanceData.inTransit || 0, // ✅ NEW
          lifetimeTotal: balanceData.lifetimeTotal || 0, // ✅ NEW
          currency: balanceData.currency || 'EUR',
          stripeCurrency: balanceData.stripeCurrency || 'EUR',
        });
        // ✅ FIX: Use comprehensive accountStatus instead of raw flags
        setAccountStatus(balanceData.accountStatus || {
          isFullyOnboarded: false,
          canReceivePayments: false,
          canReceivePayouts: false,
          detailsSubmitted: balanceData.detailsSubmitted || false,
          requirementsPending: true,
          requirementsCurrentlyDue: [],
          requirementsPastDue: [],
        });
      } else {
        const errorData = await balanceResponse.json();
        setError(errorData.error || 'Impossible de récupérer le solde');
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
        toast.success('Données actualisées');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Une erreur est survenue');
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
            <h1 className="text-3xl font-bold mb-2">Paiements et virements</h1>
            <p className="text-gray-600">
              Gérez vos paiements et consultez votre solde Stripe
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-8 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {/* Setup Required Alert - ✅ FIX: Use correct validation logic */}
        {accountStatus && (!accountStatus.detailsSubmitted || accountStatus.requirementsPending) && (
          <Alert className="mb-8 bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-700">
              Votre configuration de paiement est incomplète.{' '}
              <Link href="/dashboard/creator/payment-setup" className="underline font-semibold">
                Complétez votre configuration
              </Link>
              {accountStatus.requirementsCurrentlyDue.length > 0 && (
                <span className="block mt-1 text-sm">
                  Informations requises : {accountStatus.requirementsCurrentlyDue.length}
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
                Disponible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {balance?.available.toFixed(2) || '0.00'} {balance?.stripeCurrency || 'EUR'}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Prêt pour virement
              </p>
            </CardContent>
          </Card>

          {/* Pending Balance */}
          <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                En attente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {balance?.pending.toFixed(2) || '0.00'} {balance?.stripeCurrency || 'EUR'}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Période de sécurité (7j)
              </p>
            </CardContent>
          </Card>

          {/* ✅ NEW: In Transit to Bank */}
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                En transit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {balance?.inTransit?.toFixed(2) || '0.00'} {balance?.stripeCurrency || 'EUR'}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Vers votre banque
              </p>
            </CardContent>
          </Card>

          {/* ✅ NEW: Lifetime Total */}
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Total versé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {balance?.lifetimeTotal?.toFixed(2) || '0.00'} {balance?.stripeCurrency || 'EUR'}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Volume total (lifetime)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Currency Information Alert */}
        {balance?.stripeCurrency && balance.stripeCurrency !== 'EUR' && (
          <Alert className="mb-8 bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              <strong>Devise du compte Stripe :</strong> Votre compte Stripe est configuré en {balance.stripeCurrency}.
              Les montants sont affichés dans votre devise Stripe. Les virements seront effectués dans cette devise.
              {' '}(Base de calcul : EUR)
            </AlertDescription>
          </Alert>
        )}

        {/* Payout Status - ✅ FIX: Use correct validation logic */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Statut des virements
                </CardTitle>
                <CardDescription className="mt-1">
                  État actuel de votre compte de paiement
                </CardDescription>
              </div>
              {/* ✅ FIX: Use isFullyOnboarded instead of payoutsEnabled */}
              {accountStatus?.isFullyOnboarded && !accountStatus?.requirementsPending && (
                <Badge className="bg-green-500 text-white">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Compte opérationnel
                </Badge>
              )}
              {accountStatus?.detailsSubmitted && accountStatus?.requirementsPending && (
                <Badge className="bg-yellow-500 text-white">
                  <Clock className="w-4 h-4 mr-2" />
                  Vérification en cours
                </Badge>
              )}
              {!accountStatus?.detailsSubmitted && (
                <Badge className="bg-red-500 text-white">
                  <XCircle className="w-4 h-4 mr-2" />
                  Configuration requise
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* ✅ FIX: Use correct status checks */}
              {accountStatus?.isFullyOnboarded && !accountStatus?.requirementsPending ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    ✅ Compte opérationnel - Les virements seront envoyés selon votre calendrier configuré
                  </AlertDescription>
                </Alert>
              ) : accountStatus?.detailsSubmitted && accountStatus?.requirementsPending ? (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-700">
                    🔄 Vérification en cours - Certaines informations sont en attente de validation
                    {accountStatus.requirementsCurrentlyDue.length > 0 && (
                      <span className="block mt-2 text-sm">
                        Informations requises : {accountStatus.requirementsCurrentlyDue.join(', ')}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="bg-red-50 border-red-200">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">
                    ⚠️ Configuration incomplète - Complétez votre configuration pour recevoir des virements
                  </AlertDescription>
                </Alert>
              )}

              {/* Account Details - ✅ FIX: Use correct status fields */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Informations soumises</div>
                  <Badge variant={accountStatus?.detailsSubmitted ? 'default' : 'secondary'}>
                    {accountStatus?.detailsSubmitted ? '✓ Soumises' : '✗ Requises'}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Vérifications</div>
                  <Badge variant={!accountStatus?.requirementsPending ? 'default' : 'secondary'}>
                    {!accountStatus?.requirementsPending ? '✓ Complètes' : `⏳ ${accountStatus?.requirementsCurrentlyDue?.length || 0} en attente`}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Virements</div>
                  <Badge variant={accountStatus?.canReceivePayouts ? 'default' : 'secondary'}>
                    {accountStatus?.canReceivePayouts ? '✓ Activés' : '✗ Désactivés'}
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
                    Paramètres de virement
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Configurez la fréquence et le montant minimum de vos virements
                  </CardDescription>
                </div>
                <Link href="/dashboard/creator/payouts/settings">
                  <Button variant="outline" size="sm">
                    Modifier
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm text-gray-600 mb-2">Calendrier de virement</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-base px-3 py-1">
                      {settings.schedule === 'DAILY' && 'Quotidien'}
                      {settings.schedule === 'WEEKLY' && 'Hebdomadaire'}
                      {settings.schedule === 'MANUAL' && 'Manuel'}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {settings.schedule === 'DAILY' && '(Chaque jour si solde ≥ minimum)'}
                      {settings.schedule === 'WEEKLY' && '(Chaque lundi si solde ≥ minimum)'}
                      {settings.schedule === 'MANUAL' && '(Demande manuelle uniquement)'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-2">Montant minimum</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-base px-3 py-1">
                      <CurrencyDisplay 
                        amount={settings.minimum} 
                        currency={balance?.stripeCurrency || 'EUR'} 
                      />
                    </Badge>
                    <span className="text-sm text-gray-500">(Minimum requis pour un virement)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual Payout Request - Only shown if schedule is MANUAL - ✅ FIX: Use correct validation */}
        {settings?.schedule === 'MANUAL' && accountStatus?.canReceivePayouts && balance && balance.available >= (settings?.minimum || 10) && (
          <Card className="mb-8 border-purple-200 bg-purple-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-1">Demander un virement manuel</h3>
                  <p className="text-sm text-gray-600">
                    Vous avez <strong>{balance.available.toFixed(2)} {balance.stripeCurrency}</strong> disponibles pour un virement.
                    {balance.stripeCurrency !== 'EUR' && (
                      <span className="block text-xs text-gray-500 mt-1">
                        (≈ {balance.available.toFixed(2)} EUR base)
                      </span>
                    )}
                  </p>
                </div>
                <Link href="/dashboard/creator/payouts/request">
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Demander un virement
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
              Historique des virements
            </CardTitle>
            <CardDescription>
              Liste de tous vos virements et leur statut
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p>Aucun historique de virement pour le moment</p>
                <p className="text-sm mt-2">Les virements apparaîtront ici une fois traités</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>ID Stripe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {/* ✅ FIX: item.amount from DB (PayoutAuditLog) is already in currency units, not cents */}
                          {item.amount ? (
                            <CurrencyDisplay 
                              amount={item.amount} 
                              currency={balance?.stripeCurrency || 'EUR'} 
                            />
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === 'Payé' ? 'default' :
                              item.status === 'Échoué' ? 'destructive' :
                              'secondary'
                            }
                            className={
                              item.status === 'Payé' ? 'bg-green-500' :
                              item.status === 'Échoué' ? 'bg-red-500' :
                              item.status === 'En cours' ? 'bg-yellow-500' :
                              ''
                            }
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {item.triggeredBy}
                          </span>
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
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
              Comment fonctionnent les virements ?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-700 space-y-3">
            <div>
              <strong>Virements automatiques :</strong>
              <ul className="ml-4 mt-1 space-y-1 list-disc">
                <li><strong>Quotidien :</strong> Virement automatique chaque jour si le solde disponible atteint le minimum configuré</li>
                <li><strong>Hebdomadaire :</strong> Virement automatique chaque lundi si le solde disponible atteint le minimum configuré</li>
                <li><strong>Manuel :</strong> Vous devez demander manuellement chaque virement (sujet à approbation admin)</li>
              </ul>
            </div>
            <div className="pt-2 border-t border-blue-300">
              <strong>Délais de traitement :</strong>
              <p className="mt-1">
                Les virements Stripe sont généralement traités en 2-3 jours ouvrables. 
                Une fois le virement traité par Stripe, les fonds sont envoyés vers votre compte bancaire 
                selon vos paramètres Stripe (généralement 1-2 jours supplémentaires).
              </p>
            </div>
            <div className="pt-2 border-t border-blue-300">
              <strong>Configuration bancaire :</strong>
              <p className="mt-1">
                Pour configurer ou modifier votre compte bancaire, connectez-vous à votre{' '}
                <a 
                  href="https://dashboard.stripe.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="underline font-semibold"
                >
                  tableau de bord Stripe
                </a>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

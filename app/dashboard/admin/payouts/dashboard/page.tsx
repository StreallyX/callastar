'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner, CurrencyDisplay, DateDisplay, StatusBadge } from '@/components/admin';
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
    totalAmount: number;
    recent: Array<{
      id: string;
      creatorName: string;
      amount: number;
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
    totalAmount: number;
    count: number;
  };
  nextPayoutDate: string | null;
}

export default function PayoutDashboard() {
  const router = useRouter();
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
        setDashboardData(data.data);
      } else {
        toast.error(data.error || 'Erreur lors du chargement');
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.error('Erreur lors du chargement du tableau de bord');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleTriggerPayouts = async () => {
    if (!confirm('Voulez-vous vraiment déclencher le traitement des paiements maintenant ?')) {
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/cron/process-payouts', {
        method: 'POST',
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Traitement des paiements lancé');
        // Refresh dashboard after processing
        setTimeout(fetchDashboard, 2000);
      } else {
        toast.error(data.error || 'Erreur lors du traitement');
      }
    } catch (error) {
      toast.error('Erreur lors du déclenchement des paiements');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <LoadingSpinner text="Chargement..." />
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
            <AlertDescription>Impossible de charger les données du tableau de bord</AlertDescription>
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
                Tableau de Bord des Paiements
              </h1>
              <p className="text-gray-600">
                Vue d'ensemble complète de tous les paiements aux créateurs
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchDashboard}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
              <Button
                onClick={handleTriggerPayouts}
                disabled={processing}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Play className={`w-4 h-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
                Traiter les paiements
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/admin')}>
                Retour
              </Button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Paiements en attente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {dashboardData.pendingPayouts.count}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Total: <CurrencyDisplay amount={dashboardData.pendingPayouts.totalAmount} />
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Paiements échoués (30j)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {dashboardData.failedPayouts.count}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Total: <CurrencyDisplay amount={dashboardData.failedPayouts.totalAmount} />
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Créateurs bloqués
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {dashboardData.blockedCreators.count}
              </div>
              <p className="text-sm text-gray-600 mt-1">Paiements bloqués</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Problèmes d'éligibilité
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {dashboardData.eligibilityIssues.count}
              </div>
              <p className="text-sm text-gray-600 mt-1">Créateurs concernés</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Volume (30 derniers jours)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                <CurrencyDisplay amount={dashboardData.payoutVolume30Days.totalAmount} />
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {dashboardData.payoutVolume30Days.count} paiements
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Prochain paiement prévu
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData.nextPayoutDate ? (
                <div className="text-xl font-bold text-blue-600">
                  <DateDisplay date={dashboardData.nextPayoutDate} format="short" />
                </div>
              ) : (
                <div className="text-xl font-bold text-gray-400">N/A</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Failed Payouts */}
        {dashboardData.failedPayouts.recent.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Paiements échoués récents
              </CardTitle>
              <CardDescription>Dernières tentatives de paiement ayant échoué</CardDescription>
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
                        <DateDisplay date={payout.createdAt} format="relative" />
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">
                        <CurrencyDisplay amount={payout.amount} />
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => router.push(`/dashboard/admin/creators/${payout.id}/stripe`)}
                      >
                        Voir détails
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
                  Créateurs bloqués
                </CardTitle>
                <CardDescription>Créateurs dont les paiements sont bloqués</CardDescription>
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
                            <span className="font-medium">Raison: </span>
                            {creator.reason}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/dashboard/admin/creators/${creator.id}/stripe`)}
                        >
                          Débloquer
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
                  Problèmes d'éligibilité
                </CardTitle>
                <CardDescription>Créateurs avec des problèmes d'éligibilité</CardDescription>
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
                          Résoudre
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

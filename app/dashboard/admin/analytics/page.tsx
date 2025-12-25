'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  DollarSign,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface AnalyticsData {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  revenue: {
    total: number;
    period: number;
    dailyRevenue: Array<{ date: string; amount: number }>;
  };
  platformFees: {
    total: number;
    period: number;
    dailyFees: Array<{ date: string; amount: number }>;
  };
  creatorEarnings: {
    total: number;
    period: number;
  };
  payouts: {
    pending: { count: number; amount: number };
    processing: { count: number; amount: number };
    completed: { count: number; amount: number; totalAllTime: number };
    dailyPayouts: Array<{ date: string; amount: number }>;
  };
  balances: {
    ready: number;
    held: number;
    total: number;
  };
  payments: {
    total: number;
    period: number;
    byStatus: {
      held: number;
      ready: number;
      processing: number;
      paid: number;
      failed: number;
    };
  };
  topCreators: Array<{
    name: string;
    email: string;
    revenue: number;
  }>;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Erreur lors du chargement des analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Combine revenue and fees data for chart
  const chartData = data.revenue.dailyRevenue.map((rev) => {
    const fee = data.platformFees.dailyFees.find((f) => f.date === rev.date);
    const payout = data.payouts.dailyPayouts.find((p) => p.date === rev.date);
    return {
      date: new Date(rev.date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      }),
      revenue: rev.amount,
      fees: fee?.amount || 0,
      payouts: payout?.amount || 0,
    };
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble des performances de la plateforme
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Période" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 derniers jours</SelectItem>
            <SelectItem value="30">30 derniers jours</SelectItem>
            <SelectItem value="90">90 derniers jours</SelectItem>
            <SelectItem value="365">1 an</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Revenue Summary */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.revenue.total.toFixed(2)} €</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.revenue.period.toFixed(2)} € cette période
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frais Plateforme</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.platformFees.total.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.platformFees.period.toFixed(2)} € cette période
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gains Créateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.creatorEarnings.total.toFixed(2)} €</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.creatorEarnings.period.toFixed(2)} € cette période
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paiements</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.payments.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.payments.period} cette période
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Status */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Virements en Attente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {data.payouts.pending.amount.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.payouts.pending.count} demande{data.payouts.pending.count > 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Virements en Cours</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.payouts.processing.amount.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.payouts.processing.count} paiement{data.payouts.processing.count > 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Virements Complétés</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.payouts.completed.totalAllTime.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.payouts.completed.amount.toFixed(2)} € cette période
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Balances */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde Disponible</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.balances.ready.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Prêt pour virement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde en Attente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {data.balances.held.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Période de sécurité (7 jours)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.balances.total.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Disponible + En attente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenus et Frais</CardTitle>
          <CardDescription>
            Évolution des revenus, frais plateforme et virements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Revenus"
              />
              <Line
                type="monotone"
                dataKey="fees"
                stroke="#10b981"
                strokeWidth={2}
                name="Frais Plateforme"
              />
              <Line
                type="monotone"
                dataKey="payouts"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Virements"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Payment Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Statut des Paiements</CardTitle>
          <CardDescription>
            Distribution des paiements par statut
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                { name: 'En attente', value: data.payments.byStatus.held },
                { name: 'Disponible', value: data.payments.byStatus.ready },
                { name: 'En cours', value: data.payments.byStatus.processing },
                { name: 'Payé', value: data.payments.byStatus.paid },
                { name: 'Échoué', value: data.payments.byStatus.failed },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Creators */}
      <Card>
        <CardHeader>
          <CardTitle>Top Créateurs</CardTitle>
          <CardDescription>
            Les créateurs avec les plus hauts revenus (période sélectionnée)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.topCreators.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Aucun créateur pour cette période
              </p>
            ) : (
              data.topCreators.map((creator, index) => (
                <div
                  key={creator.email}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{creator.name}</p>
                      <p className="text-sm text-muted-foreground">{creator.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{creator.revenue.toFixed(2)} €</p>
                    <p className="text-xs text-muted-foreground">Revenus</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

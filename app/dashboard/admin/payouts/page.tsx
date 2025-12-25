'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  ExternalLink,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface PayoutRequest {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  stripeAccountId: string | null;
  requestedAmount: number;
  actualAmount: number | null;
  availableBalance: number;
  status: string;
  requestedAt: string;
  processedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  notes: string | null;
  stripePayoutId: string | null;
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const fetchPayouts = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('status', filter);
      }
      
      const response = await fetch(`/api/admin/payouts?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch payouts');
      const data = await response.json();
      setPayouts(data);
    } catch (error) {
      console.error('Error fetching payouts:', error);
      toast.error('Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [filter]);

  const handleProcessPayout = async (payoutId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir traiter ce paiement ?')) {
      return;
    }

    setProcessing(payoutId);
    try {
      const response = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process payout');
      }

      const result = await response.json();
      toast.success(result.message || 'Paiement traité avec succès');
      fetchPayouts();
    } catch (error: any) {
      console.error('Error processing payout:', error);
      toast.error(error.message || 'Erreur lors du traitement du paiement');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; icon: any }> = {
      PENDING: { variant: 'secondary', label: 'En attente', icon: Clock },
      PROCESSING: { variant: 'outline', label: 'En cours', icon: Loader2 },
      PAID: { variant: 'default', label: 'Payé', icon: CheckCircle },
      FAILED: { variant: 'destructive', label: 'Échoué', icon: AlertCircle },
    };

    const config = variants[status] || variants.PENDING;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingPayouts = payouts.filter((p) => p.status === 'PENDING');
  const processingPayouts = payouts.filter((p) => p.status === 'PROCESSING');
  const completedPayouts = payouts.filter((p) => p.status === 'PAID');

  const totalPendingAmount = pendingPayouts.reduce((sum, p) => sum + p.requestedAmount, 0);
  const totalCompletedAmount = completedPayouts.reduce(
    (sum, p) => sum + (p.actualAmount || p.requestedAmount),
    0
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Paiements</h1>
          <p className="text-muted-foreground">
            Traiter les demandes de virement des créateurs
          </p>
        </div>
        <Button onClick={() => fetchPayouts()} variant="outline" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Attente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalPendingAmount.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingPayouts.length} demande{pendingPayouts.length > 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Cours</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {processingPayouts.reduce((sum, p) => sum + p.requestedAmount, 0).toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {processingPayouts.length} paiement{processingPayouts.length > 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Complétés</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalCompletedAmount.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedPayouts.length} paiement{completedPayouts.length > 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Demandes de Paiement</CardTitle>
              <CardDescription>
                Liste de toutes les demandes de virement
              </CardDescription>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="PENDING">En attente</SelectItem>
                <SelectItem value="PROCESSING">En cours</SelectItem>
                <SelectItem value="PAID">Payés</SelectItem>
                <SelectItem value="FAILED">Échoués</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : payouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune demande de paiement
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Créateur</TableHead>
                    <TableHead>Montant Demandé</TableHead>
                    <TableHead>Solde Disponible</TableHead>
                    <TableHead>Date Demande</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{payout.creatorName}</p>
                          <p className="text-sm text-muted-foreground">{payout.creatorEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{payout.requestedAmount.toFixed(2)} €</p>
                          {payout.actualAmount && payout.actualAmount !== payout.requestedAmount && (
                            <p className="text-xs text-muted-foreground">
                              Payé: {payout.actualAmount.toFixed(2)} €
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            payout.availableBalance >= payout.requestedAmount
                              ? 'text-green-600 font-medium'
                              : 'text-red-600 font-medium'
                          }
                        >
                          {payout.availableBalance.toFixed(2)} €
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(payout.requestedAt)}</TableCell>
                      <TableCell>{getStatusBadge(payout.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {payout.status === 'PENDING' && (
                            <>
                              {payout.stripeAccountId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                >
                                  <a
                                    href={`https://dashboard.stripe.com/connect/accounts/${payout.stripeAccountId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Stripe
                                  </a>
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleProcessPayout(payout.id)}
                                disabled={processing === payout.id || payout.availableBalance < payout.requestedAmount}
                              >
                                {processing === payout.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Traitement...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Traiter
                                  </>
                                )}
                              </Button>
                            </>
                          )}
                          {payout.status === 'PAID' && payout.stripePayoutId && (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                            >
                              <a
                                href={`https://dashboard.stripe.com/connect/transfers/${payout.stripePayoutId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Voir
                              </a>
                            </Button>
                          )}
                          {payout.status === 'FAILED' && payout.failureReason && (
                            <div className="text-xs text-red-600 max-w-xs truncate">
                              {payout.failureReason}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

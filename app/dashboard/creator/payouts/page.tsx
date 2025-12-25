'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  TrendingUp,
  Calendar,
  ExternalLink,
} from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  platformFee: number;
  totalAmount: number;
  releaseDate?: Date;
  paymentDate: Date;
  payoutDate?: Date;
  bookingId: string;
  status: string;
  daysRemaining?: number;
  stripeTransferId?: string;
}

interface PayoutRequest {
  id: string;
  amount: number;
  status: string;
  requestedAt: Date;
  processedAt?: Date;
}

interface PayoutData {
  availableBalance: number;
  pendingBalance: number;
  totalPaid: number;
  stripeConnected: boolean;
  stripeAccountId?: string;
  payments: {
    ready: Payment[];
    held: Payment[];
    processing: Payment[];
    paid: Payment[];
  };
  pendingPayoutRequests: PayoutRequest[];
}

export default function CreatorPayoutsPage() {
  const [data, setData] = useState<PayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requesting, setRequesting] = useState(false);

  const fetchPayoutData = async () => {
    try {
      const response = await fetch('/api/payouts/request');
      if (!response.ok) throw new Error('Failed to fetch payout data');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching payout data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayoutData();
  }, []);

  const handleRequestPayout = async () => {
    if (!requestAmount || parseFloat(requestAmount) <= 0) {
      toast.error('Veuillez entrer un montant valide');
      return;
    }

    const amount = parseFloat(requestAmount);
    if (amount > (data?.availableBalance || 0)) {
      toast.error('Le montant dépasse votre solde disponible');
      return;
    }

    setRequesting(true);
    try {
      const response = await fetch('/api/payouts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payout request');
      }

      const result = await response.json();
      toast.success(result.message || 'Demande de paiement créée avec succès');
      setShowRequestDialog(false);
      setRequestAmount('');
      fetchPayoutData();
    } catch (error: any) {
      console.error('Error requesting payout:', error);
      toast.error(error.message || 'Erreur lors de la demande de paiement');
    } finally {
      setRequesting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; icon: any }> = {
      HELD: { variant: 'secondary', label: 'En attente', icon: Clock },
      READY: { variant: 'default', label: 'Disponible', icon: CheckCircle },
      PROCESSING: { variant: 'outline', label: 'En cours', icon: Loader2 },
      PAID: { variant: 'default', label: 'Payé', icon: CheckCircle },
      PENDING: { variant: 'secondary', label: 'En attente', icon: Clock },
      FAILED: { variant: 'destructive', label: 'Échoué', icon: AlertCircle },
      REVERSED: { variant: 'destructive', label: 'Inversé', icon: AlertCircle },
      COMPLETED: { variant: 'default', label: 'Complété', icon: CheckCircle },
    };

    const config = variants[status] || variants.PENDING;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Impossible de charger les données de paiement
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasPendingRequest = data.pendingPayoutRequests.length > 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Mes Paiements</h1>
        <p className="text-muted-foreground">
          Gérez vos paiements et demandez des virements
        </p>
      </div>

      {/* Stripe Connection Warning */}
      {!data.stripeConnected && (
        <Card className="border-yellow-500">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold">Configuration Stripe requise</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Vous devez compléter votre configuration Stripe Connect pour recevoir des
                  paiements.
                </p>
                <Button className="mt-4" asChild>
                  <a href="/dashboard/creator/settings">Configurer Stripe</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balance Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde Disponible</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {data.availableBalance.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Prêt pour un virement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Attente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {data.pendingBalance.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Période de sécurité (7 jours)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payé</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.totalPaid.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tous les paiements
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Request Payout Button */}
      <Card>
        <CardHeader>
          <CardTitle>Demander un Virement</CardTitle>
          <CardDescription>
            Transférez votre solde disponible sur votre compte Stripe
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasPendingRequest ? (
            <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <Clock className="h-6 w-6 text-blue-600" />
              <div className="flex-1">
                <p className="font-medium">Demande en cours</p>
                <p className="text-sm text-muted-foreground">
                  Vous avez une demande de paiement en attente de traitement par l'administrateur.
                </p>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowRequestDialog(true)}
              disabled={!data.stripeConnected || data.availableBalance <= 0}
              className="w-full sm:w-auto"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Demander un Virement
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Pending Payout Requests */}
      {data.pendingPayoutRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Demandes de Paiement</CardTitle>
            <CardDescription>
              Vos demandes de virement en cours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.pendingPayoutRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{request.amount.toFixed(2)} €</p>
                    <p className="text-sm text-muted-foreground">
                      Demandé le {formatDate(request.requestedAt)}
                    </p>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments - Ready */}
      {data.payments.ready.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Paiements Disponibles</CardTitle>
            <CardDescription>
              Paiements prêts pour un virement ({data.payments.ready.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.payments.ready.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{payment.amount.toFixed(2)} €</p>
                    <p className="text-sm text-muted-foreground">
                      Payé le {formatDate(payment.paymentDate)}
                    </p>
                  </div>
                  {getStatusBadge(payment.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments - Held */}
      {data.payments.held.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Paiements en Attente</CardTitle>
            <CardDescription>
              Période de sécurité de 7 jours ({data.payments.held.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.payments.held.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{payment.amount.toFixed(2)} €</p>
                    <p className="text-sm text-muted-foreground">
                      Disponible le {formatDate(payment.releaseDate)}
                    </p>
                    {payment.daysRemaining !== undefined && (
                      <p className="text-xs text-orange-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {payment.daysRemaining} jour{payment.daysRemaining > 1 ? 's' : ''} restant
                        {payment.daysRemaining > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(payment.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments - Paid History */}
      {data.payments.paid.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historique des Paiements</CardTitle>
            <CardDescription>
              Paiements transférés sur votre compte ({data.payments.paid.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.payments.paid.slice(0, 10).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{payment.amount.toFixed(2)} €</p>
                    <p className="text-sm text-muted-foreground">
                      Transféré le {formatDate(payment.payoutDate)}
                    </p>
                    {payment.stripeTransferId && data.stripeAccountId && (
                      <a
                        href={`https://dashboard.stripe.com/connect/accounts/${data.stripeAccountId}/activity`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Voir dans Stripe
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  {getStatusBadge(payment.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request Payout Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander un Virement</DialogTitle>
            <DialogDescription>
              Entrez le montant que vous souhaitez transférer sur votre compte Stripe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Montant (€)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                max={data.availableBalance}
                placeholder={`Maximum: ${data.availableBalance.toFixed(2)} €`}
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Solde disponible: {data.availableBalance.toFixed(2)} €
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRequestDialog(false)}
              disabled={requesting}
            >
              Annuler
            </Button>
            <Button onClick={handleRequestPayout} disabled={requesting}>
              {requesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Demander
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

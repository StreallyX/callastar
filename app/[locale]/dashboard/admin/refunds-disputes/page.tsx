'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { CheckCircle2, XCircle, AlertTriangle, DollarSign, TrendingDown } from 'lucide-react';

interface Refund {
  id: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  creatorDebt: number;
  reconciled: boolean;
  reconciledAt: string | null;
  reconciledBy: string | null;
  reversalId: string | null;
  createdAt: string;
  payment: {
    booking: {
      callOffer: {
        title: string;
        creator: {
          user: {
            id: string;
            name: string;
            email: string;
          };
        };
      };
      user: {
        name: string;
        email: string;
      };
    };
  };
}

interface Dispute {
  id: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  creatorDebt: number;
  reconciled: boolean;
  reconciledAt: string | null;
  reconciledBy: string | null;
  reversalId: string | null;
  createdAt: string;
  payment: {
    booking: {
      callOffer: {
        title: string;
        creator: {
          user: {
            id: string;
            name: string;
            email: string;
          };
        };
      };
      user: {
        name: string;
        email: string;
      };
    };
  };
}

interface Summary {
  totalRefunds: number;
  totalDisputes: number;
  unreconciledRefunds: number;
  unreconciledDisputes: number;
  totalUnreconciledDebt: number;
}

export default function RefundsDisputesPage() {
  const locale = useLocale();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalRefunds: 0,
    totalDisputes: 0,
    unreconciledRefunds: 0,
    unreconciledDisputes: 0,
    totalUnreconciledDebt: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/refunds-disputes?status=${statusFilter}&type=all`
      );
      const data = await response.json();

      if (data.success) {
        setRefunds(data.refunds);
        setDisputes(data.disputes);
        setSummary(data.summary);
      } else {
        setError(data.error || 'Erreur lors du chargement des données');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsReconciled = async (type: 'refund' | 'dispute', id: string) => {
    try {
      setReconcilingId(id);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/refunds-disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        fetchData(); // Refresh data
      } else {
        setError(data.error || 'Erreur lors de la réconciliation');
      }
    } catch (err) {
      console.error('Error marking as reconciled:', err);
      setError('Erreur lors de la réconciliation');
    } finally {
      setReconcilingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string, reconciled: boolean) => {
    if (reconciled) {
      return (
        <Badge className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Réconcilié
        </Badge>
      );
    }

    if (status === 'SUCCEEDED' || status === 'LOST') {
      return (
        <Badge className="bg-red-500">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Non réconcilié
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-yellow-600">
        En cours
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="p-10">
            <div className="text-center">Chargement...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Remboursements & Contestations</h1>
        <p className="text-muted-foreground mt-2">
          Gérez les dettes créateurs et réconciliez les remboursements et contestations
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Remboursements</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRefunds}</div>
            <p className="text-xs text-muted-foreground">
              {summary.unreconciledRefunds} non réconciliés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contestations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalDisputes}</div>
            <p className="text-xs text-muted-foreground">
              {summary.unreconciledDisputes} non réconciliés
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dette Totale Non Réconciliée</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {summary.totalUnreconciledDebt.toFixed(2)} EUR
            </div>
            <p className="text-xs text-muted-foreground">
              Montant dû par les créateurs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="unreconciled">Non réconciliés</SelectItem>
                <SelectItem value="reconciled">Réconciliés</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Refunds and Disputes */}
      <Tabs defaultValue="refunds" className="space-y-4">
        <TabsList>
          <TabsTrigger value="refunds">
            Remboursements ({refunds.length})
          </TabsTrigger>
          <TabsTrigger value="disputes">
            Contestations ({disputes.length})
          </TabsTrigger>
        </TabsList>

        {/* Refunds Table */}
        <TabsContent value="refunds">
          <Card>
            <CardHeader>
              <CardTitle>Remboursements</CardTitle>
              <CardDescription>
                Liste de tous les remboursements et leur statut de réconciliation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Créateur</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Offre</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Dette Créateur</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Réconcilié par</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        Aucun remboursement
                      </TableCell>
                    </TableRow>
                  ) : (
                    refunds.map((refund) => (
                      <TableRow key={refund.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(refund.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {refund.payment.booking.callOffer.creator.user.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {refund.payment.booking.callOffer.creator.user.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {refund.payment.booking.user.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {refund.payment.booking.user.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{refund.payment.booking.callOffer.title}</TableCell>
                        <TableCell className="font-medium">
                          {Number(refund.amount).toFixed(2)} {refund.currency}
                        </TableCell>
                        <TableCell className="font-bold text-red-600">
                          {Number(refund.creatorDebt).toFixed(2)} EUR
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(refund.status, refund.reconciled)}
                        </TableCell>
                        <TableCell>
                          {refund.reconciled ? (
                            <div>
                              <div className="text-xs">
                                {refund.reconciledBy === 'TRANSFER_REVERSAL' && '🔄 Reversal'}
                                {refund.reconciledBy === 'PAYOUT_DEDUCTION' && '💰 Déduction'}
                                {refund.reconciledBy === 'MANUAL' && '👤 Manuel'}
                              </div>
                              {refund.reconciledAt && (
                                <div className="text-xs text-muted-foreground">
                                  {formatDate(refund.reconciledAt)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!refund.reconciled && refund.status === 'SUCCEEDED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkAsReconciled('refund', refund.id)}
                              disabled={reconcilingId === refund.id}
                            >
                              {reconcilingId === refund.id ? 'En cours...' : 'Marquer réconcilié'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disputes Table */}
        <TabsContent value="disputes">
          <Card>
            <CardHeader>
              <CardTitle>Contestations</CardTitle>
              <CardDescription>
                Liste de toutes les contestations et leur statut de réconciliation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Créateur</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Offre</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Dette Créateur</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Raison</TableHead>
                    <TableHead>Réconcilié par</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disputes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground">
                        Aucune contestation
                      </TableCell>
                    </TableRow>
                  ) : (
                    disputes.map((dispute) => (
                      <TableRow key={dispute.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(dispute.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {dispute.payment.booking.callOffer.creator.user.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {dispute.payment.booking.callOffer.creator.user.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {dispute.payment.booking.user.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {dispute.payment.booking.user.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{dispute.payment.booking.callOffer.title}</TableCell>
                        <TableCell className="font-medium">
                          {Number(dispute.amount).toFixed(2)} {dispute.currency}
                        </TableCell>
                        <TableCell className="font-bold text-red-600">
                          {Number(dispute.creatorDebt).toFixed(2)} EUR
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(dispute.status, dispute.reconciled)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={dispute.reason}>
                          {dispute.reason}
                        </TableCell>
                        <TableCell>
                          {dispute.reconciled ? (
                            <div>
                              <div className="text-xs">
                                {dispute.reconciledBy === 'TRANSFER_REVERSAL' && '🔄 Reversal'}
                                {dispute.reconciledBy === 'PAYOUT_DEDUCTION' && '💰 Déduction'}
                                {dispute.reconciledBy === 'MANUAL' && '👤 Manuel'}
                              </div>
                              {dispute.reconciledAt && (
                                <div className="text-xs text-muted-foreground">
                                  {formatDate(dispute.reconciledAt)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!dispute.reconciled && dispute.status === 'LOST' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkAsReconciled('dispute', dispute.id)}
                              disabled={reconcilingId === dispute.id}
                            >
                              {reconcilingId === dispute.id ? 'En cours...' : 'Marquer réconcilié'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

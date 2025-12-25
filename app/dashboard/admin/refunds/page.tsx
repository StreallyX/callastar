'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  LoadingSpinner,
  FilterBar,
  Pagination,
  CurrencyDisplay,
  DateDisplay,
  StatusBadge,
  EmptyState,
} from '@/components/admin';
import { RotateCcw, Plus, Eye, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: string;
  stripeRefundId: string | null;
  initiatedBy: string;
  createdAt: string;
  payment: {
    id: string;
    amount: number;
    booking: {
      user: {
        name: string;
        email: string;
      };
      callOffer: {
        creator: {
          user: {
            name: string;
          };
        };
      };
    };
  };
}

export default function AdminRefunds() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({
    paymentId: '',
    amount: '',
    reason: '',
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    search: '',
  });

  useEffect(() => {
    fetchRefunds();
  }, [page, limit, filters]);

  const fetchRefunds = async () => {
    try {
      setRefreshing(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/admin/refunds?${params}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setRefunds(data.refunds);
        setTotalCount(data.pagination.totalCount);
        setTotalPages(data.pagination.totalPages);
      } else {
        toast.error(data.error || 'Erreur lors du chargement');
      }
    } catch (error) {
      console.error('Error fetching refunds:', error);
      toast.error('Erreur lors du chargement des remboursements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters({ status: '', search: '' });
    setPage(1);
  };

  const handleViewDetails = (refund: Refund) => {
    setSelectedRefund(refund);
    setDetailsOpen(true);
  };

  const handleCreateRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.paymentId || !createForm.reason) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: createForm.paymentId,
          amount: createForm.amount ? parseFloat(createForm.amount) : undefined,
          reason: createForm.reason,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Remboursement créé avec succès');
        setCreateOpen(false);
        setCreateForm({ paymentId: '', amount: '', reason: '' });
        fetchRefunds();
      } else {
        toast.error(data.error || 'Erreur lors de la création');
      }
    } catch (error) {
      toast.error('Erreur lors de la création du remboursement');
    } finally {
      setCreating(false);
    }
  };

  const filterConfigs = [
    {
      key: 'status',
      label: 'Statut',
      type: 'select' as const,
      options: [
        { label: 'Réussi', value: 'SUCCEEDED' },
        { label: 'En attente', value: 'PENDING' },
        { label: 'Échoué', value: 'FAILED' },
      ],
    },
    {
      key: 'search',
      label: 'Recherche',
      type: 'search' as const,
      placeholder: 'ID paiement...',
    },
  ];

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <RotateCcw className="w-8 h-8" />
                Gestion des Remboursements
              </h1>
              <p className="text-gray-600">
                Gérez et créez des remboursements pour les paiements
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchRefunds}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau remboursement
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/admin')}>
                Retour
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <FilterBar
              filters={filterConfigs}
              values={filters}
              onChange={handleFilterChange}
              onReset={handleResetFilters}
            />
          </CardContent>
        </Card>

        {/* Refunds Table */}
        <Card>
          <CardHeader>
            <CardTitle>Remboursements ({totalCount})</CardTitle>
            <CardDescription>
              Liste de tous les remboursements effectués
            </CardDescription>
          </CardHeader>
          <CardContent>
            {refunds.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-left">
                        <th className="py-3 px-2">ID Remb.</th>
                        <th className="py-3 px-2">ID Paiement</th>
                        <th className="py-3 px-2">Utilisateur</th>
                        <th className="py-3 px-2">Créateur</th>
                        <th className="py-3 px-2">Montant</th>
                        <th className="py-3 px-2">Raison</th>
                        <th className="py-3 px-2">Statut</th>
                        <th className="py-3 px-2">Date</th>
                        <th className="py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {refunds.map((refund) => (
                        <tr key={refund.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-2">
                            <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                              {refund.id.substring(0, 8)}...
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <span className="text-xs font-mono bg-blue-100 px-2 py-1 rounded">
                              {refund.paymentId.substring(0, 8)}...
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <div>
                              <p className="font-medium text-xs">{refund.payment.booking.user.name}</p>
                              <p className="text-xs text-gray-500">{refund.payment.booking.user.email}</p>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <p className="text-xs font-medium">
                              {refund.payment.booking.callOffer.creator.user.name}
                            </p>
                          </td>
                          <td className="py-3 px-2">
                            <CurrencyDisplay amount={refund.amount} />
                          </td>
                          <td className="py-3 px-2">
                            <p className="text-xs max-w-[200px] truncate" title={refund.reason}>
                              {refund.reason}
                            </p>
                          </td>
                          <td className="py-3 px-2">
                            <StatusBadge status={refund.status} type="refund" />
                          </td>
                          <td className="py-3 px-2">
                            <DateDisplay date={refund.createdAt} format="datetime" />
                          </td>
                          <td className="py-3 px-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewDetails(refund)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  pageSize={limit}
                  totalItems={totalCount}
                  onPageChange={setPage}
                  onPageSizeChange={setLimit}
                  className="mt-6"
                />
              </>
            ) : (
              <EmptyState
                icon={RotateCcw}
                title="Aucun remboursement trouvé"
                description="Aucun remboursement ne correspond à vos critères."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Refund Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreateRefund}>
            <DialogHeader>
              <DialogTitle>Créer un remboursement</DialogTitle>
              <DialogDescription>
                Rembourser un paiement à un utilisateur
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="paymentId">
                  ID du paiement
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input
                  id="paymentId"
                  placeholder="Entrez l'ID du paiement à rembourser"
                  value={createForm.paymentId}
                  onChange={(e) => setCreateForm({ ...createForm, paymentId: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">
                  Montant (optionnel, remboursement complet par défaut)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Montant du remboursement"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">
                  Raison
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder="Raison du remboursement..."
                  value={createForm.reason}
                  onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                  rows={4}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Création...' : 'Créer le remboursement'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Refund Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du Remboursement</DialogTitle>
          </DialogHeader>
          {selectedRefund && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">ID Remboursement</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                        {selectedRefund.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">ID Stripe</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                        {selectedRefund.stripeRefundId || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Montant</p>
                      <p className="text-lg font-bold text-red-600 mt-1">
                        <CurrencyDisplay amount={selectedRefund.amount} />
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Statut</p>
                      <div className="mt-1">
                        <StatusBadge status={selectedRefund.status} type="refund" />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600">Raison</p>
                      <p className="text-sm mt-1 bg-gray-50 p-2 rounded">{selectedRefund.reason}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Initié par</p>
                      <p className="text-sm font-medium mt-1">{selectedRefund.initiatedBy}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Date</p>
                      <p className="text-sm font-medium mt-1">
                        <DateDisplay date={selectedRefund.createdAt} format="datetime" />
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Paiement original</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="text-gray-600">ID: </span>
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                        {selectedRefund.payment.id}
                      </span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Montant: </span>
                      <CurrencyDisplay amount={selectedRefund.payment.amount} />
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Utilisateur: </span>
                      {selectedRefund.payment.booking.user.name}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Send, Eye, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Payout {
  id: string;
  creatorId: string;
  amount: number;
  status: string;
  stripePayoutId: string | null;
  failureReason: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  creator: {
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
}

export default function AdminPayouts() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    creatorId: '',
  });

  useEffect(() => {
    fetchPayouts();
  }, [filters]);

  const fetchPayouts = async () => {
    try {
      setRefreshing(true);
      
      const params = new URLSearchParams({
        ...(filters.status && { status: filters.status }),
        ...(filters.creatorId && { creatorId: filters.creatorId }),
      });

      const response = await fetch(`/api/admin/payouts?${params}`);
      const data = await response.json();

      if (response.ok) {
        setPayouts(data);
      } else {
        toast.error('Erreur lors du chargement');
      }
    } catch (error) {
      console.error('Error fetching payouts:', error);
      toast.error('Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleResetFilters = () => {
    setFilters({ status: '', creatorId: '' });
  };

  const handleViewDetails = (payout: Payout) => {
    setSelectedPayout(payout);
    setDetailsOpen(true);
  };

  const filterConfigs = [
    {
      key: 'status',
      label: 'Statut',
      type: 'select' as const,
      options: [
        { label: 'Payé', value: 'PAID' },
        { label: 'En attente', value: 'PENDING' },
        { label: 'En cours', value: 'PROCESSING' },
        { label: 'Échoué', value: 'FAILED' },
      ],
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
                <Send className="w-8 h-8" />
                Historique des Paiements aux Créateurs
              </h1>
              <p className="text-gray-600">
                Gérez et consultez tous les paiements aux créateurs
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchPayouts}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Actualiser
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

        {/* Payouts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Paiements ({payouts.length})</CardTitle>
            <CardDescription>
              Liste de tous les paiements effectués aux créateurs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payouts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="py-3 px-2">ID</th>
                      <th className="py-3 px-2">Créateur</th>
                      <th className="py-3 px-2">Montant</th>
                      <th className="py-3 px-2">Statut</th>
                      <th className="py-3 px-2">Raison échec</th>
                      <th className="py-3 px-2">Tentatives</th>
                      <th className="py-3 px-2">Date création</th>
                      <th className="py-3 px-2">Date paiement</th>
                      <th className="py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                            {payout.id.substring(0, 8)}...
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium">{payout.creator.user.name}</p>
                            <p className="text-xs text-gray-500">{payout.creator.user.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <CurrencyDisplay amount={payout.amount} />
                        </td>
                        <td className="py-3 px-2">
                          <StatusBadge status={payout.status} type="payout" />
                        </td>
                        <td className="py-3 px-2">
                          {payout.failureReason ? (
                            <span className="text-xs text-red-600">{payout.failureReason}</span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {payout.retryCount > 0 ? (
                            <span className="text-sm font-medium text-orange-600">
                              {payout.retryCount}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <DateDisplay date={payout.createdAt} format="datetime" />
                        </td>
                        <td className="py-3 px-2">
                          {payout.paidAt ? (
                            <DateDisplay date={payout.paidAt} format="datetime" />
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDetails(payout)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Send}
                title="Aucun paiement trouvé"
                description="Aucun paiement aux créateurs ne correspond à vos critères."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payout Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du Paiement</DialogTitle>
            <DialogDescription>
              Informations complètes sur le paiement au créateur
            </DialogDescription>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informations de Paiement</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">ID Paiement</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                        {selectedPayout.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">ID Stripe Payout</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                        {selectedPayout.stripePayoutId || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Montant</p>
                      <p className="text-lg font-bold text-green-600 mt-1">
                        <CurrencyDisplay amount={selectedPayout.amount} />
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Statut</p>
                      <div className="mt-1">
                        <StatusBadge status={selectedPayout.status} type="payout" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Date création</p>
                      <p className="text-sm font-medium mt-1">
                        <DateDisplay date={selectedPayout.createdAt} format="datetime" />
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Date paiement</p>
                      <p className="text-sm font-medium mt-1">
                        {selectedPayout.paidAt ? (
                          <DateDisplay date={selectedPayout.paidAt} format="datetime" />
                        ) : (
                          <span className="text-gray-400">Non payé</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Nombre de tentatives</p>
                      <p className="text-sm font-medium mt-1">{selectedPayout.retryCount}</p>
                    </div>
                  </div>

                  {selectedPayout.failureReason && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <p className="text-sm font-semibold text-red-900">Raison de l'échec</p>
                      </div>
                      <p className="text-sm text-red-700 mt-1">{selectedPayout.failureReason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Créateur</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-medium">{selectedPayout.creator.user.name}</p>
                    <p className="text-sm text-gray-600">{selectedPayout.creator.user.email}</p>
                    <p className="text-xs text-gray-500">ID: {selectedPayout.creator.id}</p>
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

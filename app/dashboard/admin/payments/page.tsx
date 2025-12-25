'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { CreditCard, Eye, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  stripePaymentIntentId: string;
  status: string;
  platformFee: number;
  creatorAmount: number;
  refundedAmount: number;
  disputeStatus: string | null;
  createdAt: string;
  booking: {
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
    callOffer: {
      id: string;
      title: string;
      creator: {
        id: string;
        user: {
          id: string;
          name: string;
          email: string;
        };
      };
    };
  };
  refunds: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
}

export default function AdminPayments() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    creatorId: '',
    search: '',
  });

  useEffect(() => {
    fetchPayments();
  }, [page, limit, filters]);

  const fetchPayments = async () => {
    try {
      setRefreshing(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.creatorId && { creatorId: filters.creatorId }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/admin/payments?${params}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setPayments(data.payments);
        setTotalCount(data.pagination.totalCount);
        setTotalPages(data.pagination.totalPages);
      } else {
        toast.error(data.error || 'Erreur lors du chargement');
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPage(1); // Reset to first page when filters change
  };

  const handleResetFilters = () => {
    setFilters({ status: '', creatorId: '', search: '' });
    setPage(1);
  };

  const handleViewDetails = (payment: Payment) => {
    setSelectedPayment(payment);
    setDetailsOpen(true);
  };

  const filterConfigs = [
    {
      key: 'status',
      label: 'Statut',
      type: 'select' as const,
      options: [
        { label: 'Réussi', value: 'SUCCEEDED' },
        { label: 'Échoué', value: 'FAILED' },
        { label: 'En attente', value: 'PENDING' },
        { label: 'Remboursé', value: 'REFUNDED' },
      ],
    },
    {
      key: 'search',
      label: 'Recherche',
      type: 'search' as const,
      placeholder: 'ID paiement, email utilisateur...',
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
                <CreditCard className="w-8 h-8" />
                Historique des Paiements
              </h1>
              <p className="text-gray-600">
                Gérez et consultez tous les paiements de la plateforme
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchPayments}
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

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Paiements ({totalCount})</CardTitle>
            <CardDescription>
              Liste de tous les paiements effectués sur la plateforme
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-left">
                        <th className="py-3 px-2">ID</th>
                        <th className="py-3 px-2">Utilisateur</th>
                        <th className="py-3 px-2">Créateur</th>
                        <th className="py-3 px-2">Montant</th>
                        <th className="py-3 px-2">Statut</th>
                        <th className="py-3 px-2">Remboursé</th>
                        <th className="py-3 px-2">Date</th>
                        <th className="py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-2">
                            <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                              {payment.id.substring(0, 8)}...
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <div>
                              <p className="font-medium">{payment.booking.user.name}</p>
                              <p className="text-xs text-gray-500">{payment.booking.user.email}</p>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div>
                              <p className="font-medium">
                                {payment.booking.callOffer.creator.user.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {payment.booking.callOffer.title}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <CurrencyDisplay amount={payment.amount} />
                          </td>
                          <td className="py-3 px-2">
                            <StatusBadge status={payment.status} type="payment" />
                          </td>
                          <td className="py-3 px-2">
                            {payment.refundedAmount > 0 ? (
                              <span className="text-sm text-yellow-600 font-medium">
                                <CurrencyDisplay amount={payment.refundedAmount} />
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <DateDisplay date={payment.createdAt} format="datetime" />
                          </td>
                          <td className="py-3 px-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewDetails(payment)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
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
                icon={CreditCard}
                title="Aucun paiement trouvé"
                description="Aucun paiement ne correspond à vos critères de recherche."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails du Paiement</DialogTitle>
            <DialogDescription>
              Informations complètes sur le paiement
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              {/* Payment Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informations de Paiement</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">ID Paiement</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                        {selectedPayment.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">ID Stripe</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                        {selectedPayment.stripePaymentIntentId}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Montant total</p>
                      <p className="text-lg font-bold text-green-600 mt-1">
                        <CurrencyDisplay amount={selectedPayment.amount} />
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Statut</p>
                      <div className="mt-1">
                        <StatusBadge status={selectedPayment.status} type="payment" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Frais plateforme</p>
                      <p className="text-sm font-medium mt-1">
                        <CurrencyDisplay amount={selectedPayment.platformFee} />
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Montant créateur</p>
                      <p className="text-sm font-medium mt-1">
                        <CurrencyDisplay amount={selectedPayment.creatorAmount} />
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Montant remboursé</p>
                      <p className="text-sm font-medium text-yellow-600 mt-1">
                        <CurrencyDisplay amount={selectedPayment.refundedAmount} />
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Date</p>
                      <p className="text-sm font-medium mt-1">
                        <DateDisplay date={selectedPayment.createdAt} format="datetime" />
                      </p>
                    </div>
                  </div>

                  {selectedPayment.disputeStatus && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <p className="text-sm font-semibold text-red-900">Litige</p>
                      </div>
                      <p className="text-sm text-red-700 mt-1">{selectedPayment.disputeStatus}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* User Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Utilisateur</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-medium">{selectedPayment.booking.user.name}</p>
                    <p className="text-sm text-gray-600">{selectedPayment.booking.user.email}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Creator Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Créateur</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-medium">
                      {selectedPayment.booking.callOffer.creator.user.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedPayment.booking.callOffer.creator.user.email}
                    </p>
                    <p className="text-sm text-gray-500">
                      Offre: {selectedPayment.booking.callOffer.title}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Refunds */}
              {selectedPayment.refunds.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Remboursements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedPayment.refunds.map((refund) => (
                        <div key={refund.id} className="flex justify-between items-center border-b pb-2">
                          <div>
                            <p className="text-sm font-medium">
                              <CurrencyDisplay amount={refund.amount} />
                            </p>
                            <p className="text-xs text-gray-500">
                              <DateDisplay date={refund.createdAt} format="datetime" />
                            </p>
                          </div>
                          <StatusBadge status={refund.status} type="refund" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

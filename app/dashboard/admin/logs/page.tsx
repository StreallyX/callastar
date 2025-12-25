'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  EmptyState,
} from '@/components/admin';
import { FileText, Eye, RefreshCw, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TransactionLog {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  stripeEventId: string | null;
  amount: number;
  currency: string;
  status: string;
  errorMessage: string | null;
  metadata: any;
  createdAt: string;
}

export default function AdminLogs() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logs, setLogs] = useState<TransactionLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<TransactionLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    eventType: '',
    entityType: '',
    status: '',
    search: '',
  });

  useEffect(() => {
    fetchLogs();
  }, [page, limit, filters]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, page, limit, filters]);

  const fetchLogs = async () => {
    try {
      setRefreshing(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.eventType && { eventType: filters.eventType }),
        ...(filters.entityType && { entityType: filters.entityType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/admin/logs?${params}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setLogs(data.logs);
        setTotalCount(data.pagination.totalCount);
        setTotalPages(data.pagination.totalPages);
      } else {
        toast.error(data.error || 'Erreur lors du chargement');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Erreur lors du chargement des logs');
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
    setFilters({ eventType: '', entityType: '', status: '', search: '' });
    setPage(1);
  };

  const handleViewDetails = (log: TransactionLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const handleCopyStripeId = async (stripeId: string) => {
    try {
      await navigator.clipboard.writeText(stripeId);
      toast.success('ID Stripe copié');
    } catch (error) {
      toast.error('Impossible de copier');
    }
  };

  const getEventTypeBadgeColor = (eventType: string) => {
    if (eventType.includes('PAYMENT')) return 'bg-blue-500';
    if (eventType.includes('PAYOUT')) return 'bg-green-500';
    if (eventType.includes('REFUND')) return 'bg-yellow-500';
    if (eventType.includes('DISPUTE')) return 'bg-red-500';
    return 'bg-gray-500';
  };

  const filterConfigs = [
    {
      key: 'eventType',
      label: 'Type d\'événement',
      type: 'select' as const,
      options: [
        { label: 'Paiement', value: 'PAYMENT' },
        { label: 'Paiement créé', value: 'PAYMENT_CREATED' },
        { label: 'Paiement réussi', value: 'PAYMENT_SUCCEEDED' },
        { label: 'Paiement échoué', value: 'PAYMENT_FAILED' },
        { label: 'Remboursement', value: 'REFUND' },
        { label: 'Remboursement créé', value: 'REFUND_CREATED' },
        { label: 'Paiement créateur', value: 'PAYOUT_CREATED' },
        { label: 'Paiement traité', value: 'PAYOUT_PROCESSED' },
        { label: 'Paiement échoué', value: 'PAYOUT_FAILED' },
      ],
    },
    {
      key: 'entityType',
      label: 'Type d\'entité',
      type: 'select' as const,
      options: [
        { label: 'Paiement', value: 'PAYMENT' },
        { label: 'Paiement créateur', value: 'PAYOUT' },
        { label: 'Remboursement', value: 'REFUND' },
        { label: 'Créateur', value: 'CREATOR' },
      ],
    },
    {
      key: 'status',
      label: 'Statut',
      type: 'select' as const,
      options: [
        { label: 'Réussi', value: 'SUCCESS' },
        { label: 'Échoué', value: 'ERROR' },
      ],
    },
    {
      key: 'search',
      label: 'Recherche',
      type: 'search' as const,
      placeholder: 'ID entité, ID Stripe...',
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
                <FileText className="w-8 h-8" />
                Journal des Transactions
              </h1>
              <p className="text-gray-600">
                Visualisez tous les événements et webhooks de la plateforme
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
                <Label htmlFor="auto-refresh" className="text-sm">
                  Auto-actualisation (30s)
                </Label>
              </div>
              <Button
                variant="outline"
                onClick={fetchLogs}
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

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Logs ({totalCount})</CardTitle>
            <CardDescription>
              Historique complet de toutes les transactions et événements
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-left">
                        <th className="py-3 px-2">Horodatage</th>
                        <th className="py-3 px-2">Type d'événement</th>
                        <th className="py-3 px-2">Entité</th>
                        <th className="py-3 px-2">ID Entité</th>
                        <th className="py-3 px-2">Montant</th>
                        <th className="py-3 px-2">Statut</th>
                        <th className="py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-2">
                            <DateDisplay date={log.createdAt} format="datetime" />
                          </td>
                          <td className="py-3 px-2">
                            <Badge className={getEventTypeBadgeColor(log.eventType)}>
                              {log.eventType}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">
                            <Badge variant="outline">{log.entityType}</Badge>
                          </td>
                          <td className="py-3 px-2">
                            {log.entityId ? (
                              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                                {log.entityId.substring(0, 12)}...
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            {log.amount > 0 ? (
                              <CurrencyDisplay amount={log.amount} currency={log.currency} />
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <Badge
                              className={
                                log.status === 'SUCCESS' || log.status.includes('SUCCESS')
                                  ? 'bg-green-500'
                                  : 'bg-red-500'
                              }
                            >
                              {log.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewDetails(log)}
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
                icon={FileText}
                title="Aucun log trouvé"
                description="Aucun log ne correspond à vos critères de recherche."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Log Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails du Log</DialogTitle>
            <DialogDescription>
              Informations complètes sur l'événement de transaction
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informations Générales</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">ID Log</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                        {selectedLog.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Horodatage</p>
                      <p className="text-sm font-medium mt-1">
                        <DateDisplay date={selectedLog.createdAt} format="datetime" />
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Type d'événement</p>
                      <div className="mt-1">
                        <Badge className={getEventTypeBadgeColor(selectedLog.eventType)}>
                          {selectedLog.eventType}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Type d'entité</p>
                      <div className="mt-1">
                        <Badge variant="outline">{selectedLog.entityType}</Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">ID Entité</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                        {selectedLog.entityId || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">ID Stripe Event</p>
                      {selectedLog.stripeEventId ? (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded flex-1">
                            {selectedLog.stripeEventId}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyStripeId(selectedLog.stripeEventId!)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 mt-1">N/A</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Montant</p>
                      <p className="text-lg font-bold mt-1">
                        {selectedLog.amount > 0 ? (
                          <CurrencyDisplay amount={selectedLog.amount} currency={selectedLog.currency} />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Statut</p>
                      <div className="mt-1">
                        <Badge
                          className={
                            selectedLog.status === 'SUCCESS' || selectedLog.status.includes('SUCCESS')
                              ? 'bg-green-500'
                              : 'bg-red-500'
                          }
                        >
                          {selectedLog.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {selectedLog.errorMessage && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm font-semibold text-red-900">Message d'erreur</p>
                      <p className="text-sm text-red-700 mt-1">{selectedLog.errorMessage}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Métadonnées</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-96">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
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

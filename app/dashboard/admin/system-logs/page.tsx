'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  DateDisplay,
  EmptyState,
} from '@/components/admin';
import { FileText, Eye, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface SystemLog {
  id: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  type: string;
  actor: 'USER' | 'CREATOR' | 'ADMIN' | 'SYSTEM' | 'GUEST';
  actorId: string | null;
  message: string;
  metadata: any;
  createdAt: string;
}

export default function SystemLogsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDateRange, setDeleteDateRange] = useState({ start: '', end: '' });
  const [deleting, setDeleting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    level: '',
    actor: '',
    type: '',
    search: '',
    startDate: '',
    endDate: '',
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
        ...(filters.level && { level: filters.level }),
        ...(filters.actor && { actor: filters.actor }),
        ...(filters.type && { type: filters.type }),
        ...(filters.search && { search: filters.search }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(`/api/admin/system-logs?${params}`);
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
    setFilters({ level: '', actor: '', type: '', search: '', startDate: '', endDate: '' });
    setPage(1);
  };

  const handleViewDetails = (log: SystemLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const handleDeleteLogs = async () => {
    if (!deleteDateRange.start || !deleteDateRange.end) {
      toast.error('Veuillez sélectionner une plage de dates');
      return;
    }

    try {
      setDeleting(true);

      const response = await fetch('/api/admin/system-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deleteType: 'dateRange',
          startDate: new Date(deleteDateRange.start).toISOString(),
          endDate: new Date(deleteDateRange.end).toISOString(),
          level: filters.level || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`${data.deletedCount} log(s) supprimé(s)`);
        setDeleteDialogOpen(false);
        setDeleteDateRange({ start: '', end: '' });
        fetchLogs();
      } else {
        toast.error(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting logs:', error);
      toast.error('Erreur lors de la suppression des logs');
    } finally {
      setDeleting(false);
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'INFO':
        return 'bg-blue-500';
      case 'WARNING':
        return 'bg-yellow-500';
      case 'ERROR':
        return 'bg-orange-500';
      case 'CRITICAL':
        return 'bg-red-600';
      default:
        return 'bg-gray-500';
    }
  };

  const getActorBadgeColor = (actor: string) => {
    switch (actor) {
      case 'USER':
        return 'bg-green-500';
      case 'CREATOR':
        return 'bg-purple-500';
      case 'ADMIN':
        return 'bg-red-500';
      case 'SYSTEM':
        return 'bg-gray-500';
      case 'GUEST':
        return 'bg-slate-400';
      default:
        return 'bg-gray-500';
    }
  };

  const filterConfigs = [
    {
      key: 'level',
      label: 'Niveau',
      type: 'select' as const,
      options: [
        { label: 'Info', value: 'INFO' },
        { label: 'Warning', value: 'WARNING' },
        { label: 'Error', value: 'ERROR' },
        { label: 'Critical', value: 'CRITICAL' },
      ],
    },
    {
      key: 'actor',
      label: 'Acteur',
      type: 'select' as const,
      options: [
        { label: 'Utilisateur', value: 'USER' },
        { label: 'Créateur', value: 'CREATOR' },
        { label: 'Admin', value: 'ADMIN' },
        { label: 'Système', value: 'SYSTEM' },
        { label: 'Invité', value: 'GUEST' },
      ],
    },
    {
      key: 'type',
      label: 'Type',
      type: 'search' as const,
      placeholder: 'ex: USER_LOGIN, BOOKING_CREATED',
    },
    {
      key: 'search',
      label: 'Recherche',
      type: 'search' as const,
      placeholder: 'Message, type, acteur ID...',
    },
    {
      key: 'startDate',
      label: 'Date début (YYYY-MM-DD)',
      type: 'search' as const,
      placeholder: '2024-01-01',
    },
    {
      key: 'endDate',
      label: 'Date fin (YYYY-MM-DD)',
      type: 'search' as const,
      placeholder: '2024-12-31',
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
                Logs Système
              </h1>
              <p className="text-gray-600">
                Suivi de toutes les actions utilisateurs, créateurs, admins et événements système
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
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/admin')}>
                Retour
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Page Actuelle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{page} / {totalPages}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Par Page</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{limit}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Filtres Actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(filters).filter(v => v !== '').length}
              </div>
            </CardContent>
          </Card>
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
            <CardTitle>Logs Système ({totalCount})</CardTitle>
            <CardDescription>
              Historique complet de toutes les activités de la plateforme
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-left">
                        <th className="py-3 px-2">Date</th>
                        <th className="py-3 px-2">Niveau</th>
                        <th className="py-3 px-2">Acteur</th>
                        <th className="py-3 px-2">Type</th>
                        <th className="py-3 px-2">Message</th>
                        <th className="py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-2 whitespace-nowrap">
                            <DateDisplay date={log.createdAt} format="datetime" />
                          </td>
                          <td className="py-3 px-2">
                            <Badge className={getLevelBadgeColor(log.level)}>
                              {log.level}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">
                            <Badge className={getActorBadgeColor(log.actor)}>
                              {log.actor}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">
                            <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                              {log.type}
                            </span>
                          </td>
                          <td className="py-3 px-2 max-w-md truncate">
                            {log.message}
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
              Informations complètes sur l'événement système
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
                      <p className="text-sm text-gray-600">Date</p>
                      <p className="text-sm font-medium mt-1">
                        <DateDisplay date={selectedLog.createdAt} format="datetime" />
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Niveau</p>
                      <div className="mt-1">
                        <Badge className={getLevelBadgeColor(selectedLog.level)}>
                          {selectedLog.level}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Acteur</p>
                      <div className="mt-1">
                        <Badge className={getActorBadgeColor(selectedLog.actor)}>
                          {selectedLog.actor}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Type</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                        {selectedLog.type}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">ID Acteur</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                        {selectedLog.actorId || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm text-gray-600">Message</p>
                    <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded">
                      <p className="text-sm">{selectedLog.message}</p>
                    </div>
                  </div>
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

      {/* Delete Logs Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Supprimer des Logs
            </DialogTitle>
            <DialogDescription>
              Attention : Cette action est irréversible. Sélectionnez une plage de dates pour supprimer les logs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="start-date">Date de début</Label>
              <Input
                id="start-date"
                type="date"
                value={deleteDateRange.start}
                onChange={(e) => setDeleteDateRange({ ...deleteDateRange, start: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="end-date">Date de fin</Label>
              <Input
                id="end-date"
                type="date"
                value={deleteDateRange.end}
                onChange={(e) => setDeleteDateRange({ ...deleteDateRange, end: e.target.value })}
                className="mt-1"
              />
            </div>
            {filters.level && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-900">
                  ℹ️ Le filtre de niveau <Badge className={getLevelBadgeColor(filters.level)}>{filters.level}</Badge> sera appliqué à la suppression
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteLogs}
              disabled={deleting || !deleteDateRange.start || !deleteDateRange.end}
            >
              {deleting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

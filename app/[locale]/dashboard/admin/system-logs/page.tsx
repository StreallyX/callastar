'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '@/navigation';
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
import {
  FileText,
  Eye,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Download,
  Copy,
  Filter,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

// ✅ IMPORTANT
// Cette page est faite pour matcher un modèle Prisma type "Log" :
// { id, type, status, message, context(json), error, createdAt }
// Et elle reconstruit "level" + "actor" côté UI (car ton backend ne stocke
// probablement PAS level/actor en colonnes dédiées, mais dans context).

type UiLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
type UiActor = 'USER' | 'CREATOR' | 'ADMIN' | 'SYSTEM' | 'GUEST';

interface DbLog {
  id: string;
  type: string;
  status: 'SUCCESS' | 'ERROR';
  message: string;
  context: any;
  error: string | null;
  createdAt: string;
}

interface SystemLogUI {
  id: string;
  type: string;
  status: 'SUCCESS' | 'ERROR';
  level: UiLevel;
  actor: UiActor;
  actorId: string | null;
  message: string;
  metadata: any;
  error: string | null;
  createdAt: string;
}

function safeString(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  try {
    return String(v);
  } catch {
    return '';
  }
}

function inferActorFromType(type: string): UiActor {
  const t = (type || '').toUpperCase();
  if (t.startsWith('ADMIN_')) return 'ADMIN';
  if (t.startsWith('CREATOR_')) return 'CREATOR';
  if (t.startsWith('USER_') || t.startsWith('AUTH_')) return 'USER';
  if (t.startsWith('SYSTEM_') || t.startsWith('CRON_') || t.startsWith('API_')) return 'SYSTEM';
  return 'GUEST';
}

function normalizeLevel(status: 'SUCCESS' | 'ERROR', context: any): UiLevel {
  // Tu peux piloter WARNING/CRITICAL via context.warning / context.critical
  if (context?.critical === true) return 'CRITICAL';
  if (context?.warning === true) return 'WARNING';
  return status === 'ERROR' ? 'ERROR' : 'INFO';
}

function normalizeActor(context: any, type: string): UiActor {
  const actor = safeString(context?.actor).toUpperCase();
  if (actor === 'USER' || actor === 'CREATOR' || actor === 'ADMIN' || actor === 'SYSTEM' || actor === 'GUEST') {
    return actor as UiActor;
  }
  return inferActorFromType(type);
}

function normalizeActorId(context: any): string | null {
  // Compat: actorId, userId, creatorId, adminId
  const actorId = context?.actorId ?? context?.userId ?? context?.creatorId ?? context?.adminId ?? null;
  if (!actorId) return null;
  const s = safeString(actorId).trim();
  return s.length ? s : null;
}

function toSystemLogUI(db: DbLog): SystemLogUI {
  const ctx = db.context ?? {};
  return {
    id: db.id,
    type: db.type,
    status: db.status,
    level: normalizeLevel(db.status, ctx),
    actor: normalizeActor(ctx, db.type),
    actorId: normalizeActorId(ctx),
    message: db.message,
    metadata: ctx,
    error: db.error,
    createdAt: db.createdAt,
  };
}

export default function SystemLogsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logs, setLogs] = useState<SystemLogUI[]>([]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const [selectedLog, setSelectedLog] = useState<SystemLogUI | null>(null);
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
    level: '' as '' | UiLevel,
    actor: '' as '' | UiActor,
    type: '',
    search: '',
    startDate: '',
    endDate: '',
  });

  const abortRef = useRef<AbortController | null>(null);

  const activeFiltersCount = useMemo(
    () => Object.values(filters).filter((v) => v !== '').length,
    [filters]
  );

  const pageStats = useMemo(() => {
    const total = logs.length;
    const errors = logs.filter((l) => l.status === 'ERROR').length;
    const warnings = logs.filter((l) => l.level === 'WARNING').length;
    const critical = logs.filter((l) => l.level === 'CRITICAL').length;
    const success = total - errors;
    return { total, success, errors, warnings, critical };
  }, [logs]);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(filters.type && { type: filters.type }),
      ...(filters.search && { search: filters.search }),
      ...(filters.startDate && { startDate: filters.startDate }),
      ...(filters.endDate && { endDate: filters.endDate }),
    });

    // ⚠️ level / actor = UI ONLY → filtrage local
    return params;
  }, [filters, limit, page]);


  const fetchLogs = useCallback(async () => {
    // cancel previous in-flight
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setErrorMessage(null);
      setRefreshing(true);

      const params = buildParams();
      const response = await fetch(`/api/admin/system-logs?${params.toString()}`, {
        signal: controller.signal,
      });

      // Si l'API renvoie du non-JSON, on évite le crash.
      const text = await response.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        const message = data?.error || `Erreur API (${response.status})`;
        setErrorMessage(message);
        toast.error(message);
        setLogs([]);
        setTotalCount(0);
        setTotalPages(0);
        return;
      }

      if (!data?.success) {
        const message = data?.error || 'Erreur lors du chargement';
        setErrorMessage(message);
        toast.error(message);
        setLogs([]);
        setTotalCount(0);
        setTotalPages(0);
        return;
      }

      const rawLogs: DbLog[] = Array.isArray(data.logs) ? data.logs : [];
      const uiLogs = rawLogs.map(toSystemLogUI);
      const filteredLogs = uiLogs.filter((log) => {
        if (filters.level && log.level !== filters.level) return false;
        if (filters.actor && log.actor !== filters.actor) return false;
        return true;
      });

      setLogs(filteredLogs);
      setTotalCount(Number(data.pagination?.totalCount ?? uiLogs.length) || 0);
      setTotalPages(Number(data.pagination?.totalPages ?? 1) || 1);
      setLastRefreshedAt(new Date());

      if (loading) setLoading(false);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Error fetching logs:', err);
      setErrorMessage('Erreur lors du chargement des logs');
      toast.error('Erreur lors du chargement des logs');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [buildParams, loading]);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, filters]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLogs();
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchLogs]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters({ level: '', actor: '', type: '', search: '', startDate: '', endDate: '' });
    setPage(1);
  };

  const handleRemoveFilter = (key: keyof typeof filters) => {
    setFilters((prev) => ({ ...prev, [key]: '' as any }));
    setPage(1);
  };

  const handleViewDetails = (log: SystemLogUI) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const handleCopy = async (value: string, label = 'Copié') => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const handleExportJson = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        page,
        limit,
        filters,
        logs,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-logs_page-${page}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Export JSON prêt');
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'export");
    }
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
          ...(filters.type && { type: filters.type }),
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        toast.success(`${data.deletedCount} log(s) supprimé(s)`);
        setDeleteDialogOpen(false);
        setDeleteDateRange({ start: '', end: '' });
        fetchLogs();
      } else {
        toast.error(data?.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting logs:', error);
      toast.error('Erreur lors de la suppression des logs');
    } finally {
      setDeleting(false);
    }
  };

  const getLevelBadgeColor = (level: UiLevel) => {
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

  const getStatusBadgeColor = (status: 'SUCCESS' | 'ERROR') => {
    return status === 'SUCCESS' ? 'bg-emerald-600' : 'bg-red-600';
  };

  const getActorBadgeColor = (actor: UiActor) => {
    switch (actor) {
      case 'USER':
        return 'bg-green-500';
      case 'CREATOR':
        return 'bg-purple-500';
      case 'ADMIN':
        return 'bg-red-500';
      case 'SYSTEM':
        return 'bg-gray-600';
      case 'GUEST':
        return 'bg-slate-400';
      default:
        return 'bg-gray-500';
    }
  };

  const filterConfigs = useMemo(
    () => [
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
        placeholder: 'ex: AUTH_LOGIN, BOOKING_CREATED, PAYMENT_SUCCESS',
      },
      {
        key: 'search',
        label: 'Recherche',
        type: 'search' as const,
        placeholder: 'Message / type / IDs (bookingId, userId...)',
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
    ],
    []
  );

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: keyof typeof filters; label: string; value: string }> = [];
    if (filters.level) chips.push({ key: 'level', label: 'Niveau', value: filters.level });
    if (filters.actor) chips.push({ key: 'actor', label: 'Acteur', value: filters.actor });
    if (filters.type) chips.push({ key: 'type', label: 'Type', value: filters.type });
    if (filters.search) chips.push({ key: 'search', label: 'Recherche', value: filters.search });
    if (filters.startDate) chips.push({ key: 'startDate', label: 'Début', value: filters.startDate });
    if (filters.endDate) chips.push({ key: 'endDate', label: 'Fin', value: filters.endDate });
    return chips;
  }, [filters]);

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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <FileText className="w-8 h-8" />
                Logs Système
              </h1>
              <p className="text-gray-600 max-w-3xl">
                Suivi de toutes les actions utilisateurs, créateurs, admins et événements système. Idéal pour diagnostiquer les bugs,
                vérifier les crons, auditer les paiements et tracer les notifications.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1">
                  <Filter className="h-4 w-4" />
                  {activeFiltersCount} filtre(s) actif(s)
                </span>
                {lastRefreshedAt && (
                  <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1">
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Dernière mise à jour : {lastRefreshedAt.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm">
                <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                <Label htmlFor="auto-refresh" className="text-sm">
                  Auto-actualisation (30s)
                </Label>
              </div>

              <Button variant="outline" onClick={fetchLogs} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>

              <Button variant="outline" onClick={handleExportJson} disabled={logs.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>

              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>

              <Button variant="outline" onClick={() => router.push('/dashboard/admin')}>
                Retour
              </Button>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-900">Impossible de charger les logs</p>
                  <p className="text-sm text-red-800 mt-1">{errorMessage}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={fetchLogs}>
                      Réessayer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setErrorMessage(null)}>
                      Masquer
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total logs (DB)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">Total côté base de données</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Page</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {page} / {totalPages}
              </div>
              <p className="text-xs text-gray-500 mt-1">Navigation paginée</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Par page</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{limit}</div>
              <p className="text-xs text-gray-500 mt-1">Taille de page</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Stats (page)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-emerald-600">{pageStats.success} OK</Badge>
                <Badge className="bg-red-600">{pageStats.errors} ERR</Badge>
                {pageStats.warnings > 0 && <Badge className="bg-yellow-500">{pageStats.warnings} WARN</Badge>}
                {pageStats.critical > 0 && <Badge className="bg-red-700">{pageStats.critical} CRIT</Badge>}
              </div>
              <p className="text-xs text-gray-500 mt-2">Sur les logs affichés</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Filtres actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeFiltersCount}</div>
              <p className="text-xs text-gray-500 mt-1">Clique sur un chip pour retirer</p>
            </CardContent>
          </Card>
        </div>

        {/* Active filters chips */}
        {activeFilterChips.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-gray-500">
                  <Filter className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2">
                    {activeFilterChips.map((chip) => (
                      <button
                        key={chip.key}
                        onClick={() => handleRemoveFilter(chip.key)}
                        className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs hover:bg-gray-50"
                        title="Retirer ce filtre"
                      >
                        <span className="text-gray-500">{chip.label}:</span>
                        <span className="font-medium">{chip.value}</span>
                        <X className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                    ))}
                    <Button size="sm" variant="ghost" onClick={handleResetFilters}>
                      Réinitialiser
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Filtres</CardTitle>
            <CardDescription>
              Filtre par niveau/acteur (reconstruits via context), type, recherche texte, et plage de dates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FilterBar filters={filterConfigs} values={filters} onChange={handleFilterChange} onReset={handleResetFilters} />
          </CardContent>
        </Card>

        {/* Legend */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Légende</CardTitle>
            <CardDescription>
              La colonne « Niveau » est calculée depuis status + context.warning / context.critical.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-blue-500">INFO</Badge>
              <Badge className="bg-yellow-500">WARNING</Badge>
              <Badge className="bg-orange-500">ERROR</Badge>
              <Badge className="bg-red-600">CRITICAL</Badge>
              <span className="text-xs text-gray-500 ml-2">
                Astuce : pour générer un WARNING, log avec context.warning=true ; CRITICAL avec context.critical=true.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Logs Système ({totalCount.toLocaleString()})</CardTitle>
            <CardDescription>Historique complet de toutes les activités de la plateforme</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length > 0 ? (
              <>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-gray-50">
                      <tr className="text-left">
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Niveau</th>
                        <th className="py-3 px-3">Statut</th>
                        <th className="py-3 px-3">Acteur</th>
                        <th className="py-3 px-3">Type</th>
                        <th className="py-3 px-3">Message</th>
                        <th className="py-3 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-3 whitespace-nowrap">
                            <DateDisplay date={log.createdAt} format="datetime" />
                          </td>
                          <td className="py-3 px-3">
                            <Badge className={getLevelBadgeColor(log.level)}>{log.level}</Badge>
                          </td>
                          <td className="py-3 px-3">
                            <Badge className={getStatusBadgeColor(log.status)}>{log.status}</Badge>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <Badge className={getActorBadgeColor(log.actor)}>{log.actor}</Badge>
                              {log.actorId && (
                                <button
                                  onClick={() => handleCopy(log.actorId!, 'ID acteur copié')}
                                  className="inline-flex items-center gap-1 rounded border bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                                  title="Copier l'ID acteur"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  <span className="max-w-[160px] truncate">{log.actorId}</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{log.type}</span>
                          </td>
                          <td className="py-3 px-3 max-w-md">
                            <div className="truncate" title={log.message}>
                              {log.message}
                            </div>
                            {log.error && (
                              <div className="mt-1 text-xs text-red-700 truncate" title={log.error}>
                                {log.error}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="ghost" onClick={() => handleViewDetails(log)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleCopy(log.id, 'ID log copié')}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
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
                description="Aucun log ne correspond à vos critères de recherche. Essayez de réinitialiser les filtres ou d'élargir la plage de dates."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Log Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails du Log</DialogTitle>
            <DialogDescription>Informations complètes sur l'événement système</DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Résumé</CardTitle>
                  <CardDescription>
                    {selectedLog.type} • {selectedLog.status} • {selectedLog.level}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">ID Log</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded flex-1 truncate">
                          {selectedLog.id}
                        </p>
                        <Button size="sm" variant="outline" onClick={() => handleCopy(selectedLog.id, 'ID log copié')}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">Date</p>
                      <p className="text-sm font-medium mt-1">
                        <DateDisplay date={selectedLog.createdAt} format="datetime" />
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">Niveau</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge className={getLevelBadgeColor(selectedLog.level)}>{selectedLog.level}</Badge>
                        <Badge className={getStatusBadgeColor(selectedLog.status)}>{selectedLog.status}</Badge>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">Acteur</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge className={getActorBadgeColor(selectedLog.actor)}>{selectedLog.actor}</Badge>
                        <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {selectedLog.actorId || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">Type</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                        {selectedLog.type}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">Message</p>
                      <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded">
                        <p className="text-sm whitespace-pre-wrap">{selectedLog.message}</p>
                      </div>
                    </div>
                  </div>

                  {selectedLog.error && (
                    <div>
                      <p className="text-sm text-gray-600">Erreur / Stack</p>
                      <pre className="mt-1 bg-red-50 border border-red-200 text-red-900 p-4 rounded text-xs overflow-auto max-h-72">
                        {selectedLog.error}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Contexte (metadata)</CardTitle>
                    <CardDescription>
                      Objet JSON stocké en base. Les IDs (bookingId, userId, creatorId...) sont généralement ici.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-96">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Actions rapides</CardTitle>
                  <CardDescription>Copier les champs utiles en un clic</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopy(selectedLog.id, 'ID log copié')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copier ID log
                  </Button>
                  {selectedLog.actorId && (
                    <Button size="sm" variant="outline" onClick={() => handleCopy(selectedLog.actorId!, 'ID acteur copié')}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copier ID acteur
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(JSON.stringify(selectedLog, null, 2), 'Log JSON copié')}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copier JSON
                  </Button>
                </CardContent>
              </Card>
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
              Tu peux appliquer les filtres actuels (niveau/acteur/type/recherche) si ton endpoint DELETE les gère.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            {(filters.level || filters.actor || filters.type || filters.search) && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-900 font-medium mb-2">ℹ️ Filtres appliqués à la suppression</p>
                <div className="flex flex-wrap gap-2">
                  {filters.level && <Badge className={getLevelBadgeColor(filters.level)}>{filters.level}</Badge>}
                  {filters.actor && <Badge className={getActorBadgeColor(filters.actor)}>{filters.actor}</Badge>}
                  {filters.type && <Badge className="bg-slate-700">{filters.type}</Badge>}
                  {filters.search && <Badge className="bg-slate-700">search:{filters.search}</Badge>}
                </div>
                <p className="text-xs text-blue-900 mt-2">
                  Si ton API DELETE ne supporte pas ces filtres, enlève-les dans le body du fetch.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
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

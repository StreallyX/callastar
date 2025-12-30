'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Send, Eye, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
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
  const t = useTranslations('dashboard.admin');
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Approval/Rejection modals
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [payoutToApprove, setPayoutToApprove] = useState<Payout | null>(null);
  const [payoutToReject, setPayoutToReject] = useState<Payout | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    creatorId: '',
  });

  // Initial load on component mount
  useEffect(() => {
    console.log('[AdminPayouts] Component mounted, fetching payouts...');
    fetchPayouts();
  }, []); // Empty dependencies = runs only on mount

  // Reload when filters change
  useEffect(() => {
    console.log('[AdminPayouts] Filters changed:', filters);
    fetchPayouts();
  }, [filters]);

  const fetchPayouts = async () => {
    try {
      setRefreshing(true);
      
      const params = new URLSearchParams({
        ...(filters.status && { status: filters.status }),
        ...(filters.creatorId && { creatorId: filters.creatorId }),
      });

      console.log('[AdminPayouts] Fetching payouts with params:', params.toString());
      const response = await fetch(`/api/admin/payouts?${params}`);
      const data = await response.json();

      console.log('[AdminPayouts] Response:', { ok: response.ok, status: response.status, count: data.length });

      if (response.ok) {
        setPayouts(data);
        console.log('[AdminPayouts] Payouts loaded:', data.length);
      } else {
        console.error('[AdminPayouts] Error response:', data);
        toast.error(t('common.error'));
      }
    } catch (error) {
      console.error('[AdminPayouts] Error fetching payouts:', error);
      toast.error(t('common.error'));
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

  const handleOpenApproveModal = (payout: Payout) => {
    setPayoutToApprove(payout);
    setApproveModalOpen(true);
  };

  const handleOpenRejectModal = (payout: Payout) => {
    setPayoutToReject(payout);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleApprovePayout = async () => {
    if (!payoutToApprove) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/payouts/${payoutToApprove.id}/approve`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(t('payouts.approveSuccess') || 'Payment approved successfully');
        setApproveModalOpen(false);
        setPayoutToApprove(null);
        await fetchPayouts(); // Refresh the list
      } else {
        toast.error(data.error || t('common.error'));
      }
    } catch (error) {
      console.error('Error approving payout:', error);
      toast.error(t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPayout = async () => {
    if (!payoutToReject || !rejectionReason.trim()) {
      toast.error(t('payouts.rejectReasonRequired') || 'Please provide a rejection reason');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/payouts/${payoutToReject.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: rejectionReason,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(t('payouts.rejectSuccess') || 'Payment rejected');
        setRejectModalOpen(false);
        setPayoutToReject(null);
        setRejectionReason('');
        await fetchPayouts(); // Refresh the list
      } else {
        toast.error(data.error || t('common.error'));
      }
    } catch (error) {
      console.error('Error rejecting payout:', error);
      toast.error(t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ PHASE 3: Updated statuses to match new enum
  const filterConfigs = [
    {
      key: 'status',
      label: t('payments.status') || 'Status',
      type: 'select' as const,
      options: [
        { label: t('payouts.statusRequested') || 'Requested', value: 'REQUESTED' },
        { label: t('payouts.statusApproved') || 'Approved', value: 'APPROVED' },
        { label: t('payouts.statusProcessing') || 'Processing', value: 'PROCESSING' },
        { label: t('payouts.statusPaid') || 'Paid', value: 'PAID' },
        { label: t('payouts.statusFailed') || 'Failed', value: 'FAILED' },
        { label: t('payouts.statusRejected') || 'Rejected', value: 'REJECTED' },
        { label: t('payouts.statusCanceled') || 'Canceled', value: 'CANCELED' },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <LoadingSpinner text={t('common.loading') || 'Loading...'} />
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
                {t('payouts.historyTitle') || 'Creator Payments History'}
              </h1>
              <p className="text-gray-600">
                {t('payouts.historyDescription') || 'Manage and view all payments to creators'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchPayouts}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {t('common.refresh') || 'Refresh'}
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/admin')}>
                {t('common.back') || 'Back'}
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
            <CardTitle>{t('payouts.paymentsCount', { count: payouts.length }) || `Payments (${payouts.length})`}</CardTitle>
            <CardDescription>
              {t('payouts.paymentsListDescription') || 'List of all payments made to creators'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payouts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="py-3 px-2">{t('common.id') || 'ID'}</th>
                      <th className="py-3 px-2">{t('payouts.creator') || 'Creator'}</th>
                      <th className="py-3 px-2">{t('payouts.amount') || 'Amount'}</th>
                      <th className="py-3 px-2">{t('payments.status') || 'Status'}</th>
                      <th className="py-3 px-2">{t('payouts.failureRejectReason') || 'Failure/Rejection Reason'}</th>
                      <th className="py-3 px-2">{t('payouts.retries') || 'Retries'}</th>
                      <th className="py-3 px-2">{t('payouts.createdDate') || 'Created Date'}</th>
                      <th className="py-3 px-2">{t('payouts.paidDate') || 'Paid Date'}</th>
                      <th className="py-3 px-2">{t('common.actions') || 'Actions'}</th>
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
                          <DateDisplay date={payout.createdAt} format="datetime" locale={locale} />
                        </td>
                        <td className="py-3 px-2">
                          {payout.paidAt ? (
                            <DateDisplay date={payout.paidAt} format="datetime" locale={locale} />
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex gap-1">
                            {/* ✅ PHASE 3: Changed from PENDING_APPROVAL to REQUESTED */}
                            {payout.status === 'REQUESTED' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleOpenApproveModal(payout)}
                                  title="Approuver"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleOpenRejectModal(payout)}
                                  title="Rejeter"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewDetails(payout)}
                              title="Voir détails"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Send}
                title={t('payouts.noPayouts') || 'No payments found'}
                description={t('payouts.noPayoutsDescription') || 'No creator payments match your criteria.'}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payout Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('payouts.detailsTitle') || 'Payment Details'}</DialogTitle>
            <DialogDescription>
              {t('payouts.detailsDescription') || 'Complete information about the creator payment'}
            </DialogDescription>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('payouts.paymentInfo') || 'Payment Information'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">{t('payouts.paymentId') || 'Payment ID'}</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                        {selectedPayout.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('payouts.stripePayoutId') || 'Stripe Payout ID'}</p>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                        {selectedPayout.stripePayoutId || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('payouts.amount') || 'Amount'}</p>
                      <p className="text-lg font-bold text-green-600 mt-1">
                        <CurrencyDisplay amount={selectedPayout.amount} />
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('payments.status') || 'Status'}</p>
                      <div className="mt-1">
                        <StatusBadge status={selectedPayout.status} type="payout" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('payouts.createdDate') || 'Created Date'}</p>
                      <p className="text-sm font-medium mt-1">
                        <DateDisplay date={selectedPayout.createdAt} format="datetime" locale={locale} />
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('payouts.paidDate') || 'Paid Date'}</p>
                      <p className="text-sm font-medium mt-1">
                        {selectedPayout.paidAt ? (
                          <DateDisplay date={selectedPayout.paidAt} format="datetime" locale={locale} />
                        ) : (
                          <span className="text-gray-400">{t('payouts.notPaid') || 'Not paid'}</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('payouts.retriesCount') || 'Number of retries'}</p>
                      <p className="text-sm font-medium mt-1">{selectedPayout.retryCount}</p>
                    </div>
                  </div>

                  {selectedPayout.failureReason && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <p className="text-sm font-semibold text-red-900">{t('payouts.failureReason') || 'Failure reason'}</p>
                      </div>
                      <p className="text-sm text-red-700 mt-1">{selectedPayout.failureReason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('payouts.creator') || 'Creator'}</CardTitle>
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

      {/* Approve Modal */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('payouts.approveTitle') || 'Approve payment'}</DialogTitle>
            <DialogDescription>
              {t('payouts.approveDescription') || 'Are you sure you want to approve this payment?'}
            </DialogDescription>
          </DialogHeader>
          {payoutToApprove && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{t('payouts.creator') || 'Creator'}:</span>
                      <span className="text-sm font-medium">{payoutToApprove.creator.user.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{t('payouts.amount') || 'Amount'}:</span>
                      <span className="text-sm font-bold text-green-600">
                        <CurrencyDisplay amount={payoutToApprove.amount} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{t('payouts.requestDate') || 'Request date'}:</span>
                      <span className="text-sm">
                        <DateDisplay date={payoutToApprove.createdAt} format="datetime" locale={locale} />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  {t('payouts.approveWarning') || '⚠️ This action will trigger the real Stripe transfer to the creator\'s bank account.'}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveModalOpen(false)}
              disabled={actionLoading}
            >
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleApprovePayout}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? (t('payouts.approving') || 'Approving...') : (t('payouts.approve') || 'Approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('payouts.rejectTitle') || 'Reject payment'}</DialogTitle>
            <DialogDescription>
              {t('payouts.rejectDescription') || 'Please provide a reason for rejecting this payment.'}
            </DialogDescription>
          </DialogHeader>
          {payoutToReject && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{t('payouts.creator') || 'Creator'}:</span>
                      <span className="text-sm font-medium">{payoutToReject.creator.user.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{t('payouts.amount') || 'Amount'}:</span>
                      <span className="text-sm font-bold text-red-600">
                        <CurrencyDisplay amount={payoutToReject.amount} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{t('payouts.requestDate') || 'Request date'}:</span>
                      <span className="text-sm">
                        <DateDisplay date={payoutToReject.createdAt} format="datetime" locale={locale} />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div>
                <label htmlFor="rejection-reason" className="block text-sm font-medium mb-2">
                  {t('payouts.rejectReasonLabel') || 'Rejection reason'} *
                </label>
                <Textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={t('payouts.rejectReasonPlaceholder') || 'Explain why this payment is rejected...'}
                  rows={4}
                  className="w-full"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectModalOpen(false)}
              disabled={actionLoading}
            >
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleRejectPayout}
              disabled={actionLoading || !rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? (t('payouts.rejecting') || 'Rejecting...') : (t('payouts.reject') || 'Reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

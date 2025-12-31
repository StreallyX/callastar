'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, DollarSign, Loader2, ArrowLeft, MessageSquare, Check, X, User } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/navigation';

export default function RequestsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard.creator.requests');
  const [user, setUser] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatorCurrency, setCreatorCurrency] = useState<string>('EUR');
  
  // Confirm dialog state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('NOT_AVAILABLE');
  const [rejectCustomMessage, setRejectCustomMessage] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (!userResponse.ok) {
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        router.push('/auth/login');
        return;
      }
      const userData = await userResponse.json();
      
      if (userData?.user?.role !== 'CREATOR') {
        router.push('/dashboard/user');
        return;
      }
      
      setUser(userData?.user);
      
      const creatorId = userData?.user?.creator?.id;

      // ✅ FIX: Get real Stripe currency from balance API
      if (creatorId) {
        const balanceResponse = await fetch(`/api/stripe/balance/${creatorId}`);
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          setCreatorCurrency(balanceData.stripeCurrency || balanceData.currency || 'EUR');
        }
      }

      // Get call requests
      const requestsResponse = await fetch('/api/call-requests?type=received');
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        // L'API retourne directement le tableau, pas un objet avec une propriété callRequests
        setRequests(Array.isArray(requestsData) ? requestsData : []);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRequest = async () => {
    if (!selectedRequest) return;

    setConfirming(true);
    try {
      const response = await fetch(`/api/call-requests/${selectedRequest.id}/accept`, {
        method: 'PUT',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('confirmAcceptDesc'));
      }

      toast.success(t('acceptedRequests'));
      setConfirmDialogOpen(false);
      setSelectedRequest(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest) return;

    setRejecting(true);
    try {
      const response = await fetch(`/api/call-requests/${selectedRequest.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReason,
          customMessage: rejectCustomMessage,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Échec du rejet');
      }

      toast.success(t('rejectedRequests'));
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectReason('NOT_AVAILABLE');
      setRejectCustomMessage('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setRejecting(false);
    }
  };

  const openConfirmDialog = (request: any) => {
    setSelectedRequest(request);
    setConfirmDialogOpen(true);
  };

  const openRejectDialog = (request: any) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');
  const acceptedRequests = requests.filter((r) => r.status === 'ACCEPTED');
  const rejectedRequests = requests.filter((r) => r.status === 'REJECTED');

  const rejectReasons = [
    { value: 'NOT_AVAILABLE', label: t('reasonNotAvailable') },
    { value: 'PRICE_TOO_LOW', label: t('reasonPriceTooLow') },
    { value: 'OTHER', label: t('reasonOther') },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/creator">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('backToDashboard')}
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{t('pending')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{pendingRequests.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{t('accepted')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{acceptedRequests.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{t('rejected')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{rejectedRequests.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">{t('pendingRequests')}</h2>
            <div className="grid gap-4">
              {pendingRequests.map((request: any) => (
                <Card key={request.id} className="border-yellow-200 bg-yellow-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-purple-100 rounded-full">
                            <User className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-lg">{request?.user?.name ?? t('user')}</p>
                            <p className="text-sm text-gray-600">{request?.user?.email}</p>
                          </div>
                          <Badge className="bg-yellow-500">{t('pending')}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-700 ml-14">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{new Date(request.proposedDateTime).toLocaleString(locale)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            <span>{Number(request.proposedPrice).toFixed(2)} {creatorCurrency}</span>
                          </div>
                          {request.message && (
                            <div className="flex items-start gap-2 mt-2 p-3 bg-white rounded border">
                              <MessageSquare className="w-4 h-4 mt-0.5" />
                              <p className="text-sm flex-1">{request.message}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={() => openConfirmDialog(request)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {t('accept')}
                      </Button>
                      <Button
                        onClick={() => openRejectDialog(request)}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        {t('reject')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Accepted Requests */}
        {acceptedRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">{t('acceptedRequests')}</h2>
            <div className="grid gap-4">
              {acceptedRequests.map((request: any) => (
                <Card key={request.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-purple-100 rounded-full">
                            <User className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-lg">{request?.user?.name ?? t('user')}</p>
                            <p className="text-sm text-gray-600">{request?.user?.email}</p>
                          </div>
                          <Badge className="bg-green-500">{t('accepted')}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600 ml-14">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{new Date(request.proposedDateTime).toLocaleString(locale)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            <span>{Number(request.proposedPrice).toFixed(2)} {creatorCurrency}</span>
                          </div>
                          {request.message && (
                            <div className="flex items-start gap-2 mt-2">
                              <MessageSquare className="w-4 h-4 mt-0.5" />
                              <p className="text-sm">{request.message}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Rejected Requests */}
        {rejectedRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">{t('rejectedRequests')}</h2>
            <div className="grid gap-4">
              {rejectedRequests.map((request: any) => (
                <Card key={request.id} className="opacity-60">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-purple-100 rounded-full">
                            <User className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-lg">{request?.user?.name ?? t('user')}</p>
                            <p className="text-sm text-gray-600">{request?.user?.email}</p>
                          </div>
                          <Badge className="bg-red-500">{t('rejected')}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600 ml-14">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{new Date(request.proposedDateTime).toLocaleString(locale)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            <span>{Number(request.proposedPrice).toFixed(2)} {creatorCurrency}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* No Requests */}
        {requests.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">{t('noRequests')}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmAccept')}</DialogTitle>
            <DialogDescription>
              {t('confirmAcceptDesc')}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-2 py-4">
              <p><strong>{t('user')}:</strong> {selectedRequest.user?.name}</p>
              <p><strong>{t('dateTime')}:</strong> {new Date(selectedRequest.proposedDateTime).toLocaleString(locale)}</p>
              <p><strong>{t('proposedPrice')}:</strong> {Number(selectedRequest.proposedPrice).toFixed(2)} {creatorCurrency}</p>
              {selectedRequest.message && (
                <p><strong>{t('message')}:</strong> {selectedRequest.message}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={confirming}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleConfirmRequest}
              disabled={confirming}
              className="bg-green-600 hover:bg-green-700"
            >
              {confirming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('confirming')}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {t('confirm')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reject')} la demande</DialogTitle>
            <DialogDescription>
              {t('rejectDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="reason">{t('rejectReason')}</Label>
              <Select value={rejectReason} onValueChange={setRejectReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rejectReasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {rejectReason === 'OTHER' && (
              <div>
                <Label htmlFor="customMessage">{t('specifyReason')}</Label>
                <Textarea
                  id="customMessage"
                  value={rejectCustomMessage}
                  onChange={(e) => setRejectCustomMessage(e.target.value)}
                  rows={3}
                  placeholder="{t('explainRejection')}"
                  required
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={rejecting}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleRejectRequest}
              disabled={rejecting || (rejectReason === 'OTHER' && !rejectCustomMessage.trim())}
              variant="destructive"
            >
              {rejecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('rejecting')}
                </>
              ) : (
                <>
                  <X className="w-4 h-4 mr-2" />
                  {t('reject')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Clock, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from '@/navigation';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';

export default function RequestsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard.user.requests');

  const [user, setUser] = useState<any>(null);
  const [callRequests, setCallRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (!userResponse.ok) {
        router.push('/auth/login');
        return;
      }

      const userData = await userResponse.json();
      setUser(userData?.user);

      const requestsResponse = await fetch('/api/call-requests?type=sent');
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setCallRequests(Array.isArray(requestsData) ? requestsData : []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
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

  const pendingRequests = callRequests.filter((r: any) => r.status === 'PENDING');
  const acceptedRequests = callRequests.filter((r: any) => r.status === 'ACCEPTED');
  const rejectedRequests = callRequests.filter((r: any) => r.status === 'REJECTED');

  const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    ACCEPTED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  };

  const statusLabels = {
    PENDING: t('status.pending'),
    ACCEPTED: t('status.accepted'),
    REJECTED: t('status.rejected'),
  };

  const renderRequestCard = (request: any) => (
    <Card key={request.id}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-lg">
                {t('requestTo')} {request?.creator?.user?.name}
              </h3>
              <Badge
                className={
                  statusColors[
                    request.status as keyof typeof statusColors
                  ]
                }
              >
                {
                  statusLabels[
                    request.status as keyof typeof statusLabels
                  ]
                }
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>
                  {new Date(
                    request.proposedDateTime
                  ).toLocaleString(locale)}
                </span>
              </div>
              <span>•</span>
              <CurrencyDisplay
                amount={Number(request.proposedPrice)}
                currency={request?.creator?.currency || 'EUR'}
              />
            </div>

            {request.message && (
              <div className="flex items-start gap-2 mt-2">
                <MessageSquare className="w-4 h-4 mt-0.5 text-gray-400" />
                <p className="text-sm text-gray-600">
                  {request.message}
                </p>
              </div>
            )}

            <p className="text-xs text-gray-400">
              {t('sentOn')}{' '}
              {new Date(request.createdAt).toLocaleDateString(locale)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard/user">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('backToDashboard')}
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {t('title')}
          </h1>
          <p className="text-gray-600">
            {t('subtitle')}
          </p>
        </div>

        {/* Statistics */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>
                {t('stats.pending')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {pendingRequests.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>
                {t('stats.accepted')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {acceptedRequests.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>
                {t('stats.rejected')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {rejectedRequests.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending */}
        {pendingRequests.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t('sections.pending')}</CardTitle>
              <CardDescription>
                {t('sections.pendingDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingRequests.map(renderRequestCard)}
            </CardContent>
          </Card>
        )}

        {/* Accepted */}
        {acceptedRequests.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t('sections.accepted')}</CardTitle>
              <CardDescription>
                {t('sections.acceptedDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {acceptedRequests.map(renderRequestCard)}
            </CardContent>
          </Card>
        )}

        {/* Rejected */}
        {rejectedRequests.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t('sections.rejected')}</CardTitle>
              <CardDescription>
                {t('sections.rejectedDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rejectedRequests.map(renderRequestCard)}
            </CardContent>
          </Card>
        )}

        {/* Empty */}
        {callRequests.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {t('noRequests')}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                {t('visitCreatorProfile')}
              </p>
              <Link href="/creators">
                <Button variant="outline" className="mt-4">
                  {t('browseCreators')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

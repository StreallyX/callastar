'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, CreditCard, Calendar, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { CurrencyDisplay } from '@/components/ui/currency-display';

export default function PaymentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatorCurrency, setCreatorCurrency] = useState<string>('EUR');

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
      if (userData?.user?.creator?.currency) {
        setCreatorCurrency(userData.user.creator.currency);
      }

      // Get payments from payouts endpoint
      const payoutsResponse = await fetch('/api/payouts/creator');
      if (payoutsResponse.ok) {
        const payoutsData = await payoutsResponse.json();
        setPayments(payoutsData?.payments ?? []);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
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

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.creatorAmount ?? 0), 0);
  const paidPayments = payments.filter((p) => p.payoutStatus === 'PAID');
  const pendingPayments = payments.filter((p) => p.payoutStatus === 'HELD' || p.payoutStatus === 'PENDING');
  const readyPayments = payments.filter((p) => p.payoutStatus === 'READY');

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/creator">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Historique des Paiements</h1>
          <p className="text-gray-600">Consultez tous vos paiements reçus</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <CurrencyDisplay amount={totalAmount} currency={creatorCurrency} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Transférés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{paidPayments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">En attente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingPayments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{readyPayments.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Payments List */}
        {payments.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Tous les paiements</CardTitle>
              <CardDescription>Liste complète de vos paiements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payments.map((payment: any) => {
                  const statusInfo = {
                    PAID: { label: '✓ Transféré', color: 'bg-green-500' },
                    READY: { label: '✓ Disponible', color: 'bg-purple-500' },
                    HELD: { label: '⏳ En attente', color: 'bg-yellow-500' },
                    PROCESSING: { label: '⏳ En cours', color: 'bg-blue-500' },
                    PENDING: { label: '⏳ En attente', color: 'bg-yellow-500' },
                  };
                  const status = statusInfo[payment.payoutStatus as keyof typeof statusInfo] || { label: payment.payoutStatus, color: 'bg-gray-500' };

                  return (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-purple-100 rounded-full">
                            <CreditCard className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <div className="font-medium">{payment.booking?.callOffer?.title}</div>
                            <div className="text-sm text-gray-500">
                              {payment.booking?.user?.name} • {new Date(payment.booking?.callOffer?.dateTime).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 ml-11">
                          {payment.payoutReleaseDate && payment.payoutStatus === 'HELD' && (
                            <>Disponible le {new Date(payment.payoutReleaseDate).toLocaleDateString('fr-FR')}</>
                          )}
                          {payment.payoutDate && payment.payoutStatus === 'PAID' && (
                            <>Transféré le {new Date(payment.payoutDate).toLocaleDateString('fr-FR')}</>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-semibold text-lg">
                          <CurrencyDisplay 
                            amount={Number(payment.creatorAmount)} 
                            currency={payment.currency || creatorCurrency} 
                          />
                        </div>
                        <Badge className={status.color}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucun paiement pour le moment</p>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800 text-base">📋 Information</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-700 space-y-2">
            <p><strong>Période de sécurité :</strong> Les paiements restent en attente pendant 7 jours pour la protection contre les litiges.</p>
            <p><strong>Transfert automatique :</strong> Après la période de sécurité, les fonds sont automatiquement transférés vers votre compte Stripe Connect.</p>
            <p><strong>Gestion des payouts :</strong> Pour gérer vos virements vers votre compte bancaire, rendez-vous sur la page <Link href="/dashboard/creator/payouts" className="underline font-semibold">Payouts</Link>.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, DollarSign, Loader2, User, Clock, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPayoutRequestDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [payoutRequest, setPayoutRequest] = useState<any>(null);
  const [preparingPayout, setPreparingPayout] = useState(false);
  const [stripeDashboardLink, setStripeDashboardLink] = useState<string | null>(null);

  useEffect(() => {
    fetchPayoutRequest();
  }, [params.id]);

  const fetchPayoutRequest = async () => {
    try {
      const response = await fetch(`/api/admin/payout-requests/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setPayoutRequest(data.payoutRequest);
        
        // Set Stripe dashboard link if transfer already exists
        if (data.payoutRequest.stripeTransferId) {
          setStripeDashboardLink(`https://dashboard.stripe.com/transfers/${data.payoutRequest.stripeTransferId}`);
        }
      } else {
        toast.error('Demande de paiement introuvable');
        router.push('/dashboard/admin');
      }
    } catch (error) {
      console.error('Error fetching payout request:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handlePrepareStripe = async () => {
    if (!confirm(`Confirmer la préparation du transfert de ${Number(payoutRequest.totalAmount).toFixed(2)} € vers le compte Stripe de ${payoutRequest.creator.user.name}?`)) {
      return;
    }

    setPreparingPayout(true);
    try {
      const response = await fetch(`/api/admin/payout-requests/${params.id}/prepare-stripe`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Transfert Stripe créé avec succès');
        setStripeDashboardLink(data.stripeDashboardLink);
        fetchPayoutRequest(); // Refresh data
      } else {
        toast.error(data.error || 'Erreur lors de la création du transfert');
      }
    } catch (error) {
      console.error('Error preparing payout:', error);
      toast.error('Erreur lors de la préparation du paiement');
    } finally {
      setPreparingPayout(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500';
      case 'PROCESSING':
        return 'bg-blue-500';
      case 'FAILED':
        return 'bg-red-500';
      case 'REVERSED':
        return 'bg-red-600';
      case 'PENDING':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return '✓ Terminé';
      case 'PROCESSING':
        return '⏳ En cours de traitement';
      case 'FAILED':
        return '✗ Échoué';
      case 'REVERSED':
        return '⚠ Inversé';
      case 'PENDING':
        return '⏳ En attente de traitement';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        </div>
      </div>
    );
  }

  if (!payoutRequest) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Demande de paiement introuvable</h2>
            <Button onClick={() => router.push('/dashboard/admin')}>
              Retour au tableau de bord
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/admin')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Demande de paiement - Admin</h1>
          <p className="text-gray-600">Demande #{payoutRequest.id.slice(0, 8)}</p>
        </div>

        {/* Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {Number(payoutRequest.totalAmount).toFixed(2)} €
                </CardTitle>
                <CardDescription className="mt-2">
                  Demande de {payoutRequest.creator.user.name} ({payoutRequest.creator.user.email})
                </CardDescription>
              </div>
              <Badge className={getStatusColor(payoutRequest.status)}>
                {getStatusLabel(payoutRequest.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-start space-x-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Date de demande</p>
                  <p className="font-medium">
                    {new Date(payoutRequest.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {payoutRequest.completedAt && (
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Date de transfert</p>
                    <p className="font-medium">
                      {new Date(payoutRequest.completedAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start space-x-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Nombre de paiements</p>
                  <p className="font-medium">{payoutRequest.paymentCount} paiements</p>
                </div>
              </div>

              {payoutRequest.stripeTransferId && (
                <div className="flex items-start space-x-3">
                  <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">ID Stripe Transfer</p>
                    <p className="font-mono text-xs">{payoutRequest.stripeTransferId}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Stripe Account Info */}
            {payoutRequest.stripeAccountInfo && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">Informations du compte Stripe</h3>
                <div className="grid md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-blue-700">ID compte:</span>{' '}
                    <span className="font-mono text-xs">{payoutRequest.stripeAccountInfo.id}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Pays:</span>{' '}
                    {payoutRequest.stripeAccountInfo.country}
                  </div>
                  <div>
                    <span className="text-blue-700">Paiements activés:</span>{' '}
                    {payoutRequest.stripeAccountInfo.payouts_enabled ? (
                      <CheckCircle className="w-4 h-4 inline text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 inline text-red-600" />
                    )}
                  </div>
                  <div>
                    <span className="text-blue-700">Charges activées:</span>{' '}
                    {payoutRequest.stripeAccountInfo.charges_enabled ? (
                      <CheckCircle className="w-4 h-4 inline text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 inline text-red-600" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              {payoutRequest.status === 'PENDING' && (
                <Button
                  onClick={handlePrepareStripe}
                  disabled={preparingPayout || !payoutRequest.stripeAccountInfo?.payouts_enabled}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {preparingPayout ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Préparation...
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4 mr-2" />
                      Préparer le transfert Stripe
                    </>
                  )}
                </Button>
              )}

              {stripeDashboardLink && (
                <Button
                  variant="outline"
                  onClick={() => window.open(stripeDashboardLink, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Voir sur Stripe Dashboard
                </Button>
              )}
            </div>

            {/* Status Information */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              {payoutRequest.status === 'PENDING' && (
                <p className="text-sm text-gray-700">
                  ⏳ En attente de traitement. Cliquez sur "Préparer le transfert Stripe" pour créer le transfert.
                  Le transfert sera automatiquement traité par Stripe et le statut sera mis à jour via webhook.
                </p>
              )}
              {payoutRequest.status === 'PROCESSING' && (
                <p className="text-sm text-gray-700">
                  🔄 Le transfert est en cours de traitement sur Stripe. Le statut sera automatiquement mis à jour
                  lorsque le transfert sera terminé.
                </p>
              )}
              {payoutRequest.status === 'COMPLETED' && (
                <p className="text-sm text-gray-700">
                  ✅ Le transfert de {Number(payoutRequest.totalAmount).toFixed(2)} € a été effectué avec succès
                  le {new Date(payoutRequest.completedAt).toLocaleDateString('fr-FR')}.
                </p>
              )}
              {payoutRequest.status === 'FAILED' && (
                <p className="text-sm text-red-700">
                  ❌ Le transfert a échoué. Vérifiez les détails sur le Stripe Dashboard et contactez le créateur si nécessaire.
                </p>
              )}
              {payoutRequest.status === 'REVERSED' && (
                <div className="space-y-3">
                  <p className="text-sm text-red-700 font-semibold">
                    ⚠️ Le transfert de {Number(payoutRequest.totalAmount).toFixed(2)} € a été inversé par Stripe.
                  </p>
                  {payoutRequest.reversalReason && (
                    <div className="text-sm">
                      <p className="text-gray-600 font-medium">Raison :</p>
                      <p className="text-gray-700 mt-1">{payoutRequest.reversalReason}</p>
                    </div>
                  )}
                  {payoutRequest.reversedAt && (
                    <p className="text-xs text-gray-500">
                      Date d'inversion : {new Date(payoutRequest.reversedAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                  {payoutRequest.reversalId && (
                    <p className="text-xs text-gray-500 font-mono">
                      ID de l'inversion : {payoutRequest.reversalId}
                    </p>
                  )}
                  <p className="text-sm text-gray-700 mt-2">
                    Consultez le Stripe Dashboard pour plus de détails. Les paiements associés ont été marqués comme inversés.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payments List */}
        <Card>
          <CardHeader>
            <CardTitle>Paiements inclus</CardTitle>
            <CardDescription>
              Liste des {payoutRequest.payments?.length || 0} paiements inclus dans cette demande
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payoutRequest.payments && payoutRequest.payments.length > 0 ? (
              <div className="space-y-4">
                {payoutRequest.payments.map((payment: any) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="font-medium">{payment.booking?.callOffer?.title || 'Appel'}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        <User className="w-3 h-3 inline mr-1" />
                        {payment.booking?.user?.name || 'Utilisateur'}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {payment.booking?.callOffer?.dateTime 
                          ? new Date(payment.booking.callOffer.dateTime).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Date inconnue'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Paiement reçu le {new Date(payment.createdAt).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-semibold text-lg">{Number(payment.creatorAmount).toFixed(2)} €</div>
                      <div className="text-xs text-gray-500">Total: {Number(payment.amount).toFixed(2)} €</div>
                      <div className="text-xs text-gray-500">Frais: {Number(payment.platformFee).toFixed(2)} €</div>
                    </div>
                  </div>
                ))}

                {/* Total Summary */}
                <div className="flex items-center justify-between p-4 border-t-2 border-purple-200 bg-purple-50 rounded-lg mt-4">
                  <div className="font-semibold text-lg">Total de la demande</div>
                  <div className="font-bold text-2xl text-purple-600">
                    {Number(payoutRequest.totalAmount).toFixed(2)} €
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">Aucun paiement trouvé</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

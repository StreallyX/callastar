'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, DollarSign, AlertCircle, ArrowLeft, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface BalanceData {
  available: number;
  pending: number;
  currency: string; // Database currency (EUR)
  stripeCurrency?: string; // Stripe account currency
  payoutsEnabled: boolean;
}

interface PayoutSettings {
  schedule: 'DAILY' | 'WEEKLY' | 'MANUAL';
  minimum: number;
}

export default function RequestPayoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [settings, setSettings] = useState<PayoutSettings | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [requestAmount, setRequestAmount] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get user data
      const userResponse = await fetch('/api/auth/me');
      if (!userResponse.ok) {
        router.push('/auth/login');
        return;
      }
      const userData = await userResponse.json();
      
      if (userData?.user?.role !== 'CREATOR') {
        router.push('/dashboard/user');
        return;
      }

      const cId = userData?.user?.creator?.id;
      setCreatorId(cId);

      // Fetch balance
      const balanceResponse = await fetch(`/api/stripe/balance/${cId}`);
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        setBalance({
          available: balanceData.available || 0,
          pending: balanceData.pending || 0,
          currency: balanceData.currency || 'EUR',
          stripeCurrency: balanceData.stripeCurrency || 'EUR',
          payoutsEnabled: balanceData.payoutsEnabled || false,
        });
        // Set default request amount to available balance
        setRequestAmount(balanceData.available?.toFixed(2) || '0.00');
      } else {
        toast.error('Impossible de récupérer le solde');
        router.push('/dashboard/creator/payouts');
        return;
      }

      // Fetch settings
      const settingsResponse = await fetch('/api/creators/payout-settings');
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSettings({
          schedule: settingsData.payoutSchedule || 'MANUAL',
          minimum: settingsData.payoutMinimum || 10,
        });

        // Check if schedule is MANUAL
        if (settingsData.payoutSchedule !== 'MANUAL') {
          toast.error('Les demandes manuelles ne sont pas activées');
          router.push('/dashboard/creator/payouts');
          return;
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(requestAmount);

    // Validation
    if (isNaN(amount) || amount <= 0) {
      toast.error('Veuillez entrer un montant valide');
      return;
    }

    if (amount < (settings?.minimum || 10)) {
      toast.error(`Le montant doit être au moins ${settings?.minimum || 10} €`);
      return;
    }

    if (balance && amount > balance.available) {
      toast.error('Le montant demandé dépasse votre solde disponible');
      return;
    }

    if (!balance?.payoutsEnabled) {
      toast.error('Les virements ne sont pas activés sur votre compte');
      return;
    }

    setRequesting(true);
    try {
      const response = await fetch('/api/creators/payouts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Demande de virement soumise avec succès !');
        setTimeout(() => {
          router.push('/dashboard/creator/payouts');
        }, 1500);
      } else {
        const error = await response.json();
        toast.error(error?.error || 'Erreur lors de la demande');
      }
    } catch (error) {
      console.error('Error requesting payout:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-2xl px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  const canRequest = balance && balance.payoutsEnabled && balance.available >= (settings?.minimum || 10);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-2xl px-4 py-8">
        {/* Back Button */}
        <Link href="/dashboard/creator/payouts">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux paiements
          </Button>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Demander un virement manuel</h1>
          <p className="text-gray-600">
            Soumettez une demande de virement pour approbation
          </p>
        </div>

        {/* Balance Card */}
        <Card className="mb-6 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Solde disponible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600 mb-2">
              {balance?.available.toFixed(2) || '0.00'} {balance?.stripeCurrency || 'EUR'}
            </div>
            {balance?.stripeCurrency && balance.stripeCurrency !== 'EUR' && (
              <p className="text-sm text-gray-500 mb-2">
                ≈ {balance.available.toFixed(2)} EUR (base)
              </p>
            )}
            <p className="text-sm text-gray-600">
              Montant maximum que vous pouvez demander
            </p>
          </CardContent>
        </Card>

        {/* Currency Conversion Info */}
        {balance?.stripeCurrency && balance.stripeCurrency !== 'EUR' && (
          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              <strong>Conversion de devise :</strong> Votre compte Stripe est en {balance.stripeCurrency}.
              Le montant sera converti automatiquement de EUR (base) vers {balance.stripeCurrency} lors du virement.
              Le taux de conversion actuel sera appliqué au moment du traitement.
            </AlertDescription>
          </Alert>
        )}

        {/* Error States */}
        {!balance?.payoutsEnabled && (
          <Alert className="mb-6 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              Les virements ne sont pas activés sur votre compte. Veuillez compléter votre 
              configuration de paiement.
            </AlertDescription>
          </Alert>
        )}

        {balance && balance.available < (settings?.minimum || 10) && (
          <Alert className="mb-6 bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-700">
              Votre solde disponible est inférieur au minimum requis ({settings?.minimum || 10} €). 
              Vous ne pouvez pas demander de virement pour le moment.
            </AlertDescription>
          </Alert>
        )}

        {/* Request Form */}
        {canRequest ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Montant du virement
              </CardTitle>
              <CardDescription>
                Indiquez le montant que vous souhaitez recevoir
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Montant (€)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min={settings?.minimum || 10}
                    max={balance?.available || 0}
                    step="0.01"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    required
                  />
                  <p className="text-sm text-gray-500">
                    Minimum: {settings?.minimum || 10} € • Maximum: {balance?.available.toFixed(2) || 0} €
                  </p>
                </div>

                {/* Quick Amount Buttons */}
                <div className="space-y-2">
                  <Label>Montants rapides</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRequestAmount((balance?.available * 0.25).toFixed(2))}
                    >
                      25%
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRequestAmount((balance?.available * 0.5).toFixed(2))}
                    >
                      50%
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRequestAmount(balance?.available.toFixed(2) || '0')}
                    >
                      100%
                    </Button>
                  </div>
                </div>

                {/* Info Alert */}
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700 text-sm">
                    <strong>Important :</strong> Cette demande sera examinée par un administrateur 
                    avant d'être traitée. Vous serez notifié une fois la demande approuvée ou rejetée.
                  </AlertDescription>
                </Alert>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={requesting}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="lg"
                >
                  {requesting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Soumission en cours...
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-5 h-5 mr-2" />
                      Soumettre la demande
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                Vous ne pouvez pas effectuer de demande de virement pour le moment
              </p>
              <Link href="/dashboard/creator/payouts" className="mt-4 inline-block">
                <Button variant="outline">
                  Retour aux paiements
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Process Info */}
        <Card className="mt-6 bg-gray-50 border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">Processus de demande</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                1
              </div>
              <div>
                <strong>Soumission :</strong> Vous soumettez votre demande avec le montant souhaité
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                2
              </div>
              <div>
                <strong>Examen :</strong> Un administrateur examine votre demande (généralement sous 24-48h)
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                3
              </div>
              <div>
                <strong>Approbation :</strong> Si approuvée, le virement est créé vers votre compte Stripe
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                4
              </div>
              <div>
                <strong>Traitement :</strong> Stripe traite le virement vers votre compte bancaire (2-5 jours ouvrables)
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

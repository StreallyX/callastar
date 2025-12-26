'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Clock, Loader2, AlertCircle, CreditCard, Building2, FileText, Shield, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

type OnboardingStatus = 'incomplete' | 'in_progress' | 'complete';

interface StripeAccountData {
  onboarded: boolean;
  stripeAccountId?: string;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  canReceivePayments?: boolean;
  canReceivePayouts?: boolean;
  accountStatus?: string;
  statusMessage?: string;
  recommendedAction?: string;
  issues?: string[];
  requirements?: {
    currentlyDue?: string[];
    eventuallyDue?: string[];
    pastDue?: string[];
  };
  capabilities?: {
    cardPayments?: string;
    transfers?: string;
  };
  hasExternalAccount?: boolean;
}

export default function PaymentSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accountData, setAccountData] = useState<StripeAccountData | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetchAccountStatus();
    
    // ✅ FIX: Check if returning from Stripe onboarding
    const params = new URLSearchParams(window.location.search);
    const onboardingParam = params.get('onboarding');
    
    if (onboardingParam === 'success' || onboardingParam === 'refresh') {
      console.log('[Payment Setup] Returned from onboarding, re-verifying...');
      
      if (onboardingParam === 'success') {
        toast.info('Vérification de votre configuration en cours...');
      }
      
      // Re-verify after delay to allow Stripe to process
      setTimeout(() => {
        fetchAccountStatus();
        window.history.replaceState({}, '', window.location.pathname);
      }, 2000);
    }
  }, []);

  const fetchAccountStatus = async () => {
    try {
      const response = await fetch('/api/stripe/connect-onboard');
      if (response.ok) {
        const data = await response.json();
        setAccountData(data);
      } else if (response.status === 401) {
        router.push('/auth/login');
      } else {
        toast.error('Erreur lors de la récupération du statut');
      }
    } catch (error) {
      console.error('Error fetching account status:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleStartOnboarding = async () => {
    setStarting(true);
    try {
      const response = await fetch('/api/stripe/connect-onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Redirection vers Stripe...');
        window.location.href = data.url;
      } else {
        const error = await response.json();
        toast.error(error?.error || 'Erreur lors de la création du lien');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setStarting(false);
    }
  };

  // IMPORTANT: For Stripe Connect Express accounts, operational status is determined by:
  // 1. details_submitted === true (user completed onboarding)
  // 2. requirements.currently_due.length === 0 (no pending requirements)
  //
  // DO NOT use charges_enabled or payouts_enabled for validation:
  // - These can be false in test mode
  // - These can be false during Stripe processing delays
  // - These represent immediate technical state, not account readiness
  //
  // Stripe Dashboard may show "all capabilities enabled" (authorization)
  // while charges_enabled is still false (immediate state)
  const getStatus = (): OnboardingStatus => {
    if (!accountData?.stripeAccountId) return 'incomplete';
    
    const isComplete =
      accountData?.detailsSubmitted === true &&
      (accountData?.requirements?.currentlyDue?.length ?? 0) === 0;
    
    if (isComplete) {
      return 'complete';
    }
    
    return accountData?.detailsSubmitted ? 'in_progress' : 'incomplete';
  };

  const status = getStatus();

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Configuration des paiements</h1>
          <p className="text-gray-600">
            Configurez votre compte Stripe Connect pour recevoir vos paiements
          </p>
        </div>

        {/* Status Card */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Statut de configuration</CardTitle>
                <CardDescription className="mt-1">
                  État actuel de votre compte de paiement
                </CardDescription>
              </div>
              {status === 'complete' && (
                <Badge className="bg-green-500 text-white text-base px-4 py-2">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Paiements activés
                </Badge>
              )}
              {status === 'in_progress' && (
                <Badge className="bg-yellow-500 text-white text-base px-4 py-2">
                  <Clock className="w-4 h-4 mr-2" />
                  Vérification en cours
                </Badge>
              )}
              {status === 'incomplete' && (
                <Badge className="bg-red-500 text-white text-base px-4 py-2">
                  <XCircle className="w-4 h-4 mr-2" />
                  Configuration incomplète
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Details */}
            <div className="space-y-3">
              <StatusItem
                icon={CheckCircle}
                label="Compte Stripe créé"
                completed={!!accountData?.stripeAccountId}
              />
              <StatusItem
                icon={FileText}
                label="Informations soumises"
                completed={!!accountData?.detailsSubmitted}
              />
              <StatusItem
                icon={Shield}
                label="Vérification complétée"
                completed={(accountData?.requirements?.currentlyDue?.length ?? 0) === 0}
              />
              <StatusItem
                icon={CheckCircle2}
                label="Compte opérationnel"
                completed={
                  accountData?.detailsSubmitted === true &&
                  (accountData?.requirements?.currentlyDue?.length ?? 0) === 0
                }
              />
            </div>

            {/* ✅ FIX: Show detailed issues and requirements */}
            {accountData?.issues && accountData.issues.length > 0 && status !== 'complete' && (
              <div className="pt-4 border-t">
                <h4 className="font-semibold text-sm mb-2 text-gray-700">Problèmes détectés:</h4>
                <ul className="space-y-1">
                  {accountData.issues.map((issue, index) => (
                    <li key={index} className="text-sm text-red-600 flex items-start gap-2">
                      <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Show missing requirements */}
            {accountData?.requirements?.currentlyDue && accountData.requirements.currentlyDue.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="font-semibold text-sm mb-2 text-gray-700">Informations requises:</h4>
                <ul className="space-y-1">
                  {accountData.requirements.currentlyDue.map((req, index) => (
                    <li key={index} className="text-sm text-yellow-600 flex items-start gap-2">
                      <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{req.replace(/_/g, ' ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended action */}
            {accountData?.recommendedAction && status !== 'complete' && (
              <Alert className="bg-blue-50 border-blue-200 mt-4">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700">
                  <strong>Action recommandée:</strong> {accountData.recommendedAction}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Button */}
            <div className="pt-4 border-t">
              {status === 'complete' ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    Votre configuration est complète ! Vous pouvez maintenant recevoir des paiements.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button
                  onClick={handleStartOnboarding}
                  disabled={starting}
                  size="lg"
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {starting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Redirection...
                    </>
                  ) : (
                    <>
                      {status === 'incomplete' && 'Commencer la configuration'}
                      {status === 'in_progress' && 'Continuer la configuration'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Informations nécessaires
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-blue-700">
            <p className="font-semibold">
              Pour compléter votre configuration Stripe Connect, vous aurez besoin de :
            </p>
            <ul className="space-y-2 ml-4 list-disc">
              <li>Vos informations personnelles (nom, date de naissance, adresse)</li>
              <li>Un document d'identité valide (carte d'identité ou passeport)</li>
              <li>Vos coordonnées bancaires (IBAN)</li>
              <li>Des informations sur votre activité</li>
            </ul>
            <p className="pt-3 border-t border-blue-300 mt-3">
              <strong>Sécurité :</strong> Toutes vos informations sont sécurisées par Stripe et 
              conformes aux réglementations européennes (PSD2). La plateforme n'a jamais accès 
              à vos coordonnées bancaires complètes.
            </p>
            <p>
              <strong>Durée :</strong> Le processus prend généralement entre 5 et 10 minutes. 
              La vérification peut prendre jusqu'à 24-48 heures.
            </p>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Questions fréquentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">
                Pourquoi dois-je fournir mes informations bancaires ?
              </h4>
              <p className="text-gray-600">
                Stripe Connect exige ces informations pour se conformer aux réglementations 
                anti-blanchiment et pour pouvoir vous verser vos paiements.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">
                Combien de temps prend la vérification ?
              </h4>
              <p className="text-gray-600">
                La plupart des comptes sont vérifiés en quelques heures. Dans certains cas, 
                cela peut prendre jusqu'à 2 jours ouvrables.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">
                Puis-je modifier mes informations plus tard ?
              </h4>
              <p className="text-gray-600">
                Oui, vous pouvez accéder à votre tableau de bord Stripe à tout moment pour 
                mettre à jour vos informations bancaires et personnelles.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface StatusItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  completed: boolean;
}

function StatusItem({ icon: Icon, label, completed }: StatusItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-full ${
          completed ? 'bg-green-100' : 'bg-gray-100'
        }`}
      >
        {completed ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
          <Icon className="w-5 h-5 text-gray-400" />
        )}
      </div>
      <span className={`font-medium ${completed ? 'text-gray-900' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}

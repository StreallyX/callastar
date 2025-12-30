'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  FileText,
  Shield,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

type OnboardingStatus = 'incomplete' | 'in_progress' | 'complete';

interface StripeAccountData {
  stripeAccountId?: string;
  isFullyOnboarded: boolean;
  canReceivePayments: boolean;
  canReceivePayouts: boolean;
  detailsSubmitted?: boolean;
  hasExternalAccount?: boolean;
  issues?: string[];
  recommendedAction?: string;
  requirements?: {
    currentlyDue?: string[];
    pastDue?: string[];
    eventuallyDue?: string[];
  };
}

export default function PaymentSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [accountData, setAccountData] = useState<StripeAccountData | null>(null);

  useEffect(() => {
    fetchAccountStatus();

    const params = new URLSearchParams(window.location.search);
    const onboardingParam = params.get('onboarding');

    if (onboardingParam === 'success' || onboardingParam === 'refresh') {
      toast.info('Vérification de votre configuration Stripe…');

      setTimeout(() => {
        fetchAccountStatus();
        window.history.replaceState({}, '', window.location.pathname);
      }, 2000);
    }
  }, []);

  const fetchAccountStatus = async () => {
    try {
      const res = await fetch('/api/stripe/connect-onboard');

      if (res.status === 401) {
        router.push('/auth/login');
        return;
      }

      if (!res.ok) {
        toast.error('Erreur lors de la récupération du statut Stripe');
        return;
      }

      const data = await res.json();
      setAccountData(data);
    } catch (err) {
      console.error(err);
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleStartOnboarding = async () => {
    setStarting(true);
    try {
      const res = await fetch('/api/stripe/connect-onboard', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error || 'Erreur Stripe');
        return;
      }

      window.location.href = data.url;
    } catch {
      toast.error('Impossible de démarrer Stripe');
    } finally {
      setStarting(false);
    }
  };

  const status: OnboardingStatus = !accountData?.stripeAccountId
  ? 'incomplete'
  : accountData.canReceivePayments
  ? 'complete'
  : 'in_progress';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Configuration des paiements</h1>
          <p className="text-gray-600">
            Configurez votre compte Stripe Connect pour recevoir vos paiements
          </p>
        </div>

        {/* STATUS CARD */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">Statut Stripe</CardTitle>
              <CardDescription>État réel de votre compte Stripe Connect</CardDescription>
            </div>

            {status === 'complete' && (
              <Badge className="bg-green-500 text-white px-4 py-2">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Paiements activés
              </Badge>
            )}

            {status === 'in_progress' && (
              <Badge className="bg-yellow-500 text-white px-4 py-2">
                <Clock className="w-4 h-4 mr-2" />
                Action requise
              </Badge>
            )}

            {status === 'incomplete' && (
              <Badge className="bg-red-500 text-white px-4 py-2">
                <XCircle className="w-4 h-4 mr-2" />
                Non configuré
              </Badge>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
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
              label="Compte opérationnel"
              completed={!!accountData?.canReceivePayments}
            />

            {/* ISSUES */}
            {accountData?.issues && accountData.issues.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="font-semibold text-sm mb-2 text-gray-700">
                  Problèmes détectés
                </h4>
                <ul className="space-y-1">
                  {accountData.issues.map((issue, i) => (
                    <li key={i} className="text-sm text-red-600 flex gap-2">
                      <XCircle className="w-4 h-4 mt-0.5" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* RECOMMENDED ACTION */}
            {accountData?.recommendedAction && !accountData?.canReceivePayments && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-700">
                  <strong>Action requise :</strong> {accountData.recommendedAction}
                </AlertDescription>
              </Alert>
            )}

            {/* CTA */}
            <div className="pt-4 border-t">
              {status === 'complete' ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    Votre compte Stripe est correctement configuré.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button
                  onClick={handleStartOnboarding}
                  disabled={starting}
                  size="lg"
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  {starting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Redirection…
                    </>
                  ) : (
                    'Configurer Stripe'
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ----------------------------- */
/* UI COMPONENT                  */
/* ----------------------------- */

function StatusItem({
  icon: Icon,
  label,
  completed,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          completed ? 'bg-green-100' : 'bg-gray-100'
        }`}
      >
        {completed ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
          <Icon className="w-5 h-5 text-gray-400" />
        )}
      </div>
      <span className={completed ? 'text-gray-900 font-medium' : 'text-gray-500'}>
        {label}
      </span>
    </div>
  );
}

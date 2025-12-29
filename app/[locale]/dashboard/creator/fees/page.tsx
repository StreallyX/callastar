'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Info, Calculator, CreditCard, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default function FeesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [platformFee, setPlatformFee] = useState(15); // Default 15%

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

      // Get platform fee from settings
      try {
        const settingsResponse = await fetch('/api/admin/settings/platform-fee');
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          if (settingsData?.platformFeePercentage) {
            setPlatformFee(Number(settingsData.platformFeePercentage));
          }
        }
      } catch (error) {
        console.error('Error fetching platform fee:', error);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exampleAmount = 100;
  const platformFeeAmount = (exampleAmount * platformFee) / 100;
  const stripeFeeAmount = 2.9 + (exampleAmount * 0.30) / 100; // Stripe standard fees: 2.9% + 0.30
  const netAmount = exampleAmount - platformFeeAmount - stripeFeeAmount;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/creator">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Frais et commissions</h1>
          <p className="text-gray-600">Comprendre comment fonctionne la rémunération sur Call a Star</p>
        </div>

        {/* Platform Fee Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-purple-600" />
              Commission de la plateforme
            </CardTitle>
            <CardDescription>
              Call a Star prélève une commission de <strong>{platformFee}%</strong> sur chaque paiement reçu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Cette commission couvre les coûts de fonctionnement de la plateforme : hébergement, 
              maintenance, support client, fonctionnalités vidéo, et développement de nouvelles fonctionnalités.
            </p>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-purple-900">Commission actuelle</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{platformFee}%</p>
            </div>
          </CardContent>
        </Card>

        {/* Stripe Fees Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Frais de paiement (Stripe)
            </CardTitle>
            <CardDescription>
              Frais de traitement des paiements par carte bancaire
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Les paiements sont traités par Stripe, notre prestataire de paiement sécurisé. 
              Stripe prélève des frais standards pour chaque transaction.
            </p>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-blue-900">Frais Stripe</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">2.9% + 0.30 EUR</p>
              <p className="text-xs text-blue-700 mt-1">Par transaction (frais standard Stripe Europe)</p>
            </div>
          </CardContent>
        </Card>

        {/* Example Calculation Card */}
        <Card className="mb-6 border-2 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-green-600" />
              Exemple de calcul
            </CardTitle>
            <CardDescription>
              Pour un appel de {exampleAmount.toFixed(2)} EUR
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2">
                <span className="text-gray-700">Montant payé par l'utilisateur</span>
                <span className="font-semibold text-lg">{exampleAmount.toFixed(2)} EUR</span>
              </div>
              
              <div className="border-t pt-2">
                <div className="flex justify-between items-center text-sm text-red-600">
                  <span>- Commission plateforme ({platformFee}%)</span>
                  <span>-{platformFeeAmount.toFixed(2)} EUR</span>
                </div>
              </div>
              
              <div className="border-t pt-2">
                <div className="flex justify-between items-center text-sm text-red-600">
                  <span>- Frais Stripe (2.9% + 0.30)</span>
                  <span>-{stripeFeeAmount.toFixed(2)} EUR</span>
                </div>
              </div>
              
              <div className="border-t-2 border-green-600 pt-3 mt-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-green-700">Vous recevez</span>
                  <span className="font-bold text-2xl text-green-600">{netAmount.toFixed(2)} EUR</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Soit environ {((netAmount / exampleAmount) * 100).toFixed(1)}% du montant total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Notes Card */}
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-800 text-base">📋 Notes importantes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-yellow-700 space-y-2">
            <p>
              <strong>Montants affichés :</strong> Les montants affichés dans votre historique de paiements 
              correspondent au montant total payé par l'utilisateur (montant brut). Les frais sont automatiquement 
              déduits lors du transfert vers votre compte Stripe Connect.
            </p>
            <p>
              <strong>Transfert automatique :</strong> Les paiements sont transférés automatiquement vers votre 
              compte Stripe Connect après une période de sécurité de 7 jours. Cette période permet de gérer 
              d'éventuels litiges ou remboursements.
            </p>
            <p>
              <strong>Virements bancaires :</strong> Pour transférer les fonds de votre compte Stripe Connect 
              vers votre compte bancaire, consultez la page{' '}
              <Link href="/dashboard/creator/payouts" className="underline font-semibold">
                Payouts
              </Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

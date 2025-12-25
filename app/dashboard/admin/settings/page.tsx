'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, Settings as SettingsIcon, DollarSign, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState({
    platformFeePercentage: 10,
    minBookingPrice: 10,
    maxBookingPrice: 1000,
    payoutHoldingDays: 7,
  });

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
      
      if (userData?.user?.role !== 'ADMIN') {
        router.push('/dashboard/user');
        return;
      }
      
      setUser(userData?.user);

      // Get platform settings
      const settingsResponse = await fetch('/api/admin/settings');
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        if (settingsData?.settings) {
          setSettings({
            platformFeePercentage: parseFloat(settingsData.settings.platformFeePercentage || '10'),
            minBookingPrice: parseFloat(settingsData.settings.minBookingPrice || '10'),
            maxBookingPrice: parseFloat(settingsData.settings.maxBookingPrice || '1000'),
            payoutHoldingDays: parseInt(settingsData.settings.payoutHoldingDays || '7'),
          });
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Paramètres enregistrés avec succès');
      } else {
        const error = await response.json();
        toast.error(error?.error ?? 'Erreur lors de l\'enregistrement');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setSaving(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <SettingsIcon className="w-8 h-8" />
            Paramètres Admin
          </h1>
          <p className="text-gray-600">Configuration de la plateforme</p>
        </div>

        <Tabs defaultValue="platform" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="platform">Plateforme</TabsTrigger>
            <TabsTrigger value="payments">Paiements</TabsTrigger>
            <TabsTrigger value="security">Sécurité</TabsTrigger>
          </TabsList>

          {/* Platform Settings Tab */}
          <TabsContent value="platform" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres de la plateforme</CardTitle>
                <CardDescription>
                  Configuration générale de Call a Star
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="platformFee">Commission plateforme (%)</Label>
                  <Input
                    id="platformFee"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={settings.platformFeePercentage}
                    onChange={(e) => setSettings({ ...settings, platformFeePercentage: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-sm text-gray-500">
                    Pourcentage prélevé sur chaque transaction (actuellement {settings.platformFeePercentage}%)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minPrice">Prix minimum de réservation (€)</Label>
                  <Input
                    id="minPrice"
                    type="number"
                    min="1"
                    value={settings.minBookingPrice}
                    onChange={(e) => setSettings({ ...settings, minBookingPrice: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-sm text-gray-500">
                    Prix minimum qu'un créateur peut fixer pour un appel
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxPrice">Prix maximum de réservation (€)</Label>
                  <Input
                    id="maxPrice"
                    type="number"
                    min="1"
                    value={settings.maxBookingPrice}
                    onChange={(e) => setSettings({ ...settings, maxBookingPrice: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-sm text-gray-500">
                    Prix maximum qu'un créateur peut fixer pour un appel
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Settings Tab */}
          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Paramètres de paiement
                </CardTitle>
                <CardDescription>
                  Configuration des paiements et des transferts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="holdingDays">Période de sécurité (jours)</Label>
                  <Input
                    id="holdingDays"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.payoutHoldingDays}
                    onChange={(e) => setSettings({ ...settings, payoutHoldingDays: parseInt(e.target.value) || 7 })}
                  />
                  <p className="text-sm text-gray-500">
                    Nombre de jours pendant lesquels les paiements sont retenus avant d'être disponibles pour transfert (actuellement {settings.payoutHoldingDays} jours)
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">ℹ️ Information</h4>
                  <p className="text-sm text-blue-700">
                    La période de sécurité protège contre les litiges et les annulations. Une période plus longue offre plus de sécurité mais retarde les paiements aux créateurs.
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Stripe Configuration</h4>
                  <p className="text-sm text-yellow-700 mb-2">
                    Pour configurer les webhooks Stripe et la gestion des paiements :
                  </p>
                  <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                    <li>Accédez au <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Dashboard Stripe</a></li>
                    <li>Ajoutez l'endpoint webhook: <code className="bg-yellow-100 px-1 rounded">{process.env.NEXT_PUBLIC_APP_URL || 'https://votre-domaine.com'}/api/payments/webhook</code></li>
                    <li>Écoutez l'événement: <code className="bg-yellow-100 px-1 rounded">payment_intent.succeeded</code></li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Sécurité et accès
                </CardTitle>
                <CardDescription>
                  Paramètres de sécurité de la plateforme
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">✓ Fonctionnalités de sécurité actives</h4>
                  <ul className="text-sm text-green-700 space-y-2">
                    <li>• Authentification JWT sécurisée</li>
                    <li>• Hachage des mots de passe avec bcrypt</li>
                    <li>• Protection CSRF</li>
                    <li>• Validation des paiements par Stripe</li>
                    <li>• KYC/AML via Stripe Connect</li>
                    <li>• Période de sécurité de {settings.payoutHoldingDays} jours sur les paiements</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Compte administrateur</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium">{user?.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Nom:</span>
                      <span className="font-medium">{user?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Rôle:</span>
                      <span className="font-medium text-purple-600">ADMIN</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end gap-4 mt-6">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/admin')}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSaveSettings}
            disabled={saving}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Enregistrer les paramètres
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

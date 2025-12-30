'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner, DateDisplay } from '@/components/admin';
import { Save, Settings as SettingsIcon, DollarSign, Calendar, CreditCard, Info } from 'lucide-react';
import { toast } from 'sonner';

interface PlatformSettings {
  id: string;
  platformFeePercentage: number;
  platformFeeFixed: number | null;
  minimumPayoutAmount: number;
  holdingPeriodDays: number;
  payoutMode: 'AUTOMATIC' | 'MANUAL';
  payoutFrequencyOptions: string[];
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [formData, setFormData] = useState({
    platformFeePercentage: 10,
    platformFeeFixed: 0,
    minimumPayoutAmount: 50,
    holdingPeriodDays: 7,
    payoutMode: 'AUTOMATIC' as 'AUTOMATIC' | 'MANUAL',
    payoutFrequencyOptions: ['DAILY', 'WEEKLY', 'MONTHLY'],
    currency: 'EUR',
  });

  // Available frequency options
  const frequencyOptions = ['DAILY', 'WEEKLY', 'MONTHLY'];
  const currencyOptions = ['EUR', 'USD', 'GBP', 'CHF'];

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
        const data = await settingsResponse.json();
        if (data?.settings) {
          setSettings(data.settings);
          setFormData({
            platformFeePercentage: data.settings.platformFeePercentage || 10,
            platformFeeFixed: data.settings.platformFeeFixed || 0,
            minimumPayoutAmount: data.settings.minimumPayoutAmount || 50,
            holdingPeriodDays: data.settings.holdingPeriodDays || 7,
            payoutMode: data.settings.payoutMode || 'AUTOMATIC',
            payoutFrequencyOptions: data.settings.payoutFrequencyOptions || ['DAILY', 'WEEKLY', 'MONTHLY'],
            currency: data.settings.currency || 'EUR',
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformFeePercentage: formData.platformFeePercentage,
          platformFeeFixed: formData.platformFeeFixed > 0 ? formData.platformFeeFixed : null,
          minimumPayoutAmount: formData.minimumPayoutAmount,
          holdingPeriodDays: formData.holdingPeriodDays,
          payoutMode: formData.payoutMode,
          payoutFrequencyOptions: formData.payoutFrequencyOptions,
          currency: formData.currency,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Paramètres enregistrés avec succès');
        fetchData(); // Refresh data
      } else {
        toast.error(data?.error ?? 'Erreur lors de l\'enregistrement');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  const toggleFrequency = (frequency: string) => {
    const newFrequencies = formData.payoutFrequencyOptions.includes(frequency)
      ? formData.payoutFrequencyOptions.filter(f => f !== frequency)
      : [...formData.payoutFrequencyOptions, frequency];
    
    setFormData({ ...formData, payoutFrequencyOptions: newFrequencies });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <LoadingSpinner text="Chargement..." />
        </div>
      </div>
    );
  }

  const stripeMode = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.includes('test') ? 'test' : 'live';

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <SettingsIcon className="w-8 h-8" />
                Paramètres de la Plateforme
              </h1>
              <p className="text-gray-600">Configuration complète des paramètres financiers et opérationnels</p>
            </div>
            <Button variant="outline" onClick={() => router.push('/dashboard/admin')}>
              Retour au tableau de bord
            </Button>
          </div>

          {/* Stripe Mode & Last Updated */}
          <div className="flex items-center gap-4">
            <Badge className={stripeMode === 'test' ? 'bg-yellow-500' : 'bg-green-500'}>
              Mode Stripe: {stripeMode === 'test' ? 'Test' : 'Production'}
            </Badge>
            {settings?.updatedAt && (
              <span className="text-sm text-gray-500">
                Dernière mise à jour: <DateDisplay date={settings.updatedAt} format="datetime" />
              </span>
            )}
          </div>
        </div>

        {/* Settings Form */}
        <div className="space-y-6">
          {/* Fees Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Frais de la Plateforme
              </CardTitle>
              <CardDescription>
                Configurez les frais prélevés sur les transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="platformFeePercentage">
                    Pourcentage de frais (%)
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="platformFeePercentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.platformFeePercentage}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        platformFeePercentage: parseFloat(e.target.value) || 0 
                      })}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Pourcentage prélevé sur chaque transaction
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platformFeeFixed">
                    Frais fixes (optionnel)
                  </Label>
                  <div className="relative">
                    <Input
                      id="platformFeeFixed"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.platformFeeFixed}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        platformFeeFixed: parseFloat(e.target.value) || 0 
                      })}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                      {formData.currency}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Montant fixe ajouté aux frais (laissez 0 si non utilisé)
                  </p>
                </div>
              </div>

              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  Les frais totaux seront calculés comme: (Montant × {formData.platformFeePercentage}%) + {formData.platformFeeFixed} {formData.currency}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Payouts Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Paramètres de Paiement
              </CardTitle>
              <CardDescription>
                Configurez les paiements aux créateurs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minimumPayoutAmount">
                    Montant minimum de paiement
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="minimumPayoutAmount"
                      type="number"
                      min="1"
                      step="0.01"
                      value={formData.minimumPayoutAmount}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        minimumPayoutAmount: parseFloat(e.target.value) || 0 
                      })}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                      {formData.currency}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Montant minimum requis pour déclencher un paiement
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="holdingPeriodDays">
                    Période de rétention (jours)
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="holdingPeriodDays"
                    type="number"
                    min="0"
                    max="30"
                    value={formData.holdingPeriodDays}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      holdingPeriodDays: parseInt(e.target.value) || 0 
                    })}
                  />
                  <p className="text-sm text-gray-500">
                    Nombre de jours avant que les fonds ne soient disponibles
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payoutMode">
                    Mode de paiement
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Select
                    value={formData.payoutMode}
                    onValueChange={(value: 'AUTOMATIC' | 'MANUAL') => 
                      setFormData({ ...formData, payoutMode: value })
                    }
                  >
                    <SelectTrigger id="payoutMode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTOMATIC">Automatique</SelectItem>
                      <SelectItem value="MANUAL">Manuel</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    Automatique: paiements déclenchés par cron. Manuel: admin doit approuver
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">
                    Devise
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => 
                      setFormData({ ...formData, currency: value })
                    }
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map(curr => (
                        <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    Devise utilisée pour toutes les transactions
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Fréquences de paiement disponibles
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {frequencyOptions.map(freq => (
                    <Badge
                      key={freq}
                      variant={formData.payoutFrequencyOptions.includes(freq) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleFrequency(freq)}
                    >
                      {freq === 'DAILY' ? 'Quotidien' : freq === 'WEEKLY' ? 'Hebdomadaire' : 'Mensuel'}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-gray-500">
                  Les créateurs pourront choisir parmi ces options
                </p>
              </div>

              <Alert>
                <Calendar className="w-4 h-4" />
                <AlertDescription>
                  Les paiements automatiques sont traités par le cron job à intervalles réguliers selon la fréquence choisie par chaque créateur.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* General Section */}
          <Card>
            <CardHeader>
              <CardTitle>Informations Générales</CardTitle>
              <CardDescription>
                Informations sur l'environnement et la configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">Mode Stripe</p>
                  <Badge className={stripeMode === 'test' ? 'bg-yellow-500' : 'bg-green-500'}>
                    {stripeMode === 'test' ? 'Test' : 'Production'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">Administrateur</p>
                  <p className="text-sm">{user?.name} ({user?.email})</p>
                </div>
              </div>

              {settings && (
                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-600">Créé le</p>
                    <p className="text-sm">
                      <DateDisplay date={settings.createdAt} format="datetime" />
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-600">Dernière modification</p>
                    <p className="text-sm">
                      <DateDisplay date={settings.updatedAt} format="datetime" />
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-4 mt-6 pb-8">
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
                <LoadingSpinner size="sm" className="mr-2" />
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

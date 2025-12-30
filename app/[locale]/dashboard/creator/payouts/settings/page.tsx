'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Settings, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/navigation';
import { getCurrencySymbol } from '@/lib/currency-converter';

interface PayoutSettings {
  payoutSchedule: 'DAILY' | 'WEEKLY' | 'MANUAL';
  payoutMinimum: number;
  currency?: string; // ✅ Creator's currency
  syncStatus?: 'synced' | 'out_of_sync' | 'no_stripe_account';
  stripeSettings?: {
    schedule: 'DAILY' | 'WEEKLY' | 'MANUAL';
  } | null;
  hasStripeAccount?: boolean;
}

export default function PayoutSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PayoutSettings>({
    payoutSchedule: 'MANUAL',
    payoutMinimum: 10,
  });
  const [originalSettings, setOriginalSettings] = useState<PayoutSettings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/creators/payout-settings');
      if (response.ok) {
        const data = await response.json();
        const fetchedSettings = {
          payoutSchedule: data.payoutSchedule || 'MANUAL',
          payoutMinimum: data.payoutMinimum || 10,
          currency: data.currency || 'EUR', // ✅ Include creator's currency
          // ✅ FIX: Capture sync status and Stripe settings
          syncStatus: data.syncStatus || 'no_stripe_account',
          stripeSettings: data.stripeSettings,
          hasStripeAccount: data.hasStripeAccount,
        };
        setSettings(fetchedSettings);
        setOriginalSettings(fetchedSettings);

        // Show warning if out of sync
        if (data.syncStatus === 'out_of_sync') {
          toast.warning('Les paramètres ne sont pas synchronisés avec Stripe');
        }
      } else if (response.status === 401) {
        router.push('/auth/login');
      } else {
        toast.error('Erreur lors de la récupération des paramètres');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const currency = settings.currency || 'EUR';
    
    // Validation
    if (settings.payoutMinimum < 10) {
      toast.error(`Le montant minimum doit être au moins 10 ${currency}`);
      return;
    }

    if (settings.payoutMinimum > 1000000) {
      toast.error(`Le montant minimum ne peut pas dépasser 1 000 000 ${currency}`);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/creators/payout-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payoutSchedule: settings.payoutSchedule,
          payoutMinimum: settings.payoutMinimum,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Paramètres enregistrés avec succès');
        setOriginalSettings(settings);
        
        // Optionally redirect back to payouts page after a short delay
        setTimeout(() => {
          router.push('/dashboard/creator/payouts');
        }, 1500);
      } else {
        const error = await response.json();
        toast.error(error?.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = originalSettings && (
    settings.payoutSchedule !== originalSettings.payoutSchedule ||
    settings.payoutMinimum !== originalSettings.payoutMinimum
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-3xl px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-3xl px-4 py-8">
        {/* Back Button */}
        <Link href="/dashboard/creator/payouts">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux paiements
          </Button>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Paramètres de virement</h1>
          <p className="text-gray-600">
            Configurez la fréquence et le montant minimum de vos virements
          </p>
        </div>

        {/* Settings Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              Modifiez vos préférences de virement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              {/* Schedule Selection */}
              <div className="space-y-2">
                <Label htmlFor="schedule">Calendrier de virement</Label>
                <Select
                  value={settings.payoutSchedule}
                  onValueChange={(value) => setSettings({ ...settings, payoutSchedule: value as any })}
                >
                  <SelectTrigger id="schedule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Quotidien</SelectItem>
                    <SelectItem value="WEEKLY">Hebdomadaire</SelectItem>
                    <SelectItem value="MANUAL">Manuel</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">
                  {settings.payoutSchedule === 'DAILY' && 
                    'Virement automatique chaque jour si le solde disponible atteint le minimum'}
                  {settings.payoutSchedule === 'WEEKLY' && 
                    'Virement automatique chaque lundi si le solde disponible atteint le minimum'}
                  {settings.payoutSchedule === 'MANUAL' && 
                    'Vous devez demander manuellement chaque virement (sujet à approbation admin)'}
                </p>
              </div>

              {/* Minimum Amount */}
              <div className="space-y-2">
                <Label htmlFor="minimum">Montant minimum ({settings.currency || 'EUR'})</Label>
                <Input
                  id="minimum"
                  type="number"
                  min="10"
                  max="1000000"
                  step="0.01"
                  value={settings.payoutMinimum}
                  onChange={(e) => setSettings({ ...settings, payoutMinimum: parseFloat(e.target.value) || 10 })}
                  required
                />
                <p className="text-sm text-gray-500">
                  Montant minimum requis pour déclencher un virement (entre 10 {settings.currency || 'EUR'} et 1 000 000 {settings.currency || 'EUR'})
                </p>
              </div>

              {/* Info Alert */}
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700 text-sm">
                  <strong>Important :</strong> Les virements automatiques (quotidiens/hebdomadaires) 
                  sont traités automatiquement par le système. Les virements manuels nécessitent 
                  une approbation de l'administrateur.
                </AlertDescription>
              </Alert>

              {/* ✅ FIX: Sync Status Indicator */}
              {settings.hasStripeAccount && (
                <Alert className={
                  settings.syncStatus === 'synced' ? 'bg-green-50 border-green-200' :
                  settings.syncStatus === 'out_of_sync' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-gray-50 border-gray-200'
                }>
                  {settings.syncStatus === 'synced' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                  <AlertDescription className={
                    settings.syncStatus === 'synced' ? 'text-green-700' : 'text-yellow-700'
                  }>
                    {settings.syncStatus === 'synced' ? (
                      <span>✅ <strong>Synchronisé avec Stripe</strong> - Vos paramètres sont à jour sur Stripe</span>
                    ) : settings.syncStatus === 'out_of_sync' ? (
                      <div>
                        <span>⚠️ <strong>Désynchronisé</strong> - Les paramètres diffèrent entre la base de données et Stripe</span>
                        {settings.stripeSettings && (
                          <div className="mt-2 text-sm">
                            <strong>Base de données:</strong> {settings.payoutSchedule}<br />
                            <strong>Stripe:</strong> {settings.stripeSettings.schedule}
                          </div>
                        )}
                        <p className="mt-2 text-sm">
                          Enregistrez vos paramètres pour synchroniser avec Stripe.
                        </p>
                      </div>
                    ) : (
                      <span>ℹ️ Aucun compte Stripe connecté</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={saving || !hasChanges}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Enregistrer les modifications
                    </>
                  )}
                </Button>
                <Link href="/dashboard/creator/payouts">
                  <Button type="button" variant="outline">
                    Annuler
                  </Button>
                </Link>
              </div>

              {!hasChanges && originalSettings && (
                <p className="text-sm text-gray-500 text-center">
                  Aucune modification à enregistrer
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="mt-6 bg-gray-50 border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">Explications des calendriers</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-3">
            <div>
              <strong className="text-gray-900">Quotidien :</strong>
              <p className="mt-1">
                Le système vérifie chaque jour si votre solde disponible atteint le montant minimum. 
                Si oui, un virement automatique est créé vers votre compte Stripe.
              </p>
            </div>
            <div>
              <strong className="text-gray-900">Hebdomadaire :</strong>
              <p className="mt-1">
                Le système vérifie chaque lundi si votre solde disponible atteint le montant minimum. 
                Si oui, un virement automatique est créé vers votre compte Stripe.
              </p>
            </div>
            <div>
              <strong className="text-gray-900">Manuel :</strong>
              <p className="mt-1">
                Vous devez manuellement demander un virement depuis la page des paiements. 
                Chaque demande doit être approuvée par un administrateur avant d'être traitée.
                Cela vous donne un contrôle total sur le calendrier de vos virements.
              </p>
            </div>
            <div className="pt-2 border-t border-gray-300 mt-2">
              <p>
                <strong className="text-gray-900">Conseil :</strong> Si vous préférez avoir un flux de trésorerie 
                régulier, choisissez "Quotidien" ou "Hebdomadaire". Si vous préférez contrôler 
                manuellement vos virements, choisissez "Manuel".
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

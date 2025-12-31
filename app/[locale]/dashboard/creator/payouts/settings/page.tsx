'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
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
  const locale = useLocale();
  const t = useTranslations('dashboard.creator.payouts.settings');
  const tToast = useTranslations('toast');
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
          toast.warning(tToast('warning.settingsNotSynced'));
        }
      } else if (response.status === 401) {
        router.push('/auth/login');
      } else {
        toast.error(tToast('error.errorFetchingSettings'));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error(tToast('error.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const currency = settings.currency || 'EUR';
    
    // Validation
    if (settings.payoutMinimum < 10) {
      toast.error(tToast('error.minAmountError', { currency }));
      return;
    }

    if (settings.payoutMinimum > 1000000) {
      toast.error(tToast('error.maxAmountError', { currency }));
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
        toast.success(tToast('success.settingsSaved'));
        setOriginalSettings(settings);
        
        // Optionally redirect back to payouts page after a short delay
        setTimeout(() => {
          router.push('/dashboard/creator/payouts');
        }, 1500);
      } else {
        const error = await response.json();
        toast.error(error?.error || tToast('error.savingError'));
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(tToast('error.errorOccurred'));
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
            {t('backToPayouts')}
          </Button>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-gray-600">
            {t('subtitle')}
          </p>
        </div>

        {/* Settings Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {t('configuration')}
            </CardTitle>
            <CardDescription>
              {t('configurationDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              {/* Schedule Selection */}
              <div className="space-y-2">
                <Label htmlFor="schedule">{t('payoutSchedule')}</Label>
                <Select
                  value={settings.payoutSchedule}
                  onValueChange={(value) => setSettings({ ...settings, payoutSchedule: value as any })}
                >
                  <SelectTrigger id="schedule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">{t('scheduleDaily')}</SelectItem>
                    <SelectItem value="WEEKLY">{t('scheduleWeekly')}</SelectItem>
                    <SelectItem value="MANUAL">{t('scheduleManual')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">
                  {settings.payoutSchedule === 'DAILY' && t('scheduleDailyDesc')}
                  {settings.payoutSchedule === 'WEEKLY' && t('scheduleWeeklyDesc')}
                  {settings.payoutSchedule === 'MANUAL' && t('scheduleManualDesc')}
                </p>
              </div>

              {/* Minimum Amount */}
              <div className="space-y-2">
                <Label htmlFor="minimum">{t('minimumAmount', { currency: settings.currency || 'EUR' })}</Label>
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
                  {t('minimumAmountDesc', { currency: settings.currency || 'EUR' })}
                </p>
              </div>

              {/* Info Alert */}
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700 text-sm">
                  <strong>{t('important')}:</strong> {t('importantNote')}
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
                      <span>✅ <strong>{t('syncedWithStripe')}</strong></span>
                    ) : settings.syncStatus === 'out_of_sync' ? (
                      <div>
                        <span>⚠️ <strong>{t('outOfSync')}</strong></span>
                        {settings.stripeSettings && (
                          <div className="mt-2 text-sm">
                            <strong>{t('database')}:</strong> {settings.payoutSchedule}<br />
                            <strong>{t('stripe')}:</strong> {settings.stripeSettings.schedule}
                          </div>
                        )}
                        <p className="mt-2 text-sm">
                          {t('saveToSync')}
                        </p>
                      </div>
                    ) : (
                      <span>ℹ️ {t('noStripeAccount')}</span>
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
                      {t('saving')}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {t('saveChanges')}
                    </>
                  )}
                </Button>
                <Link href="/dashboard/creator/payouts">
                  <Button type="button" variant="outline">
                    {t('cancel')}
                  </Button>
                </Link>
              </div>

              {!hasChanges && originalSettings && (
                <p className="text-sm text-gray-500 text-center">
                  {t('noChanges')}
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="mt-6 bg-gray-50 border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">{t('schedulesExplanation')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-3">
            <div>
              <strong className="text-gray-900">{t('dailyTitle')}:</strong>
              <p className="mt-1">
                {t('dailyDesc')}
              </p>
            </div>
            <div>
              <strong className="text-gray-900">{t('weeklyTitle')}:</strong>
              <p className="mt-1">
                {t('weeklyDesc')}
              </p>
            </div>
            <div>
              <strong className="text-gray-900">{t('manualTitle')}:</strong>
              <p className="mt-1">
                {t('manualDesc')}
              </p>
            </div>
            <div className="pt-2 border-t border-gray-300 mt-2">
              <p>
                <strong className="text-gray-900">{t('tip')}:</strong> {t('tipDesc')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

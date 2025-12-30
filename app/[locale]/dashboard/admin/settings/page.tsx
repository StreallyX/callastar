'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { useTranslations, useLocale } from 'next-intl';
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
  const locale = useLocale();
  const t = useTranslations('dashboard.admin.settings');
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
      toast.error(t('errors.loadingData'));
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
        toast.success(t('successMessage'));
        fetchData(); // Refresh data
      } else {
        toast.error(data?.error ?? t('errors.savingSettings'));
      }
    } catch (error) {
      toast.error(t('errors.genericError'));
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
          <LoadingSpinner text={t('loading')} />
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
                {t('title')}
              </h1>
              <p className="text-gray-600">{t('subtitle')}</p>
            </div>
            <Button variant="outline" onClick={() => router.push('/dashboard/admin')}>
              {t('backToDashboard')}
            </Button>
          </div>

          {/* Stripe Mode & Last Updated */}
          <div className="flex items-center gap-4">
            <Badge className={stripeMode === 'test' ? 'bg-yellow-500' : 'bg-green-500'}>
              {t('stripeMode')}: {stripeMode === 'test' ? t('stripeModeTest') : t('stripeModeProduction')}
            </Badge>
            {settings?.updatedAt && (
              <span className="text-sm text-gray-500">
                {t('lastUpdate')}: <DateDisplay date={settings.updatedAt} format="datetime" locale={locale} />
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
                {t('feesSection.title')}
              </CardTitle>
              <CardDescription>
                {t('feesSection.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="platformFeePercentage">
                    {t('feesSection.feePercentage')}
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
                    {t('feesSection.feePercentageHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platformFeeFixed">
                    {t('feesSection.feeFixed')}
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
                    {t('feesSection.feeFixedHelp')}
                  </p>
                </div>
              </div>

              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  {t('feesSection.calculationFormula', { 
                    percentage: formData.platformFeePercentage, 
                    fixed: formData.platformFeeFixed, 
                    currency: formData.currency 
                  })}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Payouts Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                {t('payoutSection.title')}
              </CardTitle>
              <CardDescription>
                {t('payoutSection.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minimumPayoutAmount">
                    {t('payoutSection.minimumAmount')}
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
                    {t('payoutSection.minimumAmountHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="holdingPeriodDays">
                    {t('payoutSection.holdingPeriod')}
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
                    {t('payoutSection.holdingPeriodHelp')}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payoutMode">
                    {t('payoutSection.payoutMode')}
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
                      <SelectItem value="AUTOMATIC">{t('payoutSection.modeAutomatic')}</SelectItem>
                      <SelectItem value="MANUAL">{t('payoutSection.modeManual')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    {t('payoutSection.payoutModeHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">
                    {t('payoutSection.currency')}
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
                    {t('payoutSection.currencyHelp')}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  {t('payoutSection.frequencies')}
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
                      {freq === 'DAILY' ? t('payoutSection.frequencyDaily') : freq === 'WEEKLY' ? t('payoutSection.frequencyWeekly') : t('payoutSection.frequencyMonthly')}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-gray-500">
                  {t('payoutSection.frequenciesHelp')}
                </p>
              </div>

              <Alert>
                <Calendar className="w-4 h-4" />
                <AlertDescription>
                  {t('payoutSection.cronInfo')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* General Section */}
          <Card>
            <CardHeader>
              <CardTitle>{t('generalSection.title')}</CardTitle>
              <CardDescription>
                {t('generalSection.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">{t('stripeMode')}</p>
                  <Badge className={stripeMode === 'test' ? 'bg-yellow-500' : 'bg-green-500'}>
                    {stripeMode === 'test' ? t('stripeModeTest') : t('stripeModeProduction')}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">{t('generalSection.administrator')}</p>
                  <p className="text-sm">{user?.name} ({user?.email})</p>
                </div>
              </div>

              {settings && (
                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-600">{t('generalSection.createdAt')}</p>
                    <p className="text-sm">
                      <DateDisplay date={settings.createdAt} format="datetime" locale={locale} />
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-600">{t('generalSection.lastModified')}</p>
                    <p className="text-sm">
                      <DateDisplay date={settings.updatedAt} format="datetime" locale={locale} />
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
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSaveSettings}
            disabled={saving}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                {t('saving')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {t('save')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

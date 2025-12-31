'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { Navbar } from '@/components/navbar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowLeft, Save, Globe, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/navigation';
import {
  getCommonTimezones,
  detectUserTimezone,
  getTimezoneAbbreviation,
} from '@/lib/timezone';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';

export default function UserSettingsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard.user.settings');

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [detectedTimezone, setDetectedTimezone] = useState('');

  const timezones = getCommonTimezones();

  useEffect(() => {
    fetchUserData();
    const detected = detectUserTimezone();
    setDetectedTimezone(detected);
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (!response.ok) {
        router.push('/auth/login');
        return;
      }

      const data = await response.json();
      const userData = data?.user;

      setUser(userData);
      setName(userData?.name || '');
      setEmail(userData?.email || '');
      setTimezone(userData?.timezone || 'Europe/Paris');
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error(t('errors.load'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const response = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name,
          timezone,
        }),
      });

      if (!response.ok) {
        throw new Error();
      }

      toast.success(t('saveSuccess'));
      await fetchUserData();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t('errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const handleAutoDetect = () => {
    const detected = detectUserTimezone();
    setTimezone(detected);
    toast.success(
      t('timezone.detectedToast', { timezone: detected })
    );
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
        <div className="mb-6">
          <Link href="/dashboard/user">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('backToDashboard')}
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        <div className="space-y-6">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.profile')}</CardTitle>
              <CardDescription>{t('sections.profileDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('fields.name')}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('yourName')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('fields.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500">
                  {t('emailReadonly')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Timezone */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                {t('sections.timezone')}
              </CardTitle>
              <CardDescription>
                {t('sections.timezoneDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">
                    {t('timezone.detectedTitle')}
                  </p>
                  <p className="text-blue-700">
                    {detectedTimezone} (
                    {getTimezoneAbbreviation(detectedTimezone)})
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">
                  {t('timezone.current')}
                </Label>
                <div className="flex gap-2">
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="flex-1">
                      <SelectValue
                        placeholder={t('timezone.select')}
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAutoDetect}
                    variant="outline"
                    type="button"
                  >
                    {t('timezone.autoDetect')}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  {t('timezone.hint')}
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-900">
                  <strong>{t('timezone.preview')}:</strong>{' '}
                  {new Date().toLocaleTimeString(locale, {
                    timeZone: timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  ({getTimezoneAbbreviation(timezone)})
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {t('saveChanges')}
                </>
              )}
            </Button>

            <Button
              onClick={() => router.push('/dashboard/user')}
              variant="outline"
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, Save, Globe, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/navigation';
import { getCommonTimezones, detectUserTimezone, getTimezoneAbbreviation } from '@/lib/timezone';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';

export default function UserSettingsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard.user.settings');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [detectedTimezone, setDetectedTimezone] = useState('');

  const timezones = getCommonTimezones();

  useEffect(() => {
    fetchUserData();
    
    // Auto-detect timezone
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
      toast.error('Erreur lors du chargement des données');
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
        throw new Error('Erreur lors de la sauvegarde');
      }
      
      toast.success('Paramètres sauvegardés avec succès !');
      
      // Refresh user data
      await fetchUserData();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erreur lors de la sauvegarde des paramètres');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoDetect = () => {
    const detected = detectUserTimezone();
    setTimezone(detected);
    toast.success(`Fuseau horaire détecté : ${detected}`);
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
              Retour au dashboard
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        <div className="space-y-6">
          {/* Informations de base */}
          <Card>
            <CardHeader>
              <CardTitle>Informations de base</CardTitle>
              <CardDescription>Vos informations personnelles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('yourName')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500">
                  L'email ne peut pas être modifié. Contactez le support si nécessaire.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Fuseau horaire */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Fuseau horaire
              </CardTitle>
              <CardDescription>
                Configurez votre fuseau horaire pour afficher correctement les horaires des appels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">
                    Fuseau horaire détecté automatiquement
                  </p>
                  <p className="text-blue-700">
                    {detectedTimezone} ({getTimezoneAbbreviation(detectedTimezone)})
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Fuseau horaire actuel</Label>
                <div className="flex gap-2">
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Sélectionner un fuseau horaire" />
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
                    Auto-détecter
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Tous les horaires seront affichés dans ce fuseau horaire
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-900">
                  <strong>Aperçu :</strong> Il est actuellement{' '}
                  {new Date().toLocaleTimeString(locale, {
                    timeZone: timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  ({getTimezoneAbbreviation(timezone)}) dans votre fuseau horaire
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
                  Saving...
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
              Annuler
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

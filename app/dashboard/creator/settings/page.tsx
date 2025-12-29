'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, User, DollarSign, ExternalLink, Bell, CheckCircle, XCircle, Globe, Clock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCommonTimezones, detectUserTimezone, getTimezoneAbbreviation } from '@/lib/timezone';

export default function CreatorSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);
  const [stripeOnboarding, setStripeOnboarding] = useState({
    onboarded: false,
    loading: true,
  });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    expertise: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [detectedTimezone, setDetectedTimezone] = useState('');
  const [notifications, setNotifications] = useState({
    email: true,
    newBooking: true,
    payoutAvailable: true,
    callReminder: true,
  });

  const timezones = getCommonTimezones();

  useEffect(() => {
    fetchData();
    
    // Auto-detect timezone
    const detected = detectUserTimezone();
    setDetectedTimezone(detected);
    
    // ✅ FIX: Check if returning from Stripe onboarding
    const params = new URLSearchParams(window.location.search);
    const onboardingParam = params.get('onboarding');
    
    if (onboardingParam === 'success' || onboardingParam === 'refresh') {
      console.log('[Settings] Returned from onboarding, re-verifying...');
      
      if (onboardingParam === 'success') {
        toast.info('Vérification de votre configuration Stripe en cours...');
      }
      
      // Re-verify after delay
      setTimeout(() => {
        fetchData();
        window.history.replaceState({}, '', window.location.pathname);
      }, 2000);
    }
  }, []);

  const fetchData = async () => {
    try {
      const userResponse = await fetch('/api/auth/me');
      if (!userResponse.ok) {
        router.push('/auth/login');
        return;
      }
      const userData = await userResponse.json();
      
      if (userData?.user?.role !== 'CREATOR') {
        router.push('/dashboard/user');
        return;
      }
      
      setUser(userData?.user);
      setCreator(userData?.user?.creator);
      setFormData({
        name: userData?.user?.name || '',
        email: userData?.user?.email || '',
        bio: userData?.user?.creator?.bio || '',
        expertise: userData?.user?.creator?.expertise || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimezone(userData?.user?.creator?.timezone || userData?.user?.timezone || 'Europe/Paris');

      // Check Stripe Connect onboarding status
      const onboardingResponse = await fetch('/api/stripe/connect-onboard');
      if (onboardingResponse.ok) {
        const onboardingData = await onboardingResponse.json();
        setStripeOnboarding({
          onboarded: onboardingData?.onboarded ?? false,
          loading: false,
        });
      } else {
        setStripeOnboarding({ onboarded: false, loading: false });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Update user info (including timezone)
      const userResponse = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          timezone: timezone,
        }),
      });

      // Update creator profile
      const creatorResponse = await fetch('/api/creators/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: formData.bio,
          expertise: formData.expertise,
          timezone: timezone,
        }),
      });

      if (userResponse.ok && creatorResponse.ok) {
        toast.success('Profil mis à jour avec succès');
        fetchData();
      } else {
        toast.error('Erreur lors de la mise à jour du profil');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };
  
  const handleAutoDetect = () => {
    const detected = detectUserTimezone();
    setTimezone(detected);
    toast.success(`Fuseau horaire détecté : ${detected}`);
  };

  const handleChangePassword = async () => {
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.newPassword.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      if (response.ok) {
        toast.success('Mot de passe modifié avec succès');
        setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const error = await response.json();
        toast.error(error?.error ?? 'Erreur lors du changement de mot de passe');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  const handleStartStripeOnboarding = async () => {
    const toastId = toast('Redirection vers Stripe...', { duration: Infinity });
    
    try {
      const response = await fetch('/api/stripe/connect-onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        toast.dismiss(toastId);
        window.location.href = data.url;
      } else {
        const error = await response.json();
        toast.dismiss(toastId);
        toast.error(error?.error ?? 'Erreur lors de la création du lien d\'onboarding');
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error('Une erreur est survenue');
      console.error('Stripe onboarding error:', error);
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
            <User className="w-8 h-8" />
            Paramètres Créateur
          </h1>
          <p className="text-gray-600">Gérez votre profil et vos préférences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="payments">Paiements</TabsTrigger>
            <TabsTrigger value="security">Sécurité</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informations personnelles</CardTitle>
                <CardDescription>
                  Ces informations seront visibles sur votre profil public
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    rows={4}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Parlez un peu de vous..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expertise">Domaine d'expertise</Label>
                  <Input
                    id="expertise"
                    value={formData.expertise}
                    onChange={(e) => setFormData({ ...formData, expertise: e.target.value })}
                    placeholder="ex: Musique, Comédie, Sport..."
                  />
                </div>
              </CardContent>
            </Card>

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
                    {new Date().toLocaleTimeString('fr-FR', {
                      timeZone: timezone,
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    ({getTimezoneAbbreviation(timezone)}) dans votre fuseau horaire
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveProfile}
                disabled={saving}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />Enregistrer</>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Configuration Stripe Connect
                </CardTitle>
                <CardDescription>
                  Gérez vos paiements et vos transferts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Stripe Status */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-semibold mb-1">Statut Stripe Connect</h4>
                    <p className="text-sm text-gray-500">
                      {stripeOnboarding.onboarded 
                        ? 'Votre compte est configuré et prêt à recevoir des paiements'
                        : 'Configuration requise pour recevoir des paiements'}
                    </p>
                  </div>
                  {stripeOnboarding.onboarded ? (
                    <Badge className="bg-green-500">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Configuré
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                      <XCircle className="w-4 h-4 mr-1" />
                      Non configuré
                    </Badge>
                  )}
                </div>

                {/* Onboarding Button */}
                {!stripeOnboarding.onboarded && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Configuration nécessaire</h4>
                    <p className="text-sm text-yellow-700 mb-4">
                      Pour recevoir vos paiements, vous devez compléter la configuration de votre compte Stripe Connect. Ce processus est sécurisé et prend environ 5 minutes.
                    </p>
                    <Button
                      onClick={handleStartStripeOnboarding}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      Configurer Stripe Connect
                    </Button>
                  </div>
                )}

                {/* Stripe Connect Express Dashboard Link */}
                {stripeOnboarding.onboarded && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">📊 Gérer votre compte Stripe</h4>
                    <p className="text-sm text-blue-700 mb-4">
                      Accédez à votre espace Stripe Connect pour gérer vos paiements, vos transferts et vos informations bancaires (IBAN).
                    </p>
                    <Button
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/stripe/express-dashboard', {
                            method: 'POST',
                          });
                          if (response.ok) {
                            const data = await response.json();
                            window.open(data.url, '_blank');
                          } else {
                            toast.error('Erreur lors de l\'ouverture du tableau de bord');
                          }
                        } catch (error) {
                          toast.error('Une erreur est survenue');
                        }
                      }}
                      variant="outline"
                      className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      Ouvrir Stripe Connect
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}

                {/* Info about bank account */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Comment ajouter mon compte bancaire ?</h4>
                  <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                    <li>Cliquez sur le bouton <strong>"Ouvrir Stripe Connect"</strong> ci-dessus</li>
                    <li>Connectez-vous à votre espace Stripe Connect</li>
                    <li>Ajoutez votre IBAN et les informations de votre banque dans la section dédiée</li>
                    <li>Vos virements seront automatiquement envoyés selon votre configuration</li>
                  </ol>
                  <p className="text-sm text-gray-500 mt-3">
                    ℹ️ Important : N'utilisez jamais le Dashboard Stripe classique, utilisez toujours le lien Stripe Connect fourni ci-dessus.
                  </p>
                </div>

                {/* Payout info */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">💵 Comment fonctionnent les paiements ?</h4>
                  <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                    <li><strong>Période de sécurité:</strong> Les paiements sont retenus pendant 7 jours pour protéger contre les litiges</li>
                    <li><strong>Commission:</strong> La plateforme prélève une commission de 10% sur chaque réservation</li>
                    <li><strong>Demande de paiement:</strong> Après 7 jours, vous pouvez demander le transfert dans l'onglet "Revenus" de votre dashboard</li>
                    <li><strong>Réception:</strong> Les fonds sont transférés sur votre compte Stripe, puis vers votre banque selon votre configuration</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Changer le mot de passe</CardTitle>
                <CardDescription>
                  Assurez-vous d'utiliser un mot de passe fort et unique
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleChangePassword}
                    disabled={saving || !formData.currentPassword || !formData.newPassword}
                    className="bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Modification...</>
                    ) : (
                      <>Changer le mot de passe</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Préférences de notification
                </CardTitle>
                <CardDescription>
                  Choisissez comment vous souhaitez être notifié
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notifications par email</Label>
                    <p className="text-sm text-gray-500">Recevoir des emails de notification</p>
                  </div>
                  <Switch
                    checked={notifications.email}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Nouvelle réservation</Label>
                    <p className="text-sm text-gray-500">Notification lorsqu'un fan réserve un appel</p>
                  </div>
                  <Switch
                    checked={notifications.newBooking}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, newBooking: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Paiements disponibles</Label>
                    <p className="text-sm text-gray-500">Notification lorsque des fonds sont prêts pour transfert</p>
                  </div>
                  <Switch
                    checked={notifications.payoutAvailable}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, payoutAvailable: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Rappels d'appel</Label>
                    <p className="text-sm text-gray-500">Recevoir un rappel avant vos appels programmés</p>
                  </div>
                  <Switch
                    checked={notifications.callReminder}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, callReminder: checked })}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => toast.success('Préférences enregistrées')}
                    className="bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Enregistrer les préférences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

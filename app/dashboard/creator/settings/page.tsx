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
import { Loader2, Save, User, DollarSign, ExternalLink, Bell, CheckCircle, XCircle, Globe, Clock, Upload, ImageIcon, AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCommonTimezones, detectUserTimezone, getTimezoneAbbreviation } from '@/lib/timezone';

// Image Upload Component
interface ImageUploadProps {
  label: string;
  description: string;
  imageUrl: string;
  onUrlChange: (url: string) => void;
  imageType: 'profile' | 'banner';
  previewClassName?: string;
}

function ImageUpload({ label, description, imageUrl, onUrlChange, imageType, previewClassName }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(imageUrl);
  const [imageError, setImageError] = useState(false);

  // Update preview when imageUrl changes
  useEffect(() => {
    setPreviewUrl(imageUrl);
    setImageError(false);
  }, [imageUrl]);

  // Update preview when input changes
  useEffect(() => {
    if (imageUrl && imageUrl !== previewUrl) {
      setPreviewUrl(imageUrl);
      setImageError(false);
    }
  }, [imageUrl]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Format non accepté. Utilisez JPG, PNG ou WEBP');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Fichier trop volumineux. Maximum 5MB');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('imageType', imageType);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de l\'upload');
      }

      const data = await response.json();
      
      // Update URL input and preview
      onUrlChange(data.url);
      setPreviewUrl(data.url);
      setImageError(false);
      
      toast.success('Image uploadée avec succès');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleUrlChange = (url: string) => {
    onUrlChange(url);
    setPreviewUrl(url);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>
        <p className="text-sm text-gray-500">{description}</p>
      </div>

      {/* URL Input and Upload Button */}
      <div className="flex gap-2">
        <Input
          placeholder="https://i.ytimg.com/vi/SqJZD0OdT1g/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLBXH_0noVUYopA5FSlfQFjMxj-fbQ"
          value={imageUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          className="flex-1"
        />
        <div className="relative">
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileUpload}
            className="hidden"
            id={`upload-${imageType}`}
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById(`upload-${imageType}`)?.click()}
            disabled={uploading}
            className="whitespace-nowrap"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Upload...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload image
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Preview */}
      {previewUrl && (
        <div className="mt-3">
          <Label className="text-xs text-gray-500 mb-2 block">Preview:</Label>
          {!imageError ? (
            <div className={previewClassName || 'relative w-full h-32 border rounded-lg overflow-hidden bg-gray-50'}>
              <img
                src={previewUrl}
                alt={label}
                className="w-full h-full object-cover"
                onError={handleImageError}
              />
            </div>
          ) : (
            <div className="relative w-full h-32 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Impossible de charger l'image</p>
                <p className="text-xs">Vérifiez l'URL</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!previewUrl && (
        <div className="mt-3">
          <div className="relative w-full h-32 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <ImageIcon className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Aucune image</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Formats acceptés: JPG, PNG, WEBP (max 5MB)
      </p>
    </div>
  );
}

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
    profileImage: '',
    bannerImage: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileData, setProfileData] = useState({
    profileImage: '',
    bannerImage: '',
    bio: '',
    socialLinks: {
      instagram: '',
      tiktok: '',
      twitter: '',
      youtube: '',
      other: '',
    },
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
      
      // ✅ FIX: Always sync formData with database values
      setFormData({
        name: userData?.user?.name || '',
        email: userData?.user?.email || '',
        bio: userData?.user?.creator?.bio || '',
        expertise: userData?.user?.creator?.expertise || '',
        profileImage: userData?.user?.creator?.profileImage || '',
        bannerImage: userData?.user?.creator?.bannerImage || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimezone(userData?.user?.creator?.timezone || userData?.user?.timezone || 'Europe/Paris');
      
      // Load profile data
      const socialLinks = userData?.user?.creator?.socialLinks || {};
      setProfileData({
        profileImage: userData?.user?.creator?.profileImage || '',
        bannerImage: userData?.user?.creator?.bannerImage || '',
        bio: userData?.user?.creator?.bio || '',
        socialLinks: {
          instagram: socialLinks.instagram || '',
          tiktok: socialLinks.tiktok || '',
          twitter: socialLinks.twitter || '',
          youtube: socialLinks.youtube || '',
          other: socialLinks.other || '',
        },
      });

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
          profileImage: formData.profileImage,
          bannerImage: formData.bannerImage,
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

  const cleanSocialLinks = (links: Record<string, string>) => {
    const cleaned: Record<string, string | null> = {};

    for (const [key, value] of Object.entries(links)) {
      if (value && value.trim() !== '') {
        cleaned[key] = value.trim();
      }
    }

    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  };

  
  const handleSavePublicProfile = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/creators/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileImage: profileData.profileImage?.trim() || null,
          bannerImage: profileData.bannerImage?.trim() || null,
          bio: profileData.bio,
          socialLinks: cleanSocialLinks(profileData.socialLinks),
        }),
      });

      if (response.ok) {
        toast.success('Profil public mis à jour avec succès !');
        await fetchData();
      } else {
        const err = await response.json();
        toast.error(err?.error ?? 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setSaving(false);
    }
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="public">Profil Public</TabsTrigger>
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
              <CardContent className="space-y-6">
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

          {/* Public Profile Tab */}
          <TabsContent value="public" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profil Public</CardTitle>
                <CardDescription>
                  Personnalisez votre profil visible par vos fans
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profileImage">Photo de profil (URL)</Label>
                  <Input
                    id="profileImage"
                    type="url"
                    value={profileData.profileImage}
                    onChange={(e) => setProfileData({ ...profileData, profileImage: e.target.value })}
                    placeholder="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dXNlciUyMHByb2ZpbGV8ZW58MHx8MHx8fDA%3D"
                  />
                  <p className="text-xs text-gray-500">
                    Ajoutez l'URL d'une image pour votre photo de profil
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bannerImage">Bannière (URL)</Label>
                  <Input
                    id="bannerImage"
                    type="url"
                    value={profileData.bannerImage}
                    onChange={(e) => setProfileData({ ...profileData, bannerImage: e.target.value })}
                    placeholder="https://lh7-rt.googleusercontent.com/docsz/AD_4nXeeIW9ydvjWXc2xyf3l6-myQT4soO2jVPUovWl3n9MM_PyKadgjF4OOk-4BH_uaN8Y2jnQoDcVaUGCbLfwHgtQ2iiHjKM-MaQ92MjD6NQ7I18W-3_fGWMP1Uc_XB4NHkcab1Uobnlp9sCdwsrbmdngeamCD?key=G0DUnZ0pTlxt4vmbEMiYvg"
                  />
                  <p className="text-xs text-gray-500">
                    Image de bannière affichée en haut de votre profil (recommandé: 1200x300px)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="publicBio">Bio enrichie</Label>
                  <Textarea
                    id="publicBio"
                    rows={6}
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    placeholder="Parlez de vous, de votre parcours, de ce que vous proposez..."
                  />
                  <p className="text-xs text-gray-500">
                    Cette bio sera affichée sur votre profil public. Utilisez des sauts de ligne pour structurer votre texte.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Réseaux Sociaux</CardTitle>
                <CardDescription>
                  Ajoutez vos liens de réseaux sociaux pour que vos fans puissent vous suivre
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    type="url"
                    value={profileData.socialLinks.instagram}
                    onChange={(e) => setProfileData({ 
                      ...profileData, 
                      socialLinks: { ...profileData.socialLinks, instagram: e.target.value }
                    })}
                    placeholder="https://instagram.com/votre-compte"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tiktok">TikTok</Label>
                  <Input
                    id="tiktok"
                    type="url"
                    value={profileData.socialLinks.tiktok}
                    onChange={(e) => setProfileData({ 
                      ...profileData, 
                      socialLinks: { ...profileData.socialLinks, tiktok: e.target.value }
                    })}
                    placeholder="https://tiktok.com/@votre-compte"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter">Twitter / X</Label>
                  <Input
                    id="twitter"
                    type="url"
                    value={profileData.socialLinks.twitter}
                    onChange={(e) => setProfileData({ 
                      ...profileData, 
                      socialLinks: { ...profileData.socialLinks, twitter: e.target.value }
                    })}
                    placeholder="https://twitter.com/votre-compte"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="youtube">YouTube</Label>
                  <Input
                    id="youtube"
                    type="url"
                    value={profileData.socialLinks.youtube}
                    onChange={(e) => setProfileData({ 
                      ...profileData, 
                      socialLinks: { ...profileData.socialLinks, youtube: e.target.value }
                    })}
                    placeholder="https://youtube.com/@votre-chaine"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="other">Site web / Autre lien</Label>
                  <Input
                    id="other"
                    type="url"
                    value={profileData.socialLinks.other}
                    onChange={(e) => setProfileData({ 
                      ...profileData, 
                      socialLinks: { ...profileData.socialLinks, other: e.target.value }
                    })}
                    placeholder="https://votre-site.com"
                  />
                </div>

                {/* Profile Image Upload */}
                <ImageUpload
                  label="Photo de profil"
                  description="Votre photo sera affichée de manière circulaire"
                  imageUrl={formData.profileImage}
                  onUrlChange={(url) => setFormData({ ...formData, profileImage: url })}
                  imageType="profile"
                  previewClassName="relative w-32 h-32 border rounded-full overflow-hidden bg-gray-50 mx-auto"
                />

                {/* Banner Image Upload */}
                <ImageUpload
                  label="Image de bannière"
                  description="Image de couverture de votre profil (format paysage recommandé)"
                  imageUrl={formData.bannerImage}
                  onUrlChange={(url) => setFormData({ ...formData, bannerImage: url })}
                  imageType="banner"
                  previewClassName="relative w-full h-40 border rounded-lg overflow-hidden bg-gray-50"
                />

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSavePublicProfile}
                    disabled={saving}
                    className="bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" />Enregistrer le profil public</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
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
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Image from 'next/image';
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

// ✅ REFACTORED: Image Upload Component - Simplified version
interface ImageUploadProps {
  label: string;
  description: string;
  imageUrl: string;
  onUploadSuccess: () => void; // Callback to refresh data after upload
  onDelete: () => void; // Callback to delete image
  imageType: 'profile' | 'banner';
  previewClassName?: string;
}

function ImageUpload({ label, description, imageUrl, onUploadSuccess, onDelete, imageType, previewClassName }: ImageUploadProps) {
  const t = useTranslations('dashboard.creator.settings');
  const tToast = useTranslations('toast');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Update error state when imageUrl changes
  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error(tToast('error.unsupportedFormat'));
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(tToast('error.fileTooLarge'));
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
        // Display specific error message from API
        if (error.error) {
          toast.error(error.error);
        } else if (response.status === 500) {
          toast.error(tToast('error.serverError'));
        } else {
          toast.error(tToast('error.uploadError'));
        }
        return;
      }
      
      // ✅ Success: DB is already updated by the API
      toast.success(tToast('success.imageUploaded'));
      
      // ✅ Refresh data from database to get the new image
      onUploadSuccess();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(tToast('error.genericError'));
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>
        <p className="text-sm text-gray-500">{description}</p>
      </div>

      {/* Preview */}
      {imageUrl ? (
        <div className="mt-3">
          <Label className="text-xs text-gray-500 mb-2 block">{t('publicProfile.currentPreview')}</Label>
          {!imageError ? (
            <div className={previewClassName || 'relative w-full h-32 border rounded-lg overflow-hidden bg-gray-50'}>
              <Image
                src={imageUrl}
                alt={label}
                fill
                className="object-cover"
                onError={handleImageError}
              />
            </div>
          ) : (
            <div className="relative w-full h-32 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">{t('publicProfile.cannotLoadImage')}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <Label className="text-xs text-gray-500 mb-2 block">{t('publicProfile.preview')}</Label>
          <div className="relative w-full h-32 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <ImageIcon className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">{t('publicProfile.noImage')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload and Delete Buttons */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileUpload}
            className="hidden"
            id={`upload-${imageType}`}
            disabled={uploading || deleting}
          />
          <Button
            type="button"
            onClick={() => document.getElementById(`upload-${imageType}`)?.click()}
            disabled={uploading || deleting}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('publicProfile.uploadInProgress')}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                {imageUrl ? t('publicProfile.changeImage') : t('publicProfile.uploadImage')}
              </>
            )}
          </Button>
        </div>

        {/* Delete Button - Only visible if image exists */}
        {imageUrl && (
          <Button
            type="button"
            onClick={handleDelete}
            disabled={uploading || deleting}
            variant="outline"
            className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('publicProfile.deleteInProgress')}
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                {t('publicProfile.deleteImage')}
              </>
            )}
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        {t('publicProfile.acceptedFormats')}
      </p>
    </div>
  );
}

export default function CreatorSettings() {
  const router = useRouter();
  const t = useTranslations('dashboard.creator.settings');
  const tToast = useTranslations('toast');
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        toast.info(tToast('info.checkingStripeAccount'));
      }
      
      // Re-verify after delay
      setTimeout(() => {
        fetchData();
        window.history.replaceState({}, '', window.location.pathname);
      }, 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        toast.success(tToast('success.profileUpdated'));
        fetchData();
      } else {
        toast.error(tToast('error.updateFailed'));
      }
    } catch (error) {
      toast.error(tToast('error.genericError'));
    } finally {
      setSaving(false);
    }
  };
  
  const handleAutoDetect = () => {
    const detected = detectUserTimezone();
    setTimezone(detected);
    toast.success(tToast('success.timezoneDetected', { timezone: detected }));
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

  
  // ✅ REFACTORED: Only saves bio and social links (images are saved automatically on upload)
  const handleSavePublicProfile = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/creators/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // ❌ NO MORE: profileImage and bannerImage (handled by upload API)
          bio: profileData.bio,
          socialLinks: cleanSocialLinks(profileData.socialLinks),
        }),
      });

      if (response.ok) {
        toast.success(tToast('success.profileUpdated'));
        await fetchData();
      } else {
        const err = await response.json();
        toast.error(err?.error ?? tToast('error.updateFailed'));
      }
    } catch (error) {
      toast.error(tToast('error.genericError'));
    } finally {
      setSaving(false);
    }
  };


  const handleChangePassword = async () => {
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error(tToast('error.passwordMismatch'));
      return;
    }

    if (formData.newPassword.length < 8) {
      toast.error(tToast('error.passwordTooShort'));
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
        toast.success(tToast('success.passwordChanged'));
        setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const error = await response.json();
        toast.error(error?.error ?? tToast('error.updateFailed'));
      }
    } catch (error) {
      toast.error(tToast('error.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteImage = async (imageType: 'profile' | 'banner') => {
    // Confirmation before deletion
    if (!confirm(`{t('publicProfile.confirmDelete')}`)) {
      return;
    }

    try {
      const response = await fetch(`/api/upload/image?imageType=${imageType}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success(tToast('success.imageDeleted'));
        // Refresh data to update UI
        await fetchData();
      } else {
        const error = await response.json();
        toast.error(error?.error ?? tToast('error.deletingFailed'));
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(tToast('error.genericError'));
    }
  };

  const handleStartStripeOnboarding = async () => {
    const toastId = toast(tToast('info.redirecting'), { duration: Infinity });
    
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
        toast.error(error?.error ?? tToast('error.onboardingError'));
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(tToast('error.genericError'));
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
            {t('title')}
          </h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile">{t('tabs.profile')}</TabsTrigger>
            <TabsTrigger value="public">{t('tabs.public')}</TabsTrigger>
            <TabsTrigger value="payments">{t('tabs.payments')}</TabsTrigger>
            <TabsTrigger value="security">{t('tabs.security')}</TabsTrigger>
            <TabsTrigger value="notifications">{t('tabs.notifications')}</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.title')}</CardTitle>
                <CardDescription>
                  {t('profile.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('profile.fullName')}</Label>
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
                    placeholder="{t('profile.bioPlaceholder')}"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expertise">{t('profile.expertise')}</Label>
                  <Input
                    id="expertise"
                    value={formData.expertise}
                    onChange={(e) => setFormData({ ...formData, expertise: e.target.value })}
                    placeholder="{t('profile.expertisePlaceholder')}"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  {t('profile.timezone')}
                </CardTitle>
                <CardDescription>
                  {t('profile.timezoneDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 mb-1">
                      {t('profile.timezone')} détecté automatiquement
                    </p>
                    <p className="text-blue-700">
                      {detectedTimezone} ({getTimezoneAbbreviation(detectedTimezone)})
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">{t('profile.timezone')} actuel</Label>
                  <div className="flex gap-2">
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="{t('profile.selectTimezone')}" />
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
                      {t('profile.autoDetect')}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    {t('profile.allTimes')}
                  </p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-purple-900">
                    <strong>{t('publicProfile.preview')}</strong> Il est actuellement{' '}
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

            <div className="flex justify-end">
              <Button
                onClick={handleSaveProfile}
                disabled={saving}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('profile.saving')}</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />{t('profile.save')}</>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Public Profile Tab */}
          <TabsContent value="public" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('publicProfile.title')}</CardTitle>
                <CardDescription>
                  {t('publicProfile.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* ✅ Profile Image Upload - Simplified */}
                <ImageUpload
                  label="{t('publicProfile.profileImage')}"
                  description="{t('publicProfile.profileImageDesc')}"
                  imageUrl={profileData.profileImage}
                  onUploadSuccess={fetchData}
                  onDelete={() => handleDeleteImage('profile')}
                  imageType="profile"
                  previewClassName="relative w-32 h-32 border rounded-full overflow-hidden bg-gray-50 mx-auto"
                />

                {/* ✅ Banner Image Upload - Simplified */}
                <ImageUpload
                  label="{t('publicProfile.bannerImage')}"
                  description="{t('publicProfile.bannerImageDesc')}"
                  imageUrl={profileData.bannerImage}
                  onUploadSuccess={fetchData}
                  onDelete={() => handleDeleteImage('banner')}
                  imageType="banner"
                  previewClassName="relative w-full h-40 border rounded-lg overflow-hidden bg-gray-50"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('publicProfile.bioTitle')}</CardTitle>
                <CardDescription>
                  {t('publicProfile.bioDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="publicBio">{t('publicProfile.richBio')}</Label>
                  <Textarea
                    id="publicBio"
                    rows={6}
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    placeholder="{t('publicProfile.richBioPlaceholder')}"
                  />
                  <p className="text-xs text-gray-500">
                    {t('publicProfile.richBioHelp')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('publicProfile.socialLinks')}</CardTitle>
                <CardDescription>
                  {t('publicProfile.socialLinksDesc')}
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
                    placeholder="{t('publicProfile.instagramPlaceholder')}"
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
                    placeholder="{t('publicProfile.tiktokPlaceholder')}"
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
                    placeholder="{t('publicProfile.twitterPlaceholder')}"
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
                    placeholder="{t('publicProfile.youtubePlaceholder')}"
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
                    placeholder="{t('publicProfile.otherPlaceholder')}"
                  />
                </div>

                {/* ✅ Save Button for Bio and Social Links ONLY */}
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSavePublicProfile}
                    disabled={saving}
                    className="bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('profile.saving')}</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" />{t('profile.save')}</>
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
                  {t('paymentsTab.title')}
                </CardTitle>
                <CardDescription>
                  {t('paymentsTab.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Stripe Status */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-semibold mb-1">{t('paymentsTab.stripeStatus')}</h4>
                    <p className="text-sm text-gray-500">
                      {stripeOnboarding.onboarded 
                        ? t('paymentsTab.accountReady')
                        : t('paymentsTab.configRequired')}
                    </p>
                  </div>
                  {stripeOnboarding.onboarded ? (
                    <Badge className="bg-green-500">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {t('paymentsTab.configured')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                      <XCircle className="w-4 h-4 mr-1" />
                      {t('paymentsTab.notConfigured')}
                    </Badge>
                  )}
                </div>

                {/* Onboarding Button */}
                {!stripeOnboarding.onboarded && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-800 mb-2">{t('paymentsTab.warningTitle')}</h4>
                    <p className="text-sm text-yellow-700 mb-4">
                      {t('paymentsTab.warningDesc')}
                    </p>
                    <Button
                      onClick={handleStartStripeOnboarding}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      {t('paymentsTab.configureStripe')}
                    </Button>
                  </div>
                )}

                {/* Stripe Connect Express Dashboard Link */}
                {stripeOnboarding.onboarded && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">{t('paymentsTab.manageAccount')}</h4>
                    <p className="text-sm text-blue-700 mb-4">
                      {t('paymentsTab.manageAccountDesc')}
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
                            toast.error(tToast('error.dashboardOpenError'));
                          }
                        } catch (error) {
                          toast.error(tToast('error.genericError'));
                        }
                      }}
                      variant="outline"
                      className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      {t('paymentsTab.openStripeConnect')}
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}

                {/* Info about bank account */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">{t('paymentsTab.howToAddBank')}</h4>
                  <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                    <li>Cliquez sur le bouton <strong>&quot;{t('paymentsTab.openStripeConnect')}&quot;</strong> ci-dessus</li>
                    <li>{t('paymentsTab.bankStep2')}</li>
                    <li>{t('paymentsTab.bankStep3')}</li>
                    <li>{t('paymentsTab.bankStep4')}</li>
                  </ol>
                  <p className="text-sm text-gray-500 mt-3">
                    {t('paymentsTab.importantNote')}
                  </p>
                </div>

                {/* Payout info */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">{t('paymentsTab.howPaymentsWork')}</h4>
                  <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                    <li><strong>{t('paymentsTab.securityPeriod')}</strong> {t('paymentsTab.securityPeriodDesc')}</li>
                    <li><strong>{t('paymentsTab.commission')}</strong> {t('paymentsTab.commissionDesc')}</li>
                    <li><strong>{t('paymentsTab.paymentRequest')}</strong> {t('paymentsTab.paymentRequestDesc')}</li>
                    <li><strong>{t('paymentsTab.reception')}</strong> {t('paymentsTab.receptionDesc')}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('security.title')}</CardTitle>
                <CardDescription>
                  {t('security.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">{t('security.currentPassword')}</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t('security.newPassword')}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('security.confirmPassword')}</Label>
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
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('security.changing')}</>
                    ) : (
                      <>{t('security.changePassword')}</>
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
                  {t('notificationsTab.title')}
                </CardTitle>
                <CardDescription>
                  {t('notificationsTab.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('notificationsTab.emailNotifications')}</Label>
                    <p className="text-sm text-gray-500">{t('notificationsTab.emailNotificationsDesc')}</p>
                  </div>
                  <Switch
                    checked={notifications.email}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('notificationsTab.newBooking')}</Label>
                    <p className="text-sm text-gray-500">{t('notificationsTab.newBookingDesc')}</p>
                  </div>
                  <Switch
                    checked={notifications.newBooking}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, newBooking: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('notificationsTab.payoutAvailable')}</Label>
                    <p className="text-sm text-gray-500">{t('notificationsTab.payoutAvailableDesc')}</p>
                  </div>
                  <Switch
                    checked={notifications.payoutAvailable}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, payoutAvailable: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('notificationsTab.callReminder')}</Label>
                    <p className="text-sm text-gray-500">{t('notificationsTab.callReminderDesc')}</p>
                  </div>
                  <Switch
                    checked={notifications.callReminder}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, callReminder: checked })}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => toast.success(tToast('success.preferenceSaved'))}
                    className="bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {t('notificationsTab.savePreferences')}
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

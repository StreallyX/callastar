'use client';

import { useState } from 'react';
import { useRouter } from '@/navigation';
import { Link } from '@/navigation';
import { Star, Mail, Lock, Loader2, User, Shield, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import toast from 'react-hot-toast';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

const TEST_ACCOUNTS = [
  { email: 'john@doe.com', password: 'johndoe123', labelKey: 'admin', icon: Shield },
  { email: 'emma.creator@example.com', password: 'password123', labelKey: 'creator', icon: Video, extraLabel: ' (Emma)' },
  { email: 'lucas.creator@example.com', password: 'password123', labelKey: 'creator', icon: Video, extraLabel: ' (Lucas)' },
  { email: 'user@example.com', password: 'password123', labelKey: 'user', icon: User },
];

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('auth.login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`${t('successMessage')} ${data?.user?.name ?? ''}`);

        // Use window.location.href to force a full page reload
        // This ensures the cookie is properly set and recognized by middleware
        if (data?.user?.role === 'ADMIN') {
          window.location.href = '/dashboard/admin';
        } else if (data?.user?.role === 'CREATOR') {
          window.location.href = '/dashboard/creator';
        } else {
          window.location.href = '/dashboard/user';
        }
      } else {
        toast.error(data?.error ?? t('errorMessage'));
      }
    } catch (error) {
      toast.error(t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleLogin(formData.email, formData.password);
  };

  const handleTestLogin = (testEmail: string, testPassword: string) => {
    handleLogin(testEmail, testPassword);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signIn('google', {
        callbackUrl: '/dashboard/user',
        redirect: true,
      });
    } catch (error) {
      toast.error(t('googleError'));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 mb-4 mx-auto">
            <Star className="w-8 h-8 text-white fill-white" />
          </div>
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder={t('passwordPlaceholder')}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('loggingIn')}
                </>
              ) : (
                t('loginButton')
              )}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">
                  {t('orContinueWith')}
                </span>
              </div>
            </div>

            {/* Google Sign-In Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
            >
              {googleLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t('loggingIn')}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {t('googleLogin')}
                </>
              )}
            </Button>

            {/* Test accounts section for development */}
            <div className="w-full">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">
                    {t('testAccounts')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                {TEST_ACCOUNTS.map((account) => {
                  const Icon = account.icon;
                  return (
                    <Button
                      key={account.email}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestLogin(account.email, account.password)}
                      disabled={loading}
                      className="text-xs flex items-center gap-1"
                    >
                      <Icon className="w-3 h-3" />
                      {t(account.labelKey)}{account.extraLabel || ''}
                    </Button>
                  );
                })}
              </div>
            </div>

            <p className="text-center text-sm text-gray-600">
              {t('noAccount')}{' '}
              <Link href="/auth/register" className="text-purple-600 hover:underline font-medium">
                {t('registerLink')}
              </Link>
            </p>

            <Link href="/" className="w-full">
              <Button
                variant="ghost"
                className="w-full border border-gray-200 text-gray-700 hover:bg-gray-100"
              >
                ← {t('backToHome')}
              </Button>
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

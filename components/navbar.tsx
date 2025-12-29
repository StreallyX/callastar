'use client';

import { Link, useRouter, usePathname } from '@/navigation';
import { Star, LogOut, User, LayoutDashboard, Settings, TestTube2, Wallet, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import NotificationBell from '@/components/NotificationBell';
import { useLocale, useTranslations } from 'next-intl';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('navbar');
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data?.user ?? null);
      } else if (response.status === 401) {
        // User not logged in - this is expected
        setUser(null);
      }
    } catch (error) {
      // Silently handle network errors
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getDashboardPath = () => {
    if (user?.role === 'ADMIN') return '/dashboard/admin';
    if (user?.role === 'CREATOR') return '/dashboard/creator';
    return '/dashboard/user';
  };

  const getSettingsPath = () => {
    if (user?.role === 'ADMIN') return '/dashboard/admin/settings';
    if (user?.role === 'CREATOR') return '/dashboard/creator/settings';
    return '/dashboard/user/settings';
  };

  const switchLanguage = (newLocale: 'fr' | 'en') => {
    // pathname from usePathname() is already without locale prefix
    // router.replace will add the new locale automatically
    router.replace(pathname, { locale: newLocale });
    router.refresh();
  };


  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600">
              <Star className="w-6 h-6 text-white fill-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Call a Star
            </span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-4">
            <Link href="/creators">
              <Button variant="ghost">{t('creators')}</Button>
            </Link>

            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Languages className="w-4 h-4" />
                  {locale.toUpperCase()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => switchLanguage('fr')}>
                  🇫🇷 Français
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchLanguage('en')}>
                  🇬🇧 English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {!loading && (
              <>
                {user ? (
                  <>
                    <NotificationBell />
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <User className="w-4 h-4" />
                        {user.name}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(getDashboardPath())}>
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        {t('dashboard')}
                      </DropdownMenuItem>
                      {user?.role === 'CREATOR' && (
                        <DropdownMenuItem onClick={() => router.push('/dashboard/creator/payouts')}>
                          <Wallet className="w-4 h-4 mr-2" />
                          {t('payments')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => router.push(getSettingsPath())}>
                        <Settings className="w-4 h-4 mr-2" />
                        {t('settings')}
                      </DropdownMenuItem>
                      {user?.role === 'ADMIN' && (
                        <DropdownMenuItem onClick={() => router.push('/dashboard/admin/testing')}>
                          <TestTube2 className="w-4 h-4 mr-2" />
                          {t('testsTools')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout}>
                        <LogOut className="w-4 h-4 mr-2" />
                        {t('logout')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </>
                ) : (
                  <>
                    <Link href="/auth/login">
                      <Button variant="ghost">{t('login')}</Button>
                    </Link>
                    <Link href="/auth/register">
                      <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                        {t('register')}
                      </Button>
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

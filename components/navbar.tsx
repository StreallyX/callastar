'use client';

import { Link, useRouter, usePathname } from '@/navigation';
import {
  Star,
  LogOut,
  User,
  LayoutDashboard,
  Settings,
  TestTube2,
  Wallet,
  Languages
} from 'lucide-react';
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
        setUser(null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);

      // ✅ PAS de refresh
      // ✅ navigation propre avec locale conservée
      router.push('/', { locale });
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
    // Supprime toute locale existante du pathname
    const cleanPathname = pathname.replace(/^\/(fr|en)(\/|$)/, '/');

    router.replace(cleanPathname, { locale: newLocale });
  };


  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600">
              <Star className="h-6 w-6 fill-white text-white" />
            </div>
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-xl font-bold text-transparent">
              Call a Star
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/creators">
              <Button variant="ghost">{t('creators')}</Button>
            </Link>

            {/* Language selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Languages className="h-4 w-4" />
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
                          <User className="h-4 w-4" />
                          {user.name}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(getDashboardPath())}>
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          {t('dashboard')}
                        </DropdownMenuItem>

                        {user.role === 'CREATOR' && (
                          <DropdownMenuItem onClick={() => router.push('/dashboard/creator/payouts')}>
                            <Wallet className="mr-2 h-4 w-4" />
                            {t('payments')}
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem onClick={() => router.push(getSettingsPath())}>
                          <Settings className="mr-2 h-4 w-4" />
                          {t('settings')}
                        </DropdownMenuItem>

                        {user.role === 'ADMIN' && (
                          <DropdownMenuItem onClick={() => router.push('/dashboard/admin/testing')}>
                            <TestTube2 className="mr-2 h-4 w-4" />
                            {t('testsTools')}
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout}>
                          <LogOut className="mr-2 h-4 w-4" />
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
                      <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
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

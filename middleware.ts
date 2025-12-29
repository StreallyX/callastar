import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';
import { locales, defaultLocale } from './i18n-config';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always'
});

const publicPaths = ['/', '/auth/login', '/auth/register', '/creators', '/legal'];
const authPaths = ['/auth/login', '/auth/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('────────────── MIDDLEWARE START ──────────────');
  console.log('➡️ Incoming pathname:', pathname);
  console.log('➡️ Cookies:', request.cookies.getAll().map(c => `${c.name}=${c.value}`));

  // 🚨 next-intl middleware FIRST
  const intlResponse = intlMiddleware(request);

  if (intlResponse.headers.get('location')) {
    console.log('🌍 intlMiddleware REDIRECT →', intlResponse.headers.get('location'));
  } else {
    console.log('🌍 intlMiddleware NO redirect');
  }

  // Skip static & api
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('/favicon') ||
    pathname.includes('/og-image')
  ) {
    console.log('⏭️ Skipped (static/api)');
    return intlResponse;
  }

  // 🔹 Detect locale from pathname
  const detectedLocale =
    locales.find(
      (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
    ) ?? defaultLocale;

  console.log('🟢 Detected locale:', detectedLocale);

  // 🔹 Remove locale safely
  const pathnameWithoutLocale = pathname.replace(
    new RegExp(`^/(${locales.join('|')})`),
    ''
  ) || '/';

  console.log('📂 Pathname WITHOUT locale:', pathnameWithoutLocale);

  const token = request.cookies.get('auth-token')?.value;
  console.log('🔐 Auth token:', token ? 'PRESENT' : 'NONE');

  const user = token ? await verifyToken(token) : null;
  console.log('👤 User:', user ? user.role : 'NOT AUTHENTICATED');

  const isPublicPath = publicPaths.some(
    (path) =>
      pathnameWithoutLocale === path ||
      pathnameWithoutLocale.startsWith(`${path}/`)
  );

  const isAuthPath = authPaths.some((path) =>
    pathnameWithoutLocale.startsWith(path)
  );

  console.log('🌐 isPublicPath:', isPublicPath);
  console.log('🔑 isAuthPath:', isAuthPath);

  // Redirect helper WITH locale
  const redirectTo = (path: string) => {
    const target = `/${detectedLocale}${path}`;
    console.log('➡️ REDIRECT TRIGGERED →', target);
    return NextResponse.redirect(new URL(target, request.url));
  };

  // 🔐 Auth guards
  if (isAuthPath && user) {
    console.log('🚫 Auth page but user already logged in');
    if (user.role === 'ADMIN') return redirectTo('/dashboard/admin');
    if (user.role === 'CREATOR') return redirectTo('/dashboard/creator');
    return redirectTo('/dashboard/user');
  }

  if (!isPublicPath && pathnameWithoutLocale.startsWith('/dashboard')) {
    if (!user) {
      console.log('🚫 Dashboard access without auth');
      const res = redirectTo('/auth/login');
      res.cookies.delete('auth-token');
      return res;
    }

    if (pathnameWithoutLocale.startsWith('/dashboard/admin') && user.role !== 'ADMIN') {
      console.log('🚫 Forbidden admin dashboard');
      return redirectTo(
        user.role === 'CREATOR'
          ? '/dashboard/creator'
          : '/dashboard/user'
      );
    }

    if (
      pathnameWithoutLocale.startsWith('/dashboard/creator') &&
      user.role !== 'CREATOR'
    ) {
      console.log('🚫 Forbidden creator dashboard');
      return redirectTo(
        user.role === 'ADMIN'
          ? '/dashboard/admin'
          : '/dashboard/user'
      );
    }
  }

  if (
    (pathnameWithoutLocale.startsWith('/book') ||
      pathnameWithoutLocale.startsWith('/call')) &&
    !user
  ) {
    console.log('🚫 Book/Call requires auth');
    return redirectTo('/auth/login');
  }

  console.log('✅ No redirect, returning intlResponse');
  console.log('────────────── MIDDLEWARE END ──────────────');

  return intlResponse;
}

export const config = {
  matcher: [
    '/((?!_next|api|favicon.ico|favicon.svg|robots.txt|og-image.png).*)'
  ]
};

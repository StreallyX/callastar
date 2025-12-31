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

  // 🚨 next-intl middleware FIRST
  const intlResponse = intlMiddleware(request);

  // Skip static & api
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('/favicon') ||
    pathname.includes('/og-image')
  ) {
    return intlResponse;
  }

  // 🔹 Detect locale from pathname
  const detectedLocale =
    locales.find(
      (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
    ) ?? defaultLocale;


  // 🔹 Remove locale safely
  const pathnameWithoutLocale = pathname.replace(
    new RegExp(`^/(${locales.join('|')})`),
    ''
  ) || '/';


  const token = request.cookies.get('auth-token')?.value;

  const user = token ? await verifyToken(token) : null;

  const isPublicPath = publicPaths.some(
    (path) =>
      pathnameWithoutLocale === path ||
      pathnameWithoutLocale.startsWith(`${path}/`)
  );

  const isAuthPath = authPaths.some((path) =>
    pathnameWithoutLocale.startsWith(path)
  );


  // Redirect helper WITH locale
  const redirectTo = (path: string) => {
    const target = `/${detectedLocale}${path}`;
    return NextResponse.redirect(new URL(target, request.url));
  };

  // 🔐 Auth guards
  if (isAuthPath && user) {
    if (user.role === 'ADMIN') return redirectTo('/dashboard/admin');
    if (user.role === 'CREATOR') return redirectTo('/dashboard/creator');
    return redirectTo('/dashboard/user');
  }

  if (!isPublicPath && pathnameWithoutLocale.startsWith('/dashboard')) {
    if (!user) {
      const res = redirectTo('/auth/login');
      res.cookies.delete('auth-token');
      return res;
    }

    if (pathnameWithoutLocale.startsWith('/dashboard/admin') && user.role !== 'ADMIN') {
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
    return redirectTo('/auth/login');
  }

  return intlResponse;
}

export const config = {
  matcher: [
    '/((?!_next|api|favicon.ico|favicon.svg|robots.txt|og-image.png).*)'
  ]
};

import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';
import { locales, defaultLocale } from './i18n';

const publicPaths = ['/', '/auth/login', '/auth/register', '/creators', '/legal'];
const authPaths = ['/auth/login', '/auth/register'];

// Create the intl middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and api routes
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api/') ||
    pathname.includes('/favicon') ||
    pathname.includes('/og-image')
  ) {
    return NextResponse.next();
  }

  // Apply intl middleware first
  const intlResponse = intlMiddleware(request);
  
  // Get the pathname without locale prefix
  const pathnameWithoutLocale = locales.some(locale => 
    pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  )
    ? pathname.slice(3) // Remove /{locale}
    : pathname;
  
  // Get auth token
  const token = request.cookies.get('auth-token')?.value;
  const user = token ? await verifyToken(token) : null;

  // Check if path is public
  const isPublicPath = publicPaths.some(path => 
    pathnameWithoutLocale === path || pathnameWithoutLocale.startsWith(path + '/')
  );
  const isAuthPath = authPaths.some(path => pathnameWithoutLocale.startsWith(path));

  // Get current locale from pathname or cookie or default
  const currentLocale = locales.find(locale => 
    pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  ) || request.cookies.get('NEXT_LOCALE')?.value || defaultLocale;

  // Helper to create locale-aware URLs
  const createLocaleUrl = (path: string) => {
    const locale = currentLocale === defaultLocale ? '' : `/${currentLocale}`;
    return new URL(`${locale}${path}`, request.url);
  };

  // Redirect authenticated users away from auth pages
  if (isAuthPath && user) {
    if (user.role === 'ADMIN') {
      return NextResponse.redirect(createLocaleUrl('/dashboard/admin'));
    } else if (user.role === 'CREATOR') {
      return NextResponse.redirect(createLocaleUrl('/dashboard/creator'));
    }
    return NextResponse.redirect(createLocaleUrl('/dashboard/user'));
  }

  // Allow public paths
  if (isPublicPath) {
    return intlResponse;
  }

  // Protect dashboard routes - CRITICAL: All dashboard routes require authentication
  if (pathnameWithoutLocale.startsWith('/dashboard')) {
    if (!user) {
      // No valid authentication - redirect to login immediately
      const response = NextResponse.redirect(createLocaleUrl('/auth/login'));
      // Clear any invalid auth cookies
      response.cookies.delete('auth-token');
      return response;
    }

    // Protect admin dashboard
    if (pathnameWithoutLocale.startsWith('/dashboard/admin') && user.role !== 'ADMIN') {
      if (user.role === 'CREATOR') {
        return NextResponse.redirect(createLocaleUrl('/dashboard/creator'));
      }
      return NextResponse.redirect(createLocaleUrl('/dashboard/user'));
    }

    // Check creator role for creator dashboard
    if (pathnameWithoutLocale.startsWith('/dashboard/creator') && user.role !== 'CREATOR') {
      if (user.role === 'ADMIN') {
        return NextResponse.redirect(createLocaleUrl('/dashboard/admin'));
      }
      return NextResponse.redirect(createLocaleUrl('/dashboard/user'));
    }

    // Redirect creators and admins trying to access user dashboard
    if (pathnameWithoutLocale.startsWith('/dashboard/user')) {
      if (user.role === 'ADMIN') {
        return NextResponse.redirect(createLocaleUrl('/dashboard/admin'));
      } else if (user.role === 'CREATOR') {
        return NextResponse.redirect(createLocaleUrl('/dashboard/creator'));
      }
    }
  }

  // Protect booking and call routes
  if ((pathnameWithoutLocale.startsWith('/book') || pathnameWithoutLocale.startsWith('/call')) && !user) {
    return NextResponse.redirect(createLocaleUrl('/auth/login'));
  }

  return intlResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, favicon.svg, robots.txt (metadata files)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|robots.txt|og-image.png).*)',
  ],
};

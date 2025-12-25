import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

const publicPaths = ['/', '/auth/login', '/auth/register', '/creators'];
const authPaths = ['/auth/login', '/auth/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get auth token
  const token = request.cookies.get('auth-token')?.value;
  const user = token ? await verifyToken(token) : null;

  // Check if path is public
  const isPublicPath = publicPaths.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  );
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));

  // Redirect authenticated users away from auth pages
  if (isAuthPath && user) {
    if (user.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard/admin', request.url));
    } else if (user.role === 'CREATOR') {
      return NextResponse.redirect(new URL('/dashboard/creator', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard/user', request.url));
  }

  // Allow public paths
  if (isPublicPath || pathname.startsWith('/_next') || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Protect dashboard routes - CRITICAL: All dashboard routes require authentication
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      // No valid authentication - redirect to login immediately
      const response = NextResponse.redirect(new URL('/auth/login', request.url));
      // Clear any invalid auth cookies
      response.cookies.delete('auth-token');
      return response;
    }

    // Protect admin dashboard
    if (pathname.startsWith('/dashboard/admin') && user.role !== 'ADMIN') {
      if (user.role === 'CREATOR') {
        return NextResponse.redirect(new URL('/dashboard/creator', request.url));
      }
      return NextResponse.redirect(new URL('/dashboard/user', request.url));
    }

    // Check creator role for creator dashboard
    if (pathname.startsWith('/dashboard/creator') && user.role !== 'CREATOR') {
      if (user.role === 'ADMIN') {
        return NextResponse.redirect(new URL('/dashboard/admin', request.url));
      }
      return NextResponse.redirect(new URL('/dashboard/user', request.url));
    }

    // Redirect creators and admins trying to access user dashboard
    if (pathname.startsWith('/dashboard/user')) {
      if (user.role === 'ADMIN') {
        return NextResponse.redirect(new URL('/dashboard/admin', request.url));
      } else if (user.role === 'CREATOR') {
        return NextResponse.redirect(new URL('/dashboard/creator', request.url));
      }
    }
  }

  // Protect booking and call routes
  if ((pathname.startsWith('/book') || pathname.startsWith('/call')) && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return NextResponse.next();
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

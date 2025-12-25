import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

export async function POST() {
  try {
    const response = NextResponse.json(
      { success: true, message: 'Déconnexion réussie' },
      { status: 200 }
    );

    // Clear auth cookie
    const cookie = clearAuthCookie();
    response.cookies.set(cookie);

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue lors de la déconnexion' },
      { status: 500 }
    );
  }
}

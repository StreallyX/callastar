import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { comparePassword, generateToken, setAuthCookie } from '@/lib/auth';
import { logAuth } from '@/lib/system-logger';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validatedData = loginSchema.parse(body);

    // Find user
    const user = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user || !user.password) {
      // Log failed login attempt
      await logAuth('LOGIN', 'unknown', false, {
        email: validatedData.email,
        reason: 'User not found or no password',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      });
      
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await comparePassword(validatedData.password, user.password);

    if (!isPasswordValid) {
      // Log failed login attempt
      await logAuth('LOGIN', user.id, false, {
        email: validatedData.email,
        reason: 'Invalid password',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      });
      
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    // Generate JWT
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Log successful login
    await logAuth('LOGIN', user.id, true, {
      email: user.email,
      role: user.role,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    // Create response
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 200 }
    );

    // Set auth cookie
    const cookie = setAuthCookie(token);
    response.cookies.set(cookie);

    return response;
  } catch (error) {
    console.error('Login error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Une erreur est survenue lors de la connexion' },
      { status: 500 }
    );
  }
}

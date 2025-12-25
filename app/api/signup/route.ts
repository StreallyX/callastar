import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth';

// Validation schema
const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  role: z.enum(['USER', 'CREATOR']).default('USER'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validatedData = signupSchema.parse(body);

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Un utilisateur avec cet email existe déjà' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Create user
    const user = await db.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        role: validatedData.role,
      },
    });

    // If creator, create creator profile
    if (validatedData.role === 'CREATOR') {
      await db.creator.create({
        data: {
          userId: user.id,
        },
      });
    }

    // Generate JWT
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
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
      { status: 201 }
    );

    // Set auth cookie
    const cookie = setAuthCookie(token);
    response.cookies.set(cookie);

    return response;
  } catch (error) {
    console.error('Signup error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Une erreur est survenue lors de l\'inscription' },
      { status: 500 }
    );
  }
}

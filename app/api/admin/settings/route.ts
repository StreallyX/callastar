import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Schema validation
const updateSettingsSchema = z.object({
  platformCommissionRate: z.number().min(0).max(100),
});

// GET /api/admin/settings - Get all settings
export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    const settings = await prisma.adminSettings.findMany();

    // Convert to key-value object
    const settingsObj = settings.reduce((acc: Record<string, string>, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json({ 
      settings: {
        platformCommissionRate: Number(settingsObj.platformCommissionRate || 10)
      }
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paramètres' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/settings - Update a setting
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateSettingsSchema.parse(body);

    // Upsert platformCommissionRate setting
    const setting = await prisma.adminSettings.upsert({
      where: {
        key: 'platformCommissionRate',
      },
      update: {
        value: String(validatedData.platformCommissionRate),
      },
      create: {
        key: 'platformCommissionRate',
        value: String(validatedData.platformCommissionRate),
      },
    });

    return NextResponse.json({ 
      settings: {
        platformCommissionRate: Number(setting.value)
      }
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du paramètre' },
      { status: 500 }
    );
  }
}

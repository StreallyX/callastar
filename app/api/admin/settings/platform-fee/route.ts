import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { z } from 'zod';

const updateFeeSchema = z.object({
  platformFeePercentage: z.number().min(0).max(100),
  platformFeeFixed: z.number().min(0).optional(),
  minimumPayoutAmount: z.number().min(0).optional(),
});

/**
 * GET /api/admin/settings/platform-fee
 * Get current platform fee settings
 */
export async function GET(request: NextRequest) {
  try {
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

    // Get platform settings
    let settings = await prisma.platformSettings.findFirst();

    // If no settings exist, create default
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {
          platformFeePercentage: 10,
          minimumPayoutAmount: 10,
          holdingPeriodDays: 7,
          payoutMode: 'MANUAL',
          payoutFrequencyOptions: ['DAILY', 'WEEKLY', 'MONTHLY'],
          currency: 'EUR',
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        platformFeePercentage: Number(settings.platformFeePercentage),
        platformFeeFixed: settings.platformFeeFixed ? Number(settings.platformFeeFixed) : null,
        minimumPayoutAmount: Number(settings.minimumPayoutAmount),
        holdingPeriodDays: settings.holdingPeriodDays,
        payoutMode: settings.payoutMode,
        currency: settings.currency,
      },
    });
  } catch (error) {
    console.error('Error fetching platform fee settings:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paramètres' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings/platform-fee
 * Update platform fee settings
 */
export async function PUT(request: NextRequest) {
  try {
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

    const body = await request.json();
    const validatedData = updateFeeSchema.parse(body);

    // Get or create settings
    let settings = await prisma.platformSettings.findFirst();

    if (!settings) {
      // Create new settings
      settings = await prisma.platformSettings.create({
        data: {
          platformFeePercentage: validatedData.platformFeePercentage,
          platformFeeFixed: validatedData.platformFeeFixed || null,
          minimumPayoutAmount: validatedData.minimumPayoutAmount || 10,
          holdingPeriodDays: 7,
          payoutMode: 'MANUAL',
          payoutFrequencyOptions: ['DAILY', 'WEEKLY', 'MONTHLY'],
          currency: 'EUR',
        },
      });
    } else {
      // Update existing settings
      settings = await prisma.platformSettings.update({
        where: { id: settings.id },
        data: {
          platformFeePercentage: validatedData.platformFeePercentage,
          ...(validatedData.platformFeeFixed !== undefined && {
            platformFeeFixed: validatedData.platformFeeFixed,
          }),
          ...(validatedData.minimumPayoutAmount !== undefined && {
            minimumPayoutAmount: validatedData.minimumPayoutAmount,
          }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Paramètres mis à jour avec succès',
      settings: {
        platformFeePercentage: Number(settings.platformFeePercentage),
        platformFeeFixed: settings.platformFeeFixed ? Number(settings.platformFeeFixed) : null,
        minimumPayoutAmount: Number(settings.minimumPayoutAmount),
      },
    });
  } catch (error) {
    console.error('Error updating platform fee settings:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des paramètres' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { 
  getPlatformSettings, 
  updatePlatformSettings, 
  formatSettingsResponse,
  PlatformSettingsUpdate 
} from '@/lib/settings';
import { PayoutMode } from '@prisma/client';

// Schema validation for update
const updateSettingsSchema = z.object({
  platformFeePercentage: z.number().min(0).max(100).optional(),
  platformFeeFixed: z.number().min(0).nullable().optional(),
  minimumPayoutAmount: z.number().min(0).optional(),
  holdingPeriodDays: z.number().int().min(0).optional(),
  payoutMode: z.enum([PayoutMode.AUTOMATIC, PayoutMode.MANUAL]).optional(),
  payoutFrequencyOptions: z.array(z.string()).optional(),
  currency: z.string().optional(),
});

/**
 * GET /api/admin/settings
 * Fetch current platform settings
 * 
 * @returns Platform settings with all configuration parameters
 */
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

    // Fetch settings (creates defaults if not exist)
    const settings = await getPlatformSettings();
    const formattedSettings = formatSettingsResponse(settings);

    return NextResponse.json({ 
      success: true,
      settings: formattedSettings 
    });
  } catch (error) {
    console.error('Error fetching platform settings:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Erreur lors de la récupération des paramètres' 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings
 * Update platform settings (admin only)
 * 
 * @body Partial settings object with fields to update
 * @returns Updated platform settings
 */
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

    // Update settings
    const updatedSettings = await updatePlatformSettings(
      validatedData as PlatformSettingsUpdate
    );
    const formattedSettings = formatSettingsResponse(updatedSettings);

    return NextResponse.json({ 
      success: true,
      settings: formattedSettings,
      message: 'Paramètres mis à jour avec succès'
    });
  } catch (error) {
    console.error('Error updating platform settings:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Données invalides', 
          details: error.issues 
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { 
          success: false,
          error: error.message 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Erreur lors de la mise à jour des paramètres' 
      },
      { status: 500 }
    );
  }
}

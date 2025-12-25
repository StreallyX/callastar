import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

const updateProfileSchema = z.object({
  bio: z.string().optional(),
  expertise: z.string().optional(),
  profileImage: z.string().url().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    if (user.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Accès refusé. Seuls les créateurs peuvent modifier leur profil.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateProfileSchema.parse(body);

    // Get creator
    const creator = await db.creator.findUnique({
      where: { userId: user.userId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Profil créateur introuvable' },
        { status: 404 }
      );
    }

    // Update creator profile
    const updatedCreator = await db.creator.update({
      where: { id: creator.id },
      data: validatedData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(
      { creator: updatedCreator },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update profile error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

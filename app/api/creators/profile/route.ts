import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

/**
 * Helpers
 */
const nullableUrl = z
  .string()
  .optional()
  .transform((v) => {
    if (!v || v.trim() === '') return null;
    return v.trim();
  })
  .nullable()
  .refine(
    (v) => v === null || /^https?:\/\//.test(v),
    { message: 'URL invalide' }
  );


/**
 * Validation schema
 */
const updateCreatorProfileSchema = z.object({
  bio: z.string().optional(),
  expertise: z.string().optional(),
  timezone: z.string().optional(),

  profileImage: nullableUrl,
  bannerImage: nullableUrl,

  socialLinks: z
    .object({
      instagram: nullableUrl,
      tiktok: nullableUrl,
      twitter: nullableUrl,
      youtube: nullableUrl,
      other: nullableUrl,
    })
    .optional(),
});

/**
 * PUT — Update creator profile
 */
export async function PUT(request: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: jwtUser.userId },
      include: { creator: true },
    });

    if (!user || user.role !== 'CREATOR' || !user.creator) {
      return NextResponse.json(
        { error: 'Accès réservé aux créateurs' },
        { status: 403 }
      );
    }

    const body = await request.json();
    console.log('[PUT /creators/profile] body:', body);

    const validatedData = updateCreatorProfileSchema.parse(body);

    /**
     * Build update payload safely
     */
    const updateData: Record<string, any> = {};

    for (const [key, value] of Object.entries(validatedData)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    const updatedCreator = await db.creator.update({
      where: { id: user.creator.id },
      data: updateData,
      select: {
        id: true,
        bio: true,
        timezone: true,
        profileImage: true,
        bannerImage: true,
        socialLinks: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ creator: updatedCreator });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('[ZOD ERROR]', error.issues);
      return NextResponse.json(
        { error: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating creator profile:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du profil' },
      { status: 500 }
    );
  }
}

/**
 * GET — Fetch creator profile
 */
export async function GET(request: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: jwtUser.userId },
      include: {
        creator: {
          select: {
            id: true,
            bio: true,
            timezone: true,
            profileImage: true,
            bannerImage: true,
            socialLinks: true,
          },
        },
      },
    });

    if (!user || user.role !== 'CREATOR' || !user.creator) {
      return NextResponse.json(
        { error: 'Accès réservé aux créateurs' },
        { status: 403 }
      );
    }

    return NextResponse.json({ creator: user.creator });
  } catch (error: any) {
    console.error('Error fetching creator profile:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du profil' },
      { status: 500 }
    );
  }
}

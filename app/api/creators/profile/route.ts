import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

const updateCreatorProfileSchema = z.object({
  bio: z.string().optional(),
  expertise: z.string().optional(),
  timezone: z.string().optional(),
  profileImage: z.string().url().optional().nullable(),
  bannerImage: z.string().url().optional().nullable(),
  socialLinks: z
    .object({
      instagram: z.string().url().optional().nullable(),
      tiktok: z.string().url().optional().nullable(),
      twitter: z.string().url().optional().nullable(),
      youtube: z.string().url().optional().nullable(),
      other: z.string().url().optional().nullable(),
    })
    .optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Check if user is a creator
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
    const validatedData = updateCreatorProfileSchema.parse(body);

    // Build update data dynamically
    const updateData: any = {};

    if (validatedData.bio !== undefined) {
      updateData.bio = validatedData.bio;
    }

    if (validatedData.timezone !== undefined) {
      updateData.timezone = validatedData.timezone;
    }

    if (validatedData.profileImage !== undefined) {
      updateData.profileImage = validatedData.profileImage;
    }

    if (validatedData.bannerImage !== undefined) {
      updateData.bannerImage = validatedData.bannerImage;
    }

    if (validatedData.socialLinks !== undefined) {
      updateData.socialLinks = validatedData.socialLinks;
    }

    // Update creator profile
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
      return NextResponse.json(
        { error: error.issues[0].message },
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

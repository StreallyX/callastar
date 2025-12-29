import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get user from JWT
    const jwtUser = await getUserFromRequest(request);

    if (!jwtUser) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Get full user data from database
    const user = await db.user.findUnique({
      where: { id: jwtUser.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        timezone: true,
        creator: {
          select: {
            id: true,
            bio: true,
            expertise: true,
            profileImage: true,
            bannerImage: true,
            socialLinks: true,
            timezone: true,
            isStripeOnboarded: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

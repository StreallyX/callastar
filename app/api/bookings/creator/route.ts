import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    if (user.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Accès refusé' },
        { status: 403 }
      );
    }

    // Get creator profile
    const creator = await db.creator.findUnique({
      where: { userId: user.userId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Profil créateur introuvable' },
        { status: 404 }
      );
    }

    // Get all bookings for this creator's call offers
    const bookings = await db.booking.findMany({
      where: {
        callOffer: {
          creatorId: creator.id,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        callOffer: {
          include: {
            creator: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        payment: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ bookings }, { status: 200 });
  } catch (error) {
    console.error('Get creator bookings error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        callOffer: {
          include: {
            creator: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        payment: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Réservation introuvable' },
        { status: 404 }
      );
    }

    // Check ownership (user or creator)
    const isOwner = booking.userId === user.userId;
    const isCreator = booking.callOffer.creator.userId === user.userId;

    if (!isOwner && !isCreator) {
      return NextResponse.json(
        { error: 'Accès refusé' },
        { status: 403 }
      );
    }

    return NextResponse.json({ booking }, { status: 200 });
  } catch (error) {
    console.error('Get booking error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

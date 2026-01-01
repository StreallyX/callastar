import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { sanitizeDecimals } from '@/lib/decimal-utils';

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

    // ✅ Convert Decimal to number to avoid React warnings
    const sanitizedBookings = sanitizeDecimals(bookings);

    // 🐛 DEBUG: Log des prix pour identifier le problème NaN
    if (sanitizedBookings.length > 0) {
      const firstBooking = sanitizedBookings[0];
      console.log('[DEBUG] First booking price details:', {
        rawPrice: bookings[0]?.callOffer?.price,
        rawPriceType: typeof bookings[0]?.callOffer?.price,
        rawPriceConstructor: bookings[0]?.callOffer?.price?.constructor?.name,
        sanitizedPrice: firstBooking?.callOffer?.price,
        sanitizedPriceType: typeof firstBooking?.callOffer?.price,
        isNaN: isNaN(Number(firstBooking?.callOffer?.price)),
      });
    }

    return NextResponse.json({ bookings: sanitizedBookings }, { status: 200 });
  } catch (error) {
    console.error('Get creator bookings error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

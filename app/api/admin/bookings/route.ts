import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

// GET - Get all bookings (admin only)
export async function GET(req: NextRequest) {
  try {
    const tokenValue = req.cookies.get('auth-token')?.value;
    if (!tokenValue) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const token = await verifyToken(tokenValue);
    if (!token || token.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const bookings = await prisma.booking.findMany({
      include: {
        user: true,
        callOffer: {
          include: {
            creator: {
              include: {
                user: true,
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

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des réservations' },
      { status: 500 }
    );
  }
}

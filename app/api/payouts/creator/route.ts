import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/payouts/creator
 * Get all payouts for the authenticated creator
 */
export async function GET(request: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const creator = await db.creator.findUnique({
      where: { userId: jwtUser.userId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    // Get all payments for this creator's bookings
    const payments = await db.payment.findMany({
      where: {
        booking: {
          callOffer: {
            creatorId: creator.id,
          },
        },
      },
      include: {
        booking: {
          include: {
            callOffer: {
              select: {
                title: true,
                dateTime: true,
              },
            },
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate totals
    const totalEarnings = payments
      .filter(p => p.payoutStatus === 'PAID')
      .reduce((sum, p) => sum + Number(p.creatorAmount), 0);
    
    const pendingEarnings = payments
      .filter(p => p.payoutStatus === 'HELD' || p.payoutStatus === 'READY')
      .reduce((sum, p) => sum + Number(p.creatorAmount), 0);
    
    const readyForPayout = payments
      .filter(p => p.payoutStatus === 'READY')
      .reduce((sum, p) => sum + Number(p.creatorAmount), 0);

    return NextResponse.json({
      payments,
      summary: {
        totalEarnings,
        pendingEarnings,
        readyForPayout,
      },
    });
  } catch (error) {
    console.error('Error fetching creator payouts:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paiements' },
      { status: 500 }
    );
  }
}

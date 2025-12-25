import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/payouts/requests
 * Get all payout requests for the authenticated creator
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

    // Get all payout requests for this creator
    const payoutRequests = await db.payoutRequest.findMany({
      where: {
        creatorId: creator.id,
      },
      include: {
        payments: {
          select: {
            id: true,
            amount: true,
            creatorAmount: true,
            createdAt: true,
          },
        },
        creator: {
          include: {
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

    // Add payment count and summary to each request
    const requestsWithSummary = payoutRequests.map(req => ({
      ...req,
      paymentCount: req.payments.length,
    }));

    return NextResponse.json({
      payoutRequests: requestsWithSummary,
    });
  } catch (error) {
    console.error('Error fetching payout requests:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des demandes de paiement' },
      { status: 500 }
    );
  }
}

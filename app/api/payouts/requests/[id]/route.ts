import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/payouts/requests/[id]
 * Get specific payout request details for the authenticated creator
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Get the specific payout request
    const payoutRequest = await db.payoutRequest.findFirst({
      where: {
        id,
        creatorId: creator.id, // Ensure creator can only access their own requests
      },
      include: {
        payments: {
          include: {
            booking: {
              include: {
                callOffer: {
                  select: {
                    title: true,
                    description: true,
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
    });

    if (!payoutRequest) {
      return NextResponse.json(
        { error: 'Demande de paiement introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      payoutRequest: {
        ...payoutRequest,
        paymentCount: payoutRequest.payments.length,
      },
    });
  } catch (error) {
    console.error('Error fetching payout request:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la demande de paiement' },
      { status: 500 }
    );
  }
}

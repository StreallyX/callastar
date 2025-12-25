import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/admin/payout-requests
 * Get all payout requests (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé - Accès administrateur requis' },
        { status: 403 }
      );
    }

    // Get URL search params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Filter by status if provided

    // Build where clause
    const whereClause: any = {};
    if (status && ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(status)) {
      whereClause.status = status;
    }

    // Get all payout requests with creator info
    const payoutRequests = await db.payoutRequest.findMany({
      where: whereClause,
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
        payments: {
          select: {
            id: true,
            amount: true,
            creatorAmount: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Add summary information
    const requestsWithSummary = payoutRequests.map(req => ({
      ...req,
      paymentCount: req.payments.length,
      creatorName: req.creator.user.name,
      creatorEmail: req.creator.user.email,
    }));

    return NextResponse.json({
      payoutRequests: requestsWithSummary,
      totalCount: requestsWithSummary.length,
    });
  } catch (error) {
    console.error('Error fetching payout requests (admin):', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des demandes de paiement' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { PayoutStatus } from '@prisma/client';

/**
 * GET /api/payouts/creator
 * ✅ PHASE 3: Get all PAYOUTS (not payments) for the authenticated creator
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

    // ✅ PHASE 3: Get all PAYOUTS for this creator (not payments)
    const payouts = await db.payout.findMany({
      where: {
        creatorId: creator.id,
      },
      include: {
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        requestedAt: 'desc',
      },
    });

    // Parse query params for filtering
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    // Filter by status if provided
    let filteredPayouts = payouts;
    if (statusFilter && statusFilter !== 'all') {
      filteredPayouts = payouts.filter(p => p.status === statusFilter);
    }

    // Calculate totals based on payout statuses
    const totalPaid = payouts
      .filter(p => p.status === PayoutStatus.PAID)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    
    const totalRequested = payouts
      .filter(p => p.status === PayoutStatus.REQUESTED)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    
    const totalApproved = payouts
      .filter(p => p.status === PayoutStatus.APPROVED || p.status === PayoutStatus.PROCESSING)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalRejected = payouts
      .filter(p => p.status === PayoutStatus.REJECTED || p.status === PayoutStatus.FAILED)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return NextResponse.json({
      payouts: filteredPayouts,
      summary: {
        totalPaid,
        totalRequested,
        totalApproved,
        totalRejected,
        totalPayouts: payouts.length,
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

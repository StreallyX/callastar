import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Verify user is authenticated as creator
    const jwtUser = await getUserFromRequest(req);
    if (!jwtUser || jwtUser.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Get creator
    const creator = await db.creator.findUnique({
      where: { userId: jwtUser.userId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Compte créateur non trouvé' },
        { status: 404 }
      );
    }

    // Get pagination parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Fetch payout audit logs for this creator
    const logs = await db.payoutAuditLog.findMany({
      where: {
        creatorId: creator.id,
        action: {
          in: ['TRIGGERED', 'COMPLETED', 'FAILED'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    // Count total logs
    const total = await db.payoutAuditLog.count({
      where: {
        creatorId: creator.id,
        action: {
          in: ['TRIGGERED', 'COMPLETED', 'FAILED'],
        },
      },
    });

    // Format the logs
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      amount: log.amount ? Number(log.amount) : 0,
      stripePayoutId: log.stripePayoutId,
      metadata: log.metadata,
      triggeredBy: log.adminId ? 'Admin' : 'Automatic',
      adminId: log.adminId,
      createdAt: log.createdAt,
      status: getStatusFromAction(log.action),
    }));

    return NextResponse.json({
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + logs.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching payout history:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'historique' },
      { status: 500 }
    );
  }
}

// Helper function to map action to status
function getStatusFromAction(action: string): string {
  switch (action) {
    case 'TRIGGERED':
      return 'En cours';
    case 'COMPLETED':
      return 'Payé';
    case 'FAILED':
      return 'Échoué';
    default:
      return 'Inconnu';
  }
}

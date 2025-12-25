import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/payouts/update-status
 * Cron job to check and update payment statuses from HELD to READY
 * This should be called daily to check if any payments have passed the holding period
 */
export async function POST(request: NextRequest) {
  try {
    // Simple auth check - in production, use a cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Find all HELD payments where the release date has passed
    const now = new Date();
    const paymentsToUpdate = await db.payment.findMany({
      where: {
        payoutStatus: 'HELD',
        payoutReleaseDate: {
          lte: now,
        },
      },
    });

    if (paymentsToUpdate.length === 0) {
      return NextResponse.json({
        message: 'No payments to update',
        updatedCount: 0,
      });
    }

    // Update payments to READY status
    const result = await db.payment.updateMany({
      where: {
        id: { in: paymentsToUpdate.map((p) => p.id) },
      },
      data: {
        payoutStatus: 'READY',
      },
    });

    return NextResponse.json({
      message: `Updated ${result.count} payments to READY status`,
      updatedCount: result.count,
      paymentIds: paymentsToUpdate.map((p) => p.id),
    });
  } catch (error) {
    console.error('Error updating payment statuses:', error);
    return NextResponse.json(
      { error: 'Error updating payment statuses' },
      { status: 500 }
    );
  }
}

// Allow GET for testing in development
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }
  
  // In development, allow calling without auth for testing
  return POST(request);
}

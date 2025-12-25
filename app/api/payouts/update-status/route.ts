import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/payouts/update-status
 * Cron job to check and update payment statuses from HELD to READY
 * This should be called daily to check if any payments have passed the holding period
 * 
 * Authentication: Requires CRON_SECRET in Authorization header
 * Schedule: Configured to run daily at 02:00 UTC via Vercel Cron
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🔄 [CRON] Payout status update job started at:', new Date().toISOString());
    
    // Authenticate cron job request
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ [CRON] Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    console.log('✅ [CRON] Authentication successful');

    // Find all HELD payments where the release date has passed
    const now = new Date();
    console.log('🔍 [CRON] Searching for HELD payments with release date <=', now.toISOString());
    
    const paymentsToUpdate = await db.payment.findMany({
      where: {
        payoutStatus: 'HELD',
        payoutReleaseDate: {
          lte: now,
        },
      },
      include: {
        booking: {
          include: {
            offer: {
              include: {
                creator: {
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
      },
    });

    console.log(`📊 [CRON] Found ${paymentsToUpdate.length} payments ready to be updated`);

    if (paymentsToUpdate.length === 0) {
      const duration = Date.now() - startTime;
      console.log(`✅ [CRON] No payments to update. Job completed in ${duration}ms`);
      
      return NextResponse.json({
        success: true,
        message: 'No payments to update',
        updatedCount: 0,
        timestamp: now.toISOString(),
        duration: `${duration}ms`,
      });
    }

    // Log details about payments being updated
    console.log('💰 [CRON] Payments to be updated:');
    paymentsToUpdate.forEach((payment, index) => {
      console.log(`  ${index + 1}. Payment ID: ${payment.id}`);
      console.log(`     Amount: €${payment.creatorAmount}`);
      console.log(`     Creator: ${payment.booking.offer.creator.name} (${payment.booking.offer.creator.email})`);
      console.log(`     Release Date: ${payment.payoutReleaseDate?.toISOString()}`);
    });

    // Update payments to READY status
    console.log('🔄 [CRON] Updating payment statuses from HELD to READY...');
    
    const result = await db.payment.updateMany({
      where: {
        id: { in: paymentsToUpdate.map((p) => p.id) },
      },
      data: {
        payoutStatus: 'READY',
      },
    });

    const duration = Date.now() - startTime;
    
    console.log(`✅✅✅ [CRON] Successfully updated ${result.count} payments to READY status`);
    console.log(`⏱️  [CRON] Total execution time: ${duration}ms`);
    console.log(`📅 [CRON] Next run: Tomorrow at 02:00 UTC`);

    return NextResponse.json({
      success: true,
      message: `Updated ${result.count} payments to READY status`,
      updatedCount: result.count,
      paymentIds: paymentsToUpdate.map((p) => p.id),
      payments: paymentsToUpdate.map((p) => ({
        id: p.id,
        amount: p.creatorAmount,
        creatorName: p.booking.offer.creator.name,
        releaseDate: p.payoutReleaseDate,
      })),
      timestamp: now.toISOString(),
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌❌❌ [CRON] Error updating payment statuses:', error);
    console.error('⏱️  [CRON] Failed after:', `${duration}ms`);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Error updating payment statuses',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}

// Allow GET for testing in development
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    console.error('❌ [CRON] GET method not available in production');
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }
  
  console.log('🧪 [CRON] Development mode: Running via GET request');
  // In development, allow calling without auth for testing
  return POST(request);
}

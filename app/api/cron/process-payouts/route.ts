import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createPayout } from '@/lib/stripe';
import { getPlatformSettings } from '@/lib/settings';
import { logPayout, logTransaction } from '@/lib/logger';
import { TransactionEventType, PayoutStatus, EntityType } from '@prisma/client';
import {
  checkPayoutEligibility,
  calculateNextPayoutDate,
  clearBalanceCache,
} from '@/lib/payout-eligibility';

/**
 * GET /api/cron/process-payouts
 * 
 * Automatic payout scheduler endpoint
 * Should be called by a cron job (e.g., daily at 2 AM UTC)
 * 
 * Security: Requires CRON_SECRET to match environment variable
 * 
 * Processes automatic payouts for all eligible creators:
 * 1. Finds creators with automatic payout schedules due for payout
 * 2. Checks eligibility for each creator
 * 3. Creates Stripe payouts for eligible creators
 * 4. Updates payout schedules with next payout date
 * 5. Logs all operations
 * 
 * Returns summary of processed payouts
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const summary = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [] as Array<{ creatorId: string; error: string }>,
  };

  try {
    // 1. Verify cron secret for security
    const cronSecret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      console.error('CRON_SECRET not configured in environment variables');
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    if (cronSecret !== expectedSecret) {
      console.error('Invalid cron secret provided');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🤖 [CRON] Starting automatic payout processing...');

    // 2. Get platform settings
    const settings = await getPlatformSettings();
    const now = new Date();

    // 3. Find all creators with automatic payouts due
    const payoutSchedules = await prisma.payoutScheduleNew.findMany({
      where: {
        mode: 'AUTOMATIC',
        isActive: true,
        OR: [
          { nextPayoutDate: null }, // Never run before
          { nextPayoutDate: { lte: now } }, // Due for payout
        ],
      },
      include: {
        creator: {
          select: {
            id: true,
            stripeAccountId: true,
            payoutBlocked: true,
            payoutBlockedReason: true,
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

    console.log(`🤖 [CRON] Found ${payoutSchedules.length} creators with automatic payouts scheduled`);

    // 4. Process each creator
    for (const schedule of payoutSchedules) {
      summary.processed++;
      const creator = schedule.creator;

      try {
        console.log(`🤖 [CRON] Processing payout for creator ${creator.id} (${creator.user.email})...`);

        // 5. Check eligibility
        const eligibility = await checkPayoutEligibility(creator.id);

        if (!eligibility.eligible) {
          console.log(`⏭️  [CRON] Creator ${creator.id} not eligible: ${eligibility.reason}`);
          console.log(`   Requirements: ${eligibility.requirements?.join(', ')}`);
          
          summary.skipped++;
          
          // Log skipped payout
          await logTransaction({
            eventType: TransactionEventType.PAYOUT_FAILED,
            entityType: EntityType.PAYOUT,
            entityId: creator.id,
            amount: eligibility.availableBalance || 0,
            currency: settings.currency,
            status: 'SKIPPED',
            errorMessage: `Not eligible: ${eligibility.reason}`,
            metadata: {
              automatic: true,
              creatorId: creator.id,
              reason: eligibility.reason || 'Not eligible',
              requirements: eligibility.requirements || [],
              availableBalance: eligibility.availableBalance || 0,
            },
          });

          // Update next payout date even if not eligible (try again next time)
          const nextPayoutDate = calculateNextPayoutDate(schedule.frequency, now);
          await prisma.payoutScheduleNew.update({
            where: { id: schedule.id },
            data: { nextPayoutDate },
          });

          continue;
        }

        const availableBalance = eligibility.availableBalance || 0;
        console.log(`✓ [CRON] Creator ${creator.id} is eligible. Available balance: ${availableBalance.toFixed(2)} ${settings.currency}`);

        // 6. Get payments ready for payout
        const readyPayments = await prisma.payment.findMany({
          where: {
            payoutStatus: 'READY',
            booking: {
              callOffer: {
                creatorId: creator.id,
              },
            },
          },
          select: {
            id: true,
            creatorAmount: true,
          },
        });

        // Calculate total amount from ready payments
        const totalAmount = readyPayments.reduce(
          (sum, p) => sum + Number(p.creatorAmount),
          0
        );

        if (totalAmount === 0) {
          console.log(`⏭️  [CRON] No payments ready for payout for creator ${creator.id}`);
          summary.skipped++;

          // Update next payout date
          const nextPayoutDate = calculateNextPayoutDate(schedule.frequency, now);
          await prisma.payoutScheduleNew.update({
            where: { id: schedule.id },
            data: { nextPayoutDate },
          });

          continue;
        }

        console.log(`💰 [CRON] Creating payout of ${totalAmount.toFixed(2)} ${settings.currency} for ${readyPayments.length} payments`);

        // 7. Create payout record
        const payout = await prisma.payout.create({
          data: {
            creatorId: creator.id,
            amount: totalAmount,
            status: PayoutStatus.PROCESSING,
          },
        });

        // Log payout creation
        await logPayout(TransactionEventType.PAYOUT_CREATED, {
          payoutId: payout.id,
          creatorId: creator.id,
          amount: totalAmount,
          currency: settings.currency,
          status: PayoutStatus.PROCESSING,
          metadata: {
            automatic: true,
            paymentCount: readyPayments.length,
            paymentIds: readyPayments.map((p) => p.id),
            frequency: schedule.frequency,
          },
        });

        // Mark payments as processing
        await prisma.payment.updateMany({
          where: {
            id: { in: readyPayments.map((p) => p.id) },
          },
          data: {
            payoutStatus: 'PROCESSING',
          },
        });

        try {
          // 8. Create Stripe transfer
          const transfer = await createPayout({
            amount: totalAmount,
            stripeAccountId: creator.stripeAccountId!,
            metadata: {
              creatorId: creator.id,
              payoutId: payout.id,
              paymentIds: readyPayments.map((p) => p.id).join(','),
              paymentCount: String(readyPayments.length),
              automatic: 'true',
              frequency: schedule.frequency,
            },
          });

          // 9. Update payout status to paid
          await prisma.payout.update({
            where: { id: payout.id },
            data: {
              stripePayoutId: transfer.id,
              status: PayoutStatus.PAID,
            },
          });

          // Mark payments as paid
          await prisma.payment.updateMany({
            where: {
              id: { in: readyPayments.map((p) => p.id) },
            },
            data: {
              payoutStatus: 'PAID',
              stripeTransferId: transfer.id,
              payoutDate: new Date(),
            },
          });

          // Log successful payout
          await logPayout(TransactionEventType.PAYOUT_PAID, {
            payoutId: payout.id,
            creatorId: creator.id,
            amount: totalAmount,
            currency: settings.currency,
            status: PayoutStatus.PAID,
            stripePayoutId: transfer.id,
            metadata: {
              automatic: true,
              paymentCount: readyPayments.length,
              paymentIds: readyPayments.map((p) => p.id),
              stripeTransferId: transfer.id,
              frequency: schedule.frequency,
            },
          });

          // Clear balance cache
          clearBalanceCache(creator.id);

          console.log(`✅ [CRON] Payout successful for creator ${creator.id}: ${transfer.id}`);
          summary.succeeded++;
        } catch (error: any) {
          // Transfer failed
          console.error(`❌ [CRON] Transfer failed for creator ${creator.id}:`, error);

          // Update payout status to failed
          await prisma.payout.update({
            where: { id: payout.id },
            data: {
              status: PayoutStatus.FAILED,
              failureReason: error.message || 'Unknown error',
              retriedCount: { increment: 1 },
            },
          });

          // Mark payments back as READY
          await prisma.payment.updateMany({
            where: {
              id: { in: readyPayments.map((p) => p.id) },
            },
            data: {
              payoutStatus: 'READY',
            },
          });

          // Log failed payout
          await logPayout(TransactionEventType.PAYOUT_FAILED, {
            payoutId: payout.id,
            creatorId: creator.id,
            amount: totalAmount,
            currency: settings.currency,
            status: PayoutStatus.FAILED,
            errorMessage: error.message || 'Transfer failed',
            metadata: {
              automatic: true,
              paymentCount: readyPayments.length,
              error: error.message,
            },
          });

          summary.failed++;
          summary.errors.push({
            creatorId: creator.id,
            error: error.message || 'Unknown error',
          });
        }

        // 10. Update next payout date
        const nextPayoutDate = calculateNextPayoutDate(schedule.frequency, now);
        await prisma.payoutScheduleNew.update({
          where: { id: schedule.id },
          data: { nextPayoutDate },
        });

        console.log(`📅 [CRON] Next payout scheduled for ${nextPayoutDate.toISOString()}`);
      } catch (error: any) {
        console.error(`❌ [CRON] Error processing creator ${creator.id}:`, error);
        summary.failed++;
        summary.errors.push({
          creatorId: creator.id,
          error: error.message || 'Unknown error',
        });

        // Still update next payout date to avoid getting stuck
        try {
          const nextPayoutDate = calculateNextPayoutDate(schedule.frequency, now);
          await prisma.payoutScheduleNew.update({
            where: { id: schedule.id },
            data: { nextPayoutDate },
          });
        } catch (updateError) {
          console.error(`Failed to update next payout date for ${creator.id}:`, updateError);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`🤖 [CRON] Payout processing complete in ${duration}ms`);
    console.log(`📊 [CRON] Summary: ${summary.succeeded} succeeded, ${summary.failed} failed, ${summary.skipped} skipped`);

    return NextResponse.json({
      success: true,
      message: 'Automatic payout processing complete',
      summary: {
        ...summary,
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('❌ [CRON] Fatal error in payout processing:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
        summary,
      },
      { status: 500 }
    );
  }
}

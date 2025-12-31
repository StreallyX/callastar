import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createPayout } from '@/lib/stripe';
import { getPlatformSettings } from '@/lib/settings';
import { logPayout, logTransaction, logCronRun, logCronError } from '@/lib/logger';
import { TransactionEventType, PayoutStatus, EntityType, LogActor } from '@prisma/client';
import {
  checkPayoutEligibility,
  calculateNextPayoutDate,
  clearBalanceCache,
} from '@/lib/payout-eligibility';
import { createNotification } from '@/lib/notifications';

// Force dynamic rendering for cron routes (prevents static rendering errors)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
            payoutStatus: 'APPROVED',
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

        // ✅ NEW: Create payout record with REQUESTED status (await admin approval)
        const payout = await prisma.payout.create({
          data: {
            creatorId: creator.id,
            amount: totalAmount,
            status: PayoutStatus.REQUESTED, // ✅ Wait for admin approval even for automatic payouts
          },
        });

        // Log payout creation
        await logPayout(TransactionEventType.PAYOUT_CREATED, {
          payoutId: payout.id,
          creatorId: creator.id,
          amount: totalAmount,
          currency: settings.currency,
          status: PayoutStatus.REQUESTED,
          metadata: {
            automatic: true,
            paymentCount: readyPayments.length,
            paymentIds: readyPayments.map((p) => p.id),
            frequency: schedule.frequency,
            awaitingAdminApproval: true,
          },
        });

        // Create audit log entry
        await prisma.payoutAuditLog.create({
          data: {
            creatorId: creator.id,
            action: 'TRIGGERED',
            amount: totalAmount,
            status: PayoutStatus.REQUESTED,
            reason: `Paiement automatique de ${totalAmount.toFixed(2)} ${settings.currency} en attente d'approbation`,
            metadata: JSON.stringify({
              automatic: true,
              paymentCount: readyPayments.length,
              paymentIds: readyPayments.map((p) => p.id),
              frequency: schedule.frequency,
              awaitingAdminApproval: true,
            }),
          },
        });

        // ✅ NEW: Send notification to admin
        try {
          // Find all admin users
          const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            select: { id: true },
          });

          // Send notification to each admin
          for (const admin of admins) {
            await createNotification({
              userId: admin.id,
              type: 'SYSTEM',
              title: '💰 Nouvelle demande de paiement automatique',
              message: `Paiement automatique de ${totalAmount.toFixed(2)} ${settings.currency} pour ${creator.user.name}. Veuillez approuver ou rejeter la demande.`,
              link: '/dashboard/admin/payouts',
            });
          }
        } catch (error) {
          console.error('Error sending admin notifications:', error);
          // Non-critical error, continue
        }

        console.log(`✅ [CRON] Payout request created for creator ${creator.id}, awaiting admin approval`);
        summary.succeeded++;

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
    
    // ✅ Log successful cron execution with detailed info
    await logCronRun(
      'process-payouts',
      summary.processed,
      duration,
      {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        succeeded: summary.succeeded,
        failed: summary.failed,
        skipped: summary.skipped,
        errors: summary.errors,
      }
    );

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
    
    const duration = Date.now() - startTime;
    
    // ✅ Log cron error with detailed info
    await logCronError(
      'process-payouts',
      error,
      {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration,
        itemsProcessed: summary.processed,
        succeeded: summary.succeeded,
        failed: summary.failed,
        skipped: summary.skipped,
        errors: summary.errors,
      }
    );
    
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

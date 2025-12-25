import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import { PayoutStatus } from '@prisma/client';

/**
 * GET /api/admin/payouts/dashboard
 * 
 * Get comprehensive payout dashboard statistics for admin
 * Includes:
 * - Pending payouts count
 * - Failed payouts (last 30 days)
 * - Creators with blocked payouts
 * - Creators with eligibility issues
 * - Next scheduled payout date
 * - Total payout volume (last 30 days)
 * - Payment status summary
 * 
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Count pending payouts (scheduled but not executed)
    const pendingPayoutsCount = await prisma.payoutSchedule.count({
      where: {
        mode: 'AUTOMATIC',
        isActive: true,
        nextPayoutDate: {
          lte: now,
        },
      },
    });

    // 2. Count failed payouts (last 30 days)
    const failedPayouts = await prisma.payout.findMany({
      where: {
        status: PayoutStatus.FAILED,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      include: {
        creator: {
          select: {
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
      take: 10,
    });

    const failedPayoutsCount = failedPayouts.length;

    // 3. Count creators with blocked payouts
    const blockedCreators = await prisma.creator.findMany({
      where: {
        payoutBlocked: true,
      },
      select: {
        id: true,
        payoutBlockedReason: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    const blockedCreatorsCount = blockedCreators.length;

    // 4. Find creators with eligibility issues (Stripe not onboarded or account issues)
    const creatorsWithIssues = await prisma.creator.findMany({
      where: {
        OR: [
          { isStripeOnboarded: false },
          { stripeAccountId: null },
          { payoutBlocked: true },
        ],
      },
      select: {
        id: true,
        stripeAccountId: true,
        isStripeOnboarded: true,
        payoutBlocked: true,
        payoutBlockedReason: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      take: 20,
    });

    const creatorsWithIssuesCount = creatorsWithIssues.length;

    // 5. Find next scheduled payout date
    const nextScheduledPayout = await prisma.payoutSchedule.findFirst({
      where: {
        mode: 'AUTOMATIC',
        isActive: true,
        nextPayoutDate: {
          gte: now,
        },
      },
      orderBy: {
        nextPayoutDate: 'asc',
      },
      include: {
        creator: {
          select: {
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

    // 6. Calculate total payout volume (last 30 days)
    const payoutVolumeResult = await prisma.payout.aggregate({
      where: {
        status: PayoutStatus.PAID,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    const totalPayoutVolume = Number(payoutVolumeResult._sum.amount || 0);
    const successfulPayoutsCount = payoutVolumeResult._count;

    // 7. Payment status summary (payments ready for payout)
    const paymentsReadyCount = await prisma.payment.count({
      where: {
        payoutStatus: 'READY',
      },
    });

    const paymentsProcessingCount = await prisma.payment.count({
      where: {
        payoutStatus: 'PROCESSING',
      },
    });

    const paymentsHeldCount = await prisma.payment.count({
      where: {
        payoutStatus: 'HELD',
      },
    });

    // 8. Calculate total ready payout amount
    const readyPaymentsResult = await prisma.payment.aggregate({
      where: {
        payoutStatus: 'READY',
      },
      _sum: {
        creatorAmount: true,
      },
    });

    const totalReadyAmount = Number(readyPaymentsResult._sum.creatorAmount || 0);

    // 9. Get recent successful payouts
    const recentSuccessfulPayouts = await prisma.payout.findMany({
      where: {
        status: PayoutStatus.PAID,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      include: {
        creator: {
          select: {
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
      take: 10,
    });

    // 10. Get active payout schedules summary
    const activeSchedulesCount = await prisma.payoutSchedule.count({
      where: {
        isActive: true,
      },
    });

    const automaticSchedulesCount = await prisma.payoutSchedule.count({
      where: {
        mode: 'AUTOMATIC',
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        pendingPayouts: pendingPayoutsCount,
        failedPayouts: failedPayoutsCount,
        blockedCreators: blockedCreatorsCount,
        creatorsWithIssues: creatorsWithIssuesCount,
        successfulPayouts: successfulPayoutsCount,
        totalPayoutVolume: totalPayoutVolume.toFixed(2),
        currency: 'EUR',
        paymentsReady: paymentsReadyCount,
        paymentsProcessing: paymentsProcessingCount,
        paymentsHeld: paymentsHeldCount,
        totalReadyAmount: totalReadyAmount.toFixed(2),
        activeSchedules: activeSchedulesCount,
        automaticSchedules: automaticSchedulesCount,
      },
      nextScheduledPayout: nextScheduledPayout
        ? {
            creatorName: nextScheduledPayout.creator.user.name || nextScheduledPayout.creator.user.email,
            creatorEmail: nextScheduledPayout.creator.user.email,
            nextPayoutDate: nextScheduledPayout.nextPayoutDate,
            frequency: nextScheduledPayout.frequency,
          }
        : null,
      failedPayouts: failedPayouts.map((p) => ({
        id: p.id,
        creatorName: p.creator.user.name || p.creator.user.email,
        creatorEmail: p.creator.user.email,
        amount: Number(p.amount).toFixed(2),
        failureReason: p.failureReason,
        retriedCount: p.retriedCount,
        createdAt: p.createdAt,
      })),
      blockedCreators: blockedCreators.map((c) => ({
        id: c.id,
        name: c.user.name || c.user.email,
        email: c.user.email,
        reason: c.payoutBlockedReason,
      })),
      creatorsWithIssues: creatorsWithIssues.map((c) => ({
        id: c.id,
        name: c.user.name || c.user.email,
        email: c.user.email,
        issues: [
          !c.stripeAccountId && 'No Stripe account',
          !c.isStripeOnboarded && 'Stripe not onboarded',
          c.payoutBlocked && `Blocked: ${c.payoutBlockedReason || 'Unknown'}`,
        ].filter(Boolean),
      })),
      recentSuccessfulPayouts: recentSuccessfulPayouts.map((p) => ({
        id: p.id,
        creatorName: p.creator.user.name || p.creator.user.email,
        creatorEmail: p.creator.user.email,
        amount: Number(p.amount).toFixed(2),
        stripePayoutId: p.stripePayoutId,
        createdAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching payout dashboard:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du tableau de bord des paiements' },
      { status: 500 }
    );
  }
}

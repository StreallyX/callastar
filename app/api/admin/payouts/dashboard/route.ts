import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import { PayoutStatus } from '@prisma/client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

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
    const pendingPayoutsCount = await prisma.payoutScheduleNew.count({
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
    const nextScheduledPayout = await prisma.payoutScheduleNew.findFirst({
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

    // 6. Calculate total payout volume (last 30 days) - GROUPED BY CURRENCY
    const successfulPayouts = await prisma.payout.findMany({
      where: {
        status: PayoutStatus.PAID,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        amount: true,
        currency: true,
      },
    });

    // Group by currency
    const payoutVolumeByCurrency = successfulPayouts.reduce((acc, p) => {
      const currency = p.currency || 'EUR';
      acc[currency] = (acc[currency] || 0) + Number(p.amount);
      return acc;
    }, {} as Record<string, number>);

    const successfulPayoutsCount = successfulPayouts.length;

    // 7. Payment status summary (payments ready for payout)
    const paymentsReadyCount = await prisma.payment.count({
      where: {
        payoutStatus: 'APPROVED',
      },
    });

    const paymentsProcessingCount = await prisma.payment.count({
      where: {
        payoutStatus: 'PROCESSING',
      },
    });

    const paymentsHeldCount = await prisma.payment.count({
      where: {
        payoutStatus: 'REQUESTED',
      },
    });

    // 8. Calculate total ready payout amount - GROUPED BY CURRENCY
    const readyPayments = await prisma.payment.findMany({
      where: {
        payoutStatus: 'APPROVED',
      },
      select: {
        creatorAmount: true,
        currency: true,
      },
    });

    // Group by currency
    const readyAmountByCurrency = readyPayments.reduce((acc, p) => {
      const currency = p.currency || 'EUR';
      acc[currency] = (acc[currency] || 0) + Number(p.creatorAmount);
      return acc;
    }, {} as Record<string, number>);

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
    const activeSchedulesCount = await prisma.payoutScheduleNew.count({
      where: {
        isActive: true,
      },
    });

    const automaticSchedulesCount = await prisma.payoutScheduleNew.count({
      where: {
        mode: 'AUTOMATIC',
        isActive: true,
      },
    });

    // 11. Calculate platform fees by currency
    // ✅ CORRECTION #2: Utiliser platformFeePercentage au lieu de platformCommissionRate
    const platformSettings = await prisma.platformSettings.findFirst();
    const commissionRate = Number(platformSettings?.platformFeePercentage || 15);

    const feesByCurrency = Object.entries(payoutVolumeByCurrency).reduce((acc, [currency, amount]) => {
      acc[currency] = Number((Number(amount) * commissionRate / 100).toFixed(2));
      return acc;
    }, {} as Record<string, number>);

    // Format amounts by currency with proper decimals
    const formattedPayoutVolume = Object.entries(payoutVolumeByCurrency).reduce((acc, [currency, amount]) => {
      acc[currency] = Number(Number(amount).toFixed(2));
      return acc;
    }, {} as Record<string, number>);

    const formattedReadyAmount = Object.entries(readyAmountByCurrency).reduce((acc, [currency, amount]) => {
      acc[currency] = Number(Number(amount).toFixed(2));
      return acc;
    }, {} as Record<string, number>);

    // 12. Get Stripe Balance (available and pending amounts by currency)
    let stripeBalance: Record<string, { available: number; pending: number }> = {};
    try {
      const balance = await stripe.balance.retrieve();
      
      // Process available balance
      balance.available.forEach((bal) => {
        const currency = bal.currency.toUpperCase();
        stripeBalance[currency] = {
          available: bal.amount / 100, // Convert from cents
          pending: stripeBalance[currency]?.pending || 0,
        };
      });

      // Process pending balance
      balance.pending.forEach((bal) => {
        const currency = bal.currency.toUpperCase();
        stripeBalance[currency] = {
          available: stripeBalance[currency]?.available || 0,
          pending: bal.amount / 100, // Convert from cents
        };
      });

      // Format to 2 decimals
      stripeBalance = Object.entries(stripeBalance).reduce((acc, [currency, data]) => {
        acc[currency] = {
          available: Number(data.available.toFixed(2)),
          pending: Number(data.pending.toFixed(2)),
        };
        return acc;
      }, {} as Record<string, { available: number; pending: number }>);
    } catch (error) {
      console.error('Error retrieving Stripe balance:', error);
      // Continue without Stripe balance data
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        pendingPayouts: pendingPayoutsCount,
        failedPayouts: failedPayoutsCount,
        blockedCreators: blockedCreatorsCount,
        creatorsWithIssues: creatorsWithIssuesCount,
        successfulPayouts: successfulPayoutsCount,
        totalPayoutVolumeByCurrency: formattedPayoutVolume,
        totalFeesByCurrency: feesByCurrency,
        paymentsReady: paymentsReadyCount,
        paymentsProcessing: paymentsProcessingCount,
        paymentsHeld: paymentsHeldCount,
        totalReadyAmountByCurrency: formattedReadyAmount,
        activeSchedules: activeSchedulesCount,
        automaticSchedules: automaticSchedulesCount,
        stripeBalance: stripeBalance,
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
        currency: p.currency || 'EUR',
        failureReason: p.failureReason,
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
        currency: p.currency || 'EUR',
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

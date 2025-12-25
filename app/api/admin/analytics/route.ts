import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

/**
 * GET /api/admin/analytics
 * Get platform analytics and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // days
    const periodDays = parseInt(period, 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Get all payments
    const allPayments = await db.payment.findMany({
      include: {
        booking: {
          include: {
            callOffer: {
              include: {
                creator: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Get payments in the selected period
    const periodPayments = allPayments.filter(
      (p) => new Date(p.createdAt) >= startDate
    );

    // Calculate total platform fees collected (all time)
    const totalPlatformFees = allPayments.reduce(
      (sum, p) => sum + Number(p.platformFee),
      0
    );

    // Calculate platform fees in period
    const periodPlatformFees = periodPayments.reduce(
      (sum, p) => sum + Number(p.platformFee),
      0
    );

    // Calculate total revenue (all time)
    const totalRevenue = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Calculate period revenue
    const periodRevenue = periodPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    // Calculate total creator earnings (all time)
    const totalCreatorEarnings = allPayments.reduce(
      (sum, p) => sum + Number(p.creatorAmount),
      0
    );

    // Calculate period creator earnings
    const periodCreatorEarnings = periodPayments.reduce(
      (sum, p) => sum + Number(p.creatorAmount),
      0
    );

    // Get payout statistics
    const allPayouts = await db.payout.findMany({
      include: {
        creator: {
          include: {
            user: true,
          },
        },
      },
    });

    const pendingPayouts = allPayouts.filter((p) => p.status === 'PENDING');
    const processingPayouts = allPayouts.filter((p) => p.status === 'PROCESSING');
    const completedPayouts = allPayouts.filter(
      (p) => p.status === 'PAID' && p.completedAt && new Date(p.completedAt) >= startDate
    );
    const allCompletedPayouts = allPayouts.filter((p) => p.status === 'PAID');

    const pendingPayoutAmount = pendingPayouts.reduce(
      (sum, p) => sum + Number(p.requestedAmount),
      0
    );

    const processingPayoutAmount = processingPayouts.reduce(
      (sum, p) => sum + Number(p.requestedAmount),
      0
    );

    const completedPayoutAmount = completedPayouts.reduce(
      (sum, p) => sum + Number(p.actualAmount || p.requestedAmount),
      0
    );

    const totalCompletedPayoutAmount = allCompletedPayouts.reduce(
      (sum, p) => sum + Number(p.actualAmount || p.requestedAmount),
      0
    );

    // Payment status breakdown
    const paymentsByStatus = {
      held: allPayments.filter((p) => p.payoutStatus === 'HELD').length,
      ready: allPayments.filter((p) => p.payoutStatus === 'READY').length,
      processing: allPayments.filter((p) => p.payoutStatus === 'PROCESSING').length,
      paid: allPayments.filter((p) => p.payoutStatus === 'PAID').length,
      failed: allPayments.filter((p) => p.payoutStatus === 'FAILED').length,
    };

    // Calculate daily revenue for charts
    const dailyRevenueMap = new Map<string, number>();
    const dailyFeesMap = new Map<string, number>();
    const dailyPayoutsMap = new Map<string, number>();

    periodPayments.forEach((payment) => {
      const date = new Date(payment.createdAt).toISOString().split('T')[0];
      dailyRevenueMap.set(date, (dailyRevenueMap.get(date) || 0) + Number(payment.amount));
      dailyFeesMap.set(date, (dailyFeesMap.get(date) || 0) + Number(payment.platformFee));
    });

    completedPayouts.forEach((payout) => {
      if (payout.completedAt) {
        const date = new Date(payout.completedAt).toISOString().split('T')[0];
        dailyPayoutsMap.set(
          date,
          (dailyPayoutsMap.get(date) || 0) +
            Number(payout.actualAmount || payout.requestedAmount)
        );
      }
    });

    // Convert maps to sorted arrays
    const dailyRevenue = Array.from(dailyRevenueMap.entries())
      .map(([date, amount]) => ({ date, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const dailyFees = Array.from(dailyFeesMap.entries())
      .map(([date, amount]) => ({ date, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const dailyPayouts = Array.from(dailyPayoutsMap.entries())
      .map(([date, amount]) => ({ date, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top creators by revenue
    const creatorRevenueMap = new Map<string, { name: string; email: string; revenue: number }>();

    periodPayments.forEach((payment) => {
      const creator = payment.booking.callOffer.creator;
      const creatorId = creator.id;
      const existing = creatorRevenueMap.get(creatorId);
      
      if (existing) {
        existing.revenue += Number(payment.creatorAmount);
      } else {
        creatorRevenueMap.set(creatorId, {
          name: creator.user.name,
          email: creator.user.email,
          revenue: Number(payment.creatorAmount),
        });
      }
    });

    const topCreators = Array.from(creatorRevenueMap.values())
      .map((c) => ({
        ...c,
        revenue: Number(c.revenue.toFixed(2)),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Get current balances
    const readyPayments = await db.payment.findMany({
      where: { payoutStatus: 'READY' },
    });

    const totalReadyBalance = readyPayments.reduce(
      (sum, p) => sum + Number(p.creatorAmount),
      0
    );

    const heldPayments = await db.payment.findMany({
      where: { payoutStatus: 'HELD' },
    });

    const totalHeldBalance = heldPayments.reduce(
      (sum, p) => sum + Number(p.creatorAmount),
      0
    );

    return NextResponse.json({
      period: {
        days: periodDays,
        startDate,
        endDate: new Date(),
      },
      revenue: {
        total: Number(totalRevenue.toFixed(2)),
        period: Number(periodRevenue.toFixed(2)),
        dailyRevenue,
      },
      platformFees: {
        total: Number(totalPlatformFees.toFixed(2)),
        period: Number(periodPlatformFees.toFixed(2)),
        dailyFees,
      },
      creatorEarnings: {
        total: Number(totalCreatorEarnings.toFixed(2)),
        period: Number(periodCreatorEarnings.toFixed(2)),
      },
      payouts: {
        pending: {
          count: pendingPayouts.length,
          amount: Number(pendingPayoutAmount.toFixed(2)),
        },
        processing: {
          count: processingPayouts.length,
          amount: Number(processingPayoutAmount.toFixed(2)),
        },
        completed: {
          count: completedPayouts.length,
          amount: Number(completedPayoutAmount.toFixed(2)),
          totalAllTime: Number(totalCompletedPayoutAmount.toFixed(2)),
        },
        dailyPayouts,
      },
      balances: {
        ready: Number(totalReadyBalance.toFixed(2)),
        held: Number(totalHeldBalance.toFixed(2)),
        total: Number((totalReadyBalance + totalHeldBalance).toFixed(2)),
      },
      payments: {
        total: allPayments.length,
        period: periodPayments.length,
        byStatus: paymentsByStatus,
      },
      topCreators,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des analytics' },
      { status: 500 }
    );
  }
}

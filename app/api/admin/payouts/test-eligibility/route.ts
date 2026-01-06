import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { checkPayoutEligibility, getCreatorAvailableBalance } from '@/lib/payout-eligibility';
import { getPlatformSettings } from '@/lib/settings';

/**
 * POST /api/admin/payouts/test-eligibility
 * 
 * Test payout eligibility for a creator (Development/Testing only)
 * Returns comprehensive eligibility details including Stripe account info
 * 
 * Body:
 * - creatorId: string (required)
 * 
 * Admin only
 * Only available in development mode (NODE_ENV !== 'production')
 */
export async function POST(request: NextRequest) {
  try {
    // Check if development mode
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development mode' },
        { status: 403 }
      );
    }

    // Verify admin access
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { creatorId } = body;

    if (!creatorId) {
      return NextResponse.json(
        { error: 'creatorId is required' },
        { status: 400 }
      );
    }

    // Get creator
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        payoutScheduleNew: true,
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    // Get platform settings
    const settings = await getPlatformSettings();

    // Check eligibility
    const eligibility = await checkPayoutEligibility(creatorId);

    // Get Stripe account details if available
    let stripeAccountDetails = null;
    let stripeBalance = null;

    if (creator.stripeAccountId) {
      try {
        const account = await stripe.accounts.retrieve(creator.stripeAccountId);
        stripeAccountDetails = {
          id: account.id,
          type: account.type,
          country: account.country,
          default_currency: account.default_currency,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          requirements: {
            currently_due: account.requirements?.currently_due || [],
            eventually_due: account.requirements?.eventually_due || [],
            past_due: account.requirements?.past_due || [],
            disabled_reason: account.requirements?.disabled_reason || null,
          },
          capabilities: account.capabilities,
          external_accounts: {
            total_count: account.external_accounts?.data?.length || 0,
            data: account.external_accounts?.data?.map((acc: any) => ({
              id: acc.id,
              object: acc.object,
              bank_name: acc.bank_name,
              last4: acc.last4,
              currency: acc.currency,
              status: acc.status,
            })) || [],
          },
          created: account.created ? new Date(account.created * 1000).toISOString() : null,
        };

        // Get balance
        const balance = await stripe.balance.retrieve({
          stripeAccount: creator.stripeAccountId,
        });

        stripeBalance = {
          available: balance.available.map((b) => ({
            amount: b.amount / 100,
            currency: b.currency,
          })),
          pending: balance.pending.map((b) => ({
            amount: b.amount / 100,
            currency: b.currency,
          })),
        };
      } catch (error: any) {
        console.error('Error fetching Stripe account details:', error);
        stripeAccountDetails = {
          error: error.message || 'Failed to fetch Stripe account',
        };
      }
    }

    // Get available balance
    const availableBalance = await getCreatorAvailableBalance(creatorId);

    // Get payments by status
    const paymentsByStatus = await prisma.payment.groupBy({
      by: ['payoutStatus'],
      where: {
        booking: {
          callOffer: {
            creatorId,
          },
        },
      },
      _count: true,
      _sum: {
        creatorAmount: true,
      },
    });

    // Get recent payments
    const recentPayments = await prisma.payment.findMany({
      where: {
        booking: {
          callOffer: {
            creatorId,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        amount: true,
        creatorAmount: true,
        status: true,
        payoutStatus: true,
        createdAt: true,
        stripePaymentIntentId: true,
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      creator: {
        id: creator.id,
        name: creator.user.name,
        email: creator.user.email,
        stripeAccountId: creator.stripeAccountId,
        isStripeOnboarded: creator.isStripeOnboarded,
        payoutBlocked: creator.payoutBlocked,
        payoutBlockReason: creator.payoutBlockReason,
      },
      payoutSchedule: creator.payoutScheduleNew,
      platformSettings: {
        minimumPayoutAmount: settings.minimumPayoutAmount,
        holdingPeriodDays: settings.holdingPeriodDays,
        currency: settings.currency,
      },
      eligibility,
      availableBalance,
      stripeAccountDetails,
      stripeBalance,
      paymentsSummary: {
        byStatus: paymentsByStatus.map((group) => ({
          status: group.payoutStatus,
          count: group._count,
          totalAmount: Number(group._sum.creatorAmount || 0).toFixed(2),
        })),
        recentPayments: recentPayments.map((p) => ({
          id: p.id,
          amount: Number(p.amount).toFixed(2),
          creatorAmount: Number(p.creatorAmount).toFixed(2),
          status: p.status,
          payoutStatus: p.payoutStatus,
          createdAt: p.createdAt,
          stripePaymentIntentId: p.stripePaymentIntentId,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error testing payout eligibility:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

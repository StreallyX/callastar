import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { PaymentStatus, PayoutStatus } from '@prisma/client';

/**
 * GET /api/creator/earnings
 * ✅ FIX: Get real PAYMENTS (not payouts) for earnings and payments pages
 * Connects to Stripe Balance API for real-time data
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

    // ✅ Get all PAYMENTS for this creator (via bookings)
    const payments = await db.payment.findMany({
      where: {
        booking: {
          callOffer: {
            creatorId: creator.id,
          },
        },
        status: PaymentStatus.SUCCEEDED, // Only successful payments
      },
      include: {
        booking: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            callOffer: {
              select: {
                id: true,
                title: true,
                dateTime: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // ✅ Calculate earnings from Stripe Balance (source of truth)
    let stripeBalance = null;
    let totalEarnings = 0;
    let pendingEarnings = 0;
    let readyForPayout = 0;

    if (creator.stripeAccountId && creator.isStripeOnboarded) {
      try {
        const balance = await stripe.balance.retrieve({
          stripeAccount: creator.stripeAccountId,
        });

        // Calculate totals from Stripe Balance
        readyForPayout = balance.available.reduce((sum, b) => sum + (b.amount / 100), 0);
        pendingEarnings = balance.pending.reduce((sum, b) => sum + (b.amount / 100), 0);

        stripeBalance = {
          available: readyForPayout,
          pending: pendingEarnings,
        };
      } catch (stripeError) {
        console.error('Error fetching Stripe balance:', stripeError);
        // Continue without Stripe data
      }
    }

    // ✅ Calculate total earnings from DB (all PAID transfers)
    // ✅ FIX: Use gross amount (what users paid), not net after commission
    const paidPayments = payments.filter(p => p.payoutStatus === PayoutStatus.PAID);
    totalEarnings = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    // ✅ Calculate pending earnings from DB (PROCESSING status - in holding period)
    // ✅ FIX: Use gross amount (what users paid), not net after commission
    const processingPayments = payments.filter(p => p.payoutStatus === PayoutStatus.PROCESSING);
    const dbPendingEarnings = processingPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    // ✅ Calculate ready for payout from DB (APPROVED status - ready for payout)
    // ✅ FIX: Use gross amount (what users paid), not net after commission
    const approvedPayments = payments.filter(p => p.payoutStatus === PayoutStatus.APPROVED);
    const dbReadyForPayout = approvedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    // ✅ Use Stripe as source of truth if available, otherwise use DB
    const finalPendingEarnings = stripeBalance ? stripeBalance.pending : dbPendingEarnings;
    const finalReadyForPayout = stripeBalance ? stripeBalance.available : dbReadyForPayout;

    return NextResponse.json({
      payments: payments.map(p => ({
        id: p.id,
        amount: Number(p.amount),
        creatorAmount: Number(p.creatorAmount),
        platformFee: Number(p.platformFee),
        currency: p.currency,
        status: p.status,
        payoutStatus: p.payoutStatus,
        payoutReleaseDate: p.payoutReleaseDate,
        payoutDate: p.payoutDate,
        createdAt: p.createdAt,
        booking: {
          id: p.booking.id,
          callOffer: {
            id: p.booking.callOffer.id,
            title: p.booking.callOffer.title,
            dateTime: p.booking.callOffer.dateTime,
          },
          user: {
            id: p.booking.user.id,
            name: p.booking.user.name,
            email: p.booking.user.email,
          },
        },
      })),
      summary: {
        totalEarnings, // Total already transferred to Stripe Connect account
        pendingEarnings: finalPendingEarnings, // In holding period
        readyForPayout: finalReadyForPayout, // Available for payout
        totalPayments: payments.length,
        paidPayments: paidPayments.length,
        processingPayments: processingPayments.length,
        approvedPayments: approvedPayments.length,
      },
      stripeConnected: !!creator.stripeAccountId && creator.isStripeOnboarded,
      stripeBalance: stripeBalance,
    });
  } catch (error) {
    console.error('Error fetching creator earnings:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des revenus' },
      { status: 500 }
    );
  }
}

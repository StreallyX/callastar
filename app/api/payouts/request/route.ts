import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  createPayout,
  createConnectPayout,
  getConnectAccountDetails,
  getConnectAccountBalance,
} from '@/lib/stripe';
import { getPlatformSettings } from '@/lib/settings';
import { logPayout } from '@/lib/logger';
import { TransactionEventType, PayoutStatus } from '@prisma/client';
import { checkPayoutEligibility, clearBalanceCache } from '@/lib/payout-eligibility';
import { getStripeAccountStatus } from '@/lib/stripe-account-validator';

/**
 * POST /api/payouts/request
 * Request payout from Stripe Connect account balance
 * 
 * Body parameters:
 * - amount: number (optional) - Specific amount to withdraw, defaults to full available balance
 * - adminOverride: boolean (admin only) - Skip eligibility checks
 * 
 * Supports OnlyFans-style routing where funds are already in creator's Stripe balance
 */
export async function POST(request: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { adminOverride = false, amount: requestedAmount } = body;

    // Check if user is admin (for admin override)
    const isAdmin = jwtUser.role === 'ADMIN';
    const isCreator = jwtUser.role === 'CREATOR';

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Get creator ID (either from JWT for creators or from body for admins)
    let creatorId: string;
    if (isCreator) {
      const creator = await prisma.creator.findUnique({
        where: { userId: jwtUser.userId },
        select: { id: true },
      });
      if (!creator) {
        return NextResponse.json(
          { error: 'Créateur introuvable' },
          { status: 404 }
        );
      }
      creatorId = creator.id;
    } else {
      // Admin can specify creator ID in body
      creatorId = body.creatorId;
      if (!creatorId) {
        return NextResponse.json(
          { error: 'creatorId required for admin payout' },
          { status: 400 }
        );
      }
    }

    // Get creator details
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    // Basic check: Stripe account must exist
    if (!creator.stripeAccountId || !creator.isStripeOnboarded) {
      return NextResponse.json(
        { error: 'Vous devez compléter votre configuration Stripe Connect pour demander un paiement' },
        { status: 400 }
      );
    }

    // Get platform settings
    const settings = await getPlatformSettings();
    const minimumPayoutAmount = Number(settings.minimumPayoutAmount);

    // Check Stripe account status
    const accountStatus = await getStripeAccountStatus(creator.stripeAccountId);
    if (!accountStatus.canReceivePayouts && !adminOverride) {
      return NextResponse.json(
        {
          error: 'Compte Stripe non prêt pour les paiements',
          issues: accountStatus.issues,
          requirements: accountStatus.requirements,
        },
        { status: 400 }
      );
    }

    // Get Stripe Connect account balance
    let stripeBalance;
    try {
      stripeBalance = await getConnectAccountBalance(creator.stripeAccountId);
    } catch (error: any) {
      console.error('Error getting Stripe balance:', error);
      return NextResponse.json(
        { error: 'Impossible de récupérer le solde Stripe' },
        { status: 500 }
      );
    }

    // Calculate available balance in EUR
    const availableInCents = stripeBalance.available.reduce((sum, b) => {
      if (b.currency === 'eur') {
        return sum + b.amount;
      }
      return sum;
    }, 0);

    const availableBalance = availableInCents / 100; // Convert from cents

    // Check if there's available balance
    if (availableBalance <= 0) {
      return NextResponse.json(
        { error: 'Aucun solde disponible pour le moment' },
        { status: 400 }
      );
    }

    // Determine payout amount
    let payoutAmount = requestedAmount ? Number(requestedAmount) : availableBalance;

    // Validate requested amount
    if (requestedAmount) {
      if (payoutAmount > availableBalance) {
        return NextResponse.json(
          {
            error: `Solde disponible insuffisant. Vous avez ${availableBalance.toFixed(2)} ${settings.currency} disponibles.`,
          },
          { status: 400 }
        );
      }

      if (payoutAmount < minimumPayoutAmount) {
        return NextResponse.json(
          {
            error: `Le montant minimum de paiement est de ${minimumPayoutAmount.toFixed(2)} ${settings.currency}.`,
          },
          { status: 400 }
        );
      }
    } else {
      // No specific amount requested, check minimum
      if (availableBalance < minimumPayoutAmount) {
        return NextResponse.json(
          {
            error: `Le montant minimum de paiement est de ${minimumPayoutAmount.toFixed(2)} ${settings.currency}. Vous avez actuellement ${availableBalance.toFixed(2)} ${settings.currency}.`,
          },
          { status: 400 }
        );
      }
    }

    // Create payout record
    const payout = await prisma.payout.create({
      data: {
        creatorId: creator.id,
        amount: payoutAmount,
        status: PayoutStatus.PROCESSING,
      },
    });

    // Log payout creation
    await logPayout(TransactionEventType.PAYOUT_CREATED, {
      payoutId: payout.id,
      creatorId: creator.id,
      amount: payoutAmount,
      currency: settings.currency,
      status: PayoutStatus.PROCESSING,
      metadata: {
        availableBalance,
        requestedAmount: requestedAmount || null,
        fromStripeBalance: true,
      },
    });

    try {
      // Create payout from Stripe Connect account to bank account
      const stripePayout = await createConnectPayout({
        amount: payoutAmount,
        currency: settings.currency.toLowerCase(),
        stripeAccountId: creator.stripeAccountId,
        metadata: {
          creatorId: creator.id,
          payoutId: payout.id,
          manual: 'true',
          requestedBy: jwtUser.userId,
          adminOverride: String(adminOverride && isAdmin),
        },
      });

      // Update payout with Stripe payout ID
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          stripePayoutId: stripePayout.id,
          status: PayoutStatus.PROCESSING, // Keep as PROCESSING until Stripe confirms
        },
      });

      // Log payout initiated
      await logPayout(TransactionEventType.PAYOUT_CREATED, {
        payoutId: payout.id,
        creatorId: creator.id,
        amount: payoutAmount,
        currency: settings.currency,
        status: PayoutStatus.PROCESSING,
        stripePayoutId: stripePayout.id,
        metadata: {
          stripePayoutId: stripePayout.id,
          manual: true,
          adminOverride: adminOverride && isAdmin,
          requestedBy: jwtUser.userId,
          estimatedArrival: stripePayout.arrival_date
            ? new Date(stripePayout.arrival_date * 1000).toISOString()
            : null,
        },
      });

      // Create audit log entry
      await prisma.payoutAuditLog.create({
        data: {
          creatorId: creator.id,
          action: 'TRIGGERED',
          amount: payoutAmount,
          status: PayoutStatus.PROCESSING,
          stripePayoutId: stripePayout.id,
          adminId: isAdmin ? jwtUser.userId : null,
          reason: requestedAmount
            ? `Paiement manuel de ${payoutAmount.toFixed(2)} ${settings.currency} demandé`
            : `Paiement complet de ${payoutAmount.toFixed(2)} ${settings.currency} demandé`,
          metadata: JSON.stringify({
            availableBalance,
            requestedAmount: requestedAmount || null,
            estimatedArrival: stripePayout.arrival_date
              ? new Date(stripePayout.arrival_date * 1000).toISOString()
              : null,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Paiement de ${payoutAmount.toFixed(2)} ${settings.currency} en cours de transfert vers votre compte bancaire`,
        payout: {
          id: payout.id,
          amount: payoutAmount,
          currency: settings.currency,
          stripePayoutId: stripePayout.id,
          status: 'processing',
          estimatedArrival: stripePayout.arrival_date
            ? new Date(stripePayout.arrival_date * 1000)
            : null,
        },
      });
    } catch (error: any) {
      console.error('Error creating payout:', error);

      // Update payout status to failed
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.FAILED,
          failureReason: error.message || 'Unknown error',
          retriedCount: 1,
        },
      });

      // Log failed payout
      await logPayout(TransactionEventType.PAYOUT_FAILED, {
        payoutId: payout.id,
        creatorId: creator.id,
        amount: payoutAmount,
        currency: settings.currency,
        status: PayoutStatus.FAILED,
        errorMessage: error.message || 'Payout failed',
      });

      // Create audit log for failed payout
      await prisma.payoutAuditLog.create({
        data: {
          creatorId: creator.id,
          action: 'FAILED',
          amount: payoutAmount,
          status: PayoutStatus.FAILED,
          adminId: isAdmin ? jwtUser.userId : null,
          reason: `Échec du paiement: ${error.message || 'Erreur inconnue'}`,
        },
      });

      return NextResponse.json(
        {
          error: 'Erreur lors du transfert: ' + (error.message || 'Erreur inconnue'),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error requesting payout:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la demande de paiement' },
      { status: 500 }
    );
  }
}

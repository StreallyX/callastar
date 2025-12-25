import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import { createPayout, getConnectAccountDetails } from '@/lib/stripe';
import { getPlatformSettings } from '@/lib/settings';
import { logPayout } from '@/lib/logger';
import { TransactionEventType, PayoutStatus } from '@prisma/client';

/**
 * POST /api/payouts/request
 * Request payout for all READY payments
 */
export async function POST(request: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const creator = await prisma.creator.findUnique({
      where: { userId: jwtUser.userId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    // Check if creator has completed Stripe onboarding
    if (!creator.stripeAccountId || !creator.isStripeOnboarded) {
      return NextResponse.json(
        { error: 'Vous devez compléter votre configuration Stripe Connect pour demander un paiement' },
        { status: 400 }
      );
    }

    // Check if payout is blocked
    if (creator.payoutBlocked) {
      return NextResponse.json(
        { error: `Les paiements sont bloqués: ${creator.payoutBlockedReason || 'Raison inconnue'}` },
        { status: 400 }
      );
    }

    // Get platform settings
    const settings = await getPlatformSettings();

    // Verify Stripe account is valid and can receive payouts
    try {
      const account = await getConnectAccountDetails(creator.stripeAccountId);
      if (!account.payouts_enabled) {
        return NextResponse.json(
          { error: 'Votre compte Stripe n\'est pas encore configuré pour recevoir des paiements. Veuillez compléter votre configuration.' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Error checking Stripe account:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la vérification de votre compte Stripe' },
        { status: 500 }
      );
    }

    // Get all READY payments for this creator
    const readyPayments = await prisma.payment.findMany({
      where: {
        payoutStatus: 'READY',
        booking: {
          callOffer: {
            creatorId: creator.id,
          },
        },
      },
      include: {
        booking: {
          include: {
            callOffer: true,
          },
        },
      },
    });

    if (readyPayments.length === 0) {
      return NextResponse.json(
        { error: 'Aucun paiement disponible pour le moment' },
        { status: 400 }
      );
    }

    // Calculate total amount
    const totalAmount = readyPayments.reduce(
      (sum, p) => sum + Number(p.creatorAmount),
      0
    );

    // Check minimum payout amount
    const minimumPayoutAmount = Number(settings.minimumPayoutAmount);
    if (totalAmount < minimumPayoutAmount) {
      return NextResponse.json(
        { error: `Le montant minimum de paiement est de ${minimumPayoutAmount.toFixed(2)} ${settings.currency}. Vous avez actuellement ${totalAmount.toFixed(2)} ${settings.currency}.` },
        { status: 400 }
      );
    }

    // Create payout record
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
        paymentCount: readyPayments.length,
        paymentIds: readyPayments.map(p => p.id),
      },
    });

    // Mark payments as PROCESSING
    await prisma.payment.updateMany({
      where: {
        id: { in: readyPayments.map(p => p.id) },
      },
      data: {
        payoutStatus: 'PROCESSING',
      },
    });

    try {
      // Create transfer to creator's Stripe account
      const transfer = await createPayout({
        amount: totalAmount,
        stripeAccountId: creator.stripeAccountId,
        metadata: {
          creatorId: creator.id,
          payoutId: payout.id,
          paymentIds: readyPayments.map(p => p.id).join(','),
          paymentCount: String(readyPayments.length),
        },
      });

      // Update payout with Stripe transfer ID
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          stripePayoutId: transfer.id,
          status: PayoutStatus.PAID,
        },
      });

      // Mark payments as PAID
      await prisma.payment.updateMany({
        where: {
          id: { in: readyPayments.map(p => p.id) },
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
          paymentCount: readyPayments.length,
          paymentIds: readyPayments.map(p => p.id),
          stripeTransferId: transfer.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Paiement de ${totalAmount.toFixed(2)} ${settings.currency} transféré avec succès`,
        payout: {
          id: payout.id,
          amount: totalAmount,
          currency: settings.currency,
          stripeTransferId: transfer.id,
          paymentCount: readyPayments.length,
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
        amount: totalAmount,
        currency: settings.currency,
        status: PayoutStatus.FAILED,
        errorMessage: error.message || 'Payout failed',
        metadata: {
          paymentCount: readyPayments.length,
        },
      });

      // Mark payments back as READY on failure
      await prisma.payment.updateMany({
        where: {
          id: { in: readyPayments.map(p => p.id) },
        },
        data: {
          payoutStatus: 'READY',
        },
      });

      return NextResponse.json(
        { error: 'Erreur lors du transfert: ' + (error.message || 'Erreur inconnue') },
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

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { createPayout, getConnectAccountDetails } from '@/lib/stripe';

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

    const creator = await db.creator.findUnique({
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
    const readyPayments = await db.payment.findMany({
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

    // Mark payments as PROCESSING
    await db.payment.updateMany({
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
          paymentIds: readyPayments.map(p => p.id).join(','),
          paymentCount: String(readyPayments.length),
        },
      });

      // Mark payments as PAID
      await db.payment.updateMany({
        where: {
          id: { in: readyPayments.map(p => p.id) },
        },
        data: {
          payoutStatus: 'PAID',
          stripeTransferId: transfer.id,
          payoutDate: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Paiement de ${totalAmount.toFixed(2)} € transféré avec succès`,
        transfer: {
          id: transfer.id,
          amount: totalAmount,
          paymentCount: readyPayments.length,
        },
      });
    } catch (error) {
      console.error('Error creating payout:', error);
      
      // Mark payments back as READY on failure
      await db.payment.updateMany({
        where: {
          id: { in: readyPayments.map(p => p.id) },
        },
        data: {
          payoutStatus: 'READY',
        },
      });

      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      return NextResponse.json(
        { error: 'Erreur lors du transfert: ' + errorMessage },
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

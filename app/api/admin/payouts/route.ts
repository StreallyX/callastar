import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { createPayout, getConnectAccountDetails } from '@/lib/stripe';

const processPayoutSchema = z.object({
  payoutId: z.string(),
  notes: z.string().optional(),
});

/**
 * GET /api/admin/payouts
 * Get all payout requests with filters
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
    const status = searchParams.get('status');
    const creatorId = searchParams.get('creatorId');

    const payouts = await db.payout.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(creatorId && { creatorId }),
      },
      include: {
        creator: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          status: 'asc', // PENDING first
        },
        {
          requestedAt: 'desc',
        },
      ],
    });

    // Get payment details for each payout request
    const payoutsWithDetails = await Promise.all(
      payouts.map(async (payout) => {
        // Get READY payments for this creator to show available balance
        const readyPayments = await db.payment.findMany({
          where: {
            payoutStatus: 'READY',
            booking: {
              callOffer: {
                creatorId: payout.creatorId,
              },
            },
          },
        });

        const availableBalance = readyPayments.reduce(
          (sum, p) => sum + Number(p.creatorAmount),
          0
        );

        return {
          id: payout.id,
          creatorId: payout.creatorId,
          creatorName: payout.creator.user.name,
          creatorEmail: payout.creator.user.email,
          stripeAccountId: payout.stripeAccountId,
          requestedAmount: Number(payout.requestedAmount),
          actualAmount: payout.actualAmount ? Number(payout.actualAmount) : null,
          availableBalance: Number(availableBalance.toFixed(2)),
          status: payout.status,
          requestedAt: payout.requestedAt,
          processedAt: payout.processedAt,
          completedAt: payout.completedAt,
          failedAt: payout.failedAt,
          failureReason: payout.failureReason,
          notes: payout.notes,
          stripePayoutId: payout.stripePayoutId,
          createdAt: payout.createdAt,
          updatedAt: payout.updatedAt,
        };
      })
    );

    return NextResponse.json(payoutsWithDetails);
  } catch (error) {
    console.error('Error fetching payouts:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des payouts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/payouts
 * Process a payout request - actually transfer funds via Stripe
 */
export async function POST(request: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { payoutId, notes } = processPayoutSchema.parse(body);

    // Get the payout request
    const payout = await db.payout.findUnique({
      where: { id: payoutId },
      include: {
        creator: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!payout) {
      return NextResponse.json(
        { error: 'Demande de paiement introuvable' },
        { status: 404 }
      );
    }

    if (payout.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cette demande a déjà été traitée' },
        { status: 400 }
      );
    }

    // Verify Stripe account
    if (!payout.stripeAccountId) {
      return NextResponse.json(
        { error: 'Compte Stripe non configuré pour ce créateur' },
        { status: 400 }
      );
    }

    try {
      const account = await getConnectAccountDetails(payout.stripeAccountId);
      if (!account.payouts_enabled) {
        return NextResponse.json(
          {
            error:
              'Le compte Stripe de ce créateur n\'est pas encore configuré pour recevoir des paiements',
          },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Error checking Stripe account:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la vérification du compte Stripe' },
        { status: 500 }
      );
    }

    // Get all READY payments for this creator
    const readyPayments = await db.payment.findMany({
      where: {
        payoutStatus: 'READY',
        booking: {
          callOffer: {
            creatorId: payout.creatorId,
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

    const availableBalance = readyPayments.reduce(
      (sum, p) => sum + Number(p.creatorAmount),
      0
    );

    // Validate that requested amount doesn't exceed available balance
    if (Number(payout.requestedAmount) > availableBalance) {
      return NextResponse.json(
        {
          error: `Le montant demandé (${Number(payout.requestedAmount).toFixed(2)}€) dépasse le solde disponible (${availableBalance.toFixed(2)}€)`,
        },
        { status: 400 }
      );
    }

    // Calculate which payments to include (up to requested amount)
    let remainingAmount = Number(payout.requestedAmount);
    const paymentsToProcess = [];
    
    for (const payment of readyPayments) {
      if (remainingAmount <= 0) break;
      const paymentAmount = Number(payment.creatorAmount);
      if (paymentAmount <= remainingAmount) {
        paymentsToProcess.push(payment);
        remainingAmount -= paymentAmount;
      }
    }

    const actualAmount = paymentsToProcess.reduce(
      (sum, p) => sum + Number(p.creatorAmount),
      0
    );

    // Mark payout as PROCESSING
    await db.payout.update({
      where: { id: payoutId },
      data: {
        status: 'PROCESSING',
        processedAt: new Date(),
        processedBy: jwtUser.userId,
        notes,
        actualAmount,
      },
    });

    // Mark payments as PROCESSING
    await db.payment.updateMany({
      where: {
        id: { in: paymentsToProcess.map((p) => p.id) },
      },
      data: {
        payoutStatus: 'PROCESSING',
      },
    });

    try {
      // Create transfer to creator's Stripe account
      const transfer = await createPayout({
        amount: actualAmount,
        stripeAccountId: payout.stripeAccountId,
        metadata: {
          creatorId: payout.creatorId,
          payoutRequestId: payoutId,
          paymentIds: paymentsToProcess.map((p) => p.id).join(','),
          paymentCount: String(paymentsToProcess.length),
        },
      });

      console.log('✅ Payout transfer created:', {
        transferId: transfer.id,
        amount: actualAmount,
        paymentCount: paymentsToProcess.length,
      });

      // Mark payout as PAID
      await db.payout.update({
        where: { id: payoutId },
        data: {
          status: 'PAID',
          stripePayoutId: transfer.id,
          completedAt: new Date(),
          actualAmount,
        },
      });

      // Mark payments as PAID
      await db.payment.updateMany({
        where: {
          id: { in: paymentsToProcess.map((p) => p.id) },
        },
        data: {
          payoutStatus: 'PAID',
          stripeTransferId: transfer.id,
          payoutDate: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Paiement de ${actualAmount.toFixed(2)}€ transféré avec succès`,
        payout: {
          id: payout.id,
          amount: actualAmount,
          stripePayoutId: transfer.id,
          paymentCount: paymentsToProcess.length,
          status: 'PAID',
        },
      });
    } catch (error) {
      console.error('❌ Error creating payout transfer:', error);

      // Mark payout as FAILED
      await db.payout.update({
        where: { id: payoutId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: error instanceof Error ? error.message : 'Erreur inconnue',
        },
      });

      // Mark payments back as READY
      await db.payment.updateMany({
        where: {
          id: { in: paymentsToProcess.map((p) => p.id) },
        },
        data: {
          payoutStatus: 'READY',
        },
      });

      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      return NextResponse.json(
        { error: 'Erreur lors du transfert: ' + errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing payout:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur lors du traitement du payout' },
      { status: 500 }
    );
  }
}

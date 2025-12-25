import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

const payoutRequestSchema = z.object({
  amount: z.number().positive('Le montant doit être positif'),
});

/**
 * GET /api/payouts/request
 * Calculate and return creator's available balance and payment details
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

    const now = new Date();

    // Get all HELD payments past release date (READY status)
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
      orderBy: {
        payoutReleaseDate: 'asc',
      },
    });

    // Get all HELD payments (not yet ready)
    const heldPayments = await db.payment.findMany({
      where: {
        payoutStatus: 'HELD',
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
      orderBy: {
        payoutReleaseDate: 'asc',
      },
    });

    // Get processing payments
    const processingPayments = await db.payment.findMany({
      where: {
        payoutStatus: 'PROCESSING',
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

    // Get paid payments
    const paidPayments = await db.payment.findMany({
      where: {
        payoutStatus: 'PAID',
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
      orderBy: {
        payoutDate: 'desc',
      },
      take: 50, // Limit to last 50 paid payments
    });

    // Calculate available balance (sum of READY payments)
    const availableBalance = readyPayments.reduce(
      (sum, p) => sum + Number(p.creatorAmount),
      0
    );

    // Calculate pending balance (sum of HELD payments)
    const pendingBalance = heldPayments.reduce(
      (sum, p) => sum + Number(p.creatorAmount),
      0
    );

    // Get pending payout requests
    const pendingPayoutRequests = await db.payout.findMany({
      where: {
        creatorId: creator.id,
        status: {
          in: ['PENDING', 'PROCESSING'],
        },
      },
      orderBy: {
        requestedAt: 'desc',
      },
    });

    return NextResponse.json({
      availableBalance: Number(availableBalance.toFixed(2)),
      pendingBalance: Number(pendingBalance.toFixed(2)),
      totalPaid: Number(
        paidPayments
          .reduce((sum, p) => sum + Number(p.creatorAmount), 0)
          .toFixed(2)
      ),
      stripeConnected: !!(creator.stripeAccountId && creator.isStripeOnboarded),
      stripeAccountId: creator.stripeAccountId,
      payments: {
        ready: readyPayments.map((p) => ({
          id: p.id,
          amount: Number(p.creatorAmount),
          platformFee: Number(p.platformFee),
          totalAmount: Number(p.amount),
          releaseDate: p.payoutReleaseDate,
          paymentDate: p.createdAt,
          bookingId: p.bookingId,
          status: p.payoutStatus,
        })),
        held: heldPayments.map((p) => ({
          id: p.id,
          amount: Number(p.creatorAmount),
          platformFee: Number(p.platformFee),
          totalAmount: Number(p.amount),
          releaseDate: p.payoutReleaseDate,
          paymentDate: p.createdAt,
          bookingId: p.bookingId,
          status: p.payoutStatus,
          daysRemaining: p.payoutReleaseDate
            ? Math.max(
                0,
                Math.ceil(
                  (new Date(p.payoutReleaseDate).getTime() - now.getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              )
            : 0,
        })),
        processing: processingPayments.map((p) => ({
          id: p.id,
          amount: Number(p.creatorAmount),
          platformFee: Number(p.platformFee),
          totalAmount: Number(p.amount),
          releaseDate: p.payoutReleaseDate,
          paymentDate: p.createdAt,
          bookingId: p.bookingId,
          status: p.payoutStatus,
        })),
        paid: paidPayments.map((p) => ({
          id: p.id,
          amount: Number(p.creatorAmount),
          platformFee: Number(p.platformFee),
          totalAmount: Number(p.amount),
          payoutDate: p.payoutDate,
          paymentDate: p.createdAt,
          bookingId: p.bookingId,
          status: p.payoutStatus,
          stripeTransferId: p.stripeTransferId,
        })),
      },
      pendingPayoutRequests: pendingPayoutRequests.map((pr) => ({
        id: pr.id,
        amount: Number(pr.requestedAmount),
        status: pr.status,
        requestedAt: pr.requestedAt,
        processedAt: pr.processedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching payout balance:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du solde' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payouts/request
 * Create a payout request (not process immediately)
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
        {
          error:
            'Vous devez compléter votre configuration Stripe Connect pour demander un paiement',
        },
        { status: 400 }
      );
    }

    // Parse and validate request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      return NextResponse.json(
        { 
          error: 'Corps de la requête invalide. Veuillez envoyer un JSON valide avec le champ "amount".',
          details: 'Le corps de la requête doit être au format JSON avec un champ "amount" (nombre positif).'
        },
        { status: 400 }
      );
    }

    // Validate that body contains required fields
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { 
          error: 'Corps de la requête invalide',
          details: 'Le corps de la requête doit être un objet JSON.'
        },
        { status: 400 }
      );
    }

    if (!body.amount) {
      return NextResponse.json(
        { 
          error: 'Champ "amount" manquant',
          details: 'Le corps de la requête doit contenir un champ "amount" avec le montant à demander.'
        },
        { status: 400 }
      );
    }

    // Validate amount with Zod
    let amount;
    try {
      const validated = payoutRequestSchema.parse(body);
      amount = validated.amount;
    } catch (zodError) {
      if (zodError instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: 'Validation échouée',
            details: zodError.issues.map(issue => issue.message).join(', ')
          },
          { status: 400 }
        );
      }
      throw zodError;
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
    });

    // Calculate available balance
    const availableBalance = readyPayments.reduce(
      (sum, p) => sum + Number(p.creatorAmount),
      0
    );

    // Validate requested amount
    if (amount > availableBalance) {
      return NextResponse.json(
        {
          error: `Le montant demandé (${amount.toFixed(2)}€) dépasse votre solde disponible (${availableBalance.toFixed(2)}€)`,
        },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Le montant doit être supérieur à 0' },
        { status: 400 }
      );
    }

    // Check if there's already a pending payout request
    const existingPendingRequest = await db.payout.findFirst({
      where: {
        creatorId: creator.id,
        status: 'PENDING',
      },
    });

    if (existingPendingRequest) {
      return NextResponse.json(
        {
          error: 'Vous avez déjà une demande de paiement en attente',
        },
        { status: 400 }
      );
    }

    // Create payout request
    const payoutRequest = await db.payout.create({
      data: {
        creatorId: creator.id,
        requestedAmount: amount,
        stripeAccountId: creator.stripeAccountId,
        status: 'PENDING',
        requestedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Demande de paiement de ${amount.toFixed(2)}€ créée avec succès`,
      payout: {
        id: payoutRequest.id,
        amount: Number(payoutRequest.requestedAmount),
        status: payoutRequest.status,
        requestedAt: payoutRequest.requestedAt,
      },
    });
  } catch (error) {
    console.error('Error creating payout request:', error);

    // Zod errors are already handled above, this is for unexpected errors
    return NextResponse.json(
      { error: 'Erreur lors de la création de la demande de paiement' },
      { status: 500 }
    );
  }
}

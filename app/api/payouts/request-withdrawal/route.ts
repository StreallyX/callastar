import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { getConnectAccountDetails } from '@/lib/stripe';

/**
 * POST /api/payouts/request-withdrawal
 * Request payout for all READY payments (creates PayoutRequest)
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

    // Get all READY payments that are NOT already in a payout request
    const eligiblePayments = await db.payment.findMany({
      where: {
        payoutStatus: 'READY',
        payoutRequestId: null, // Not already included in a payout request
        booking: {
          callOffer: {
            creatorId: creator.id,
          },
        },
      },
      include: {
        booking: {
          include: {
            callOffer: {
              select: {
                title: true,
                dateTime: true,
              },
            },
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

    if (eligiblePayments.length === 0) {
      return NextResponse.json(
        { error: 'Aucun paiement disponible pour le retrait. Les paiements doivent attendre 7 jours après la réception.' },
        { status: 400 }
      );
    }

    // Calculate total amount
    const totalAmount = eligiblePayments.reduce(
      (sum, p) => sum + Number(p.creatorAmount),
      0
    );

    // Create PayoutRequest
    const payoutRequest = await db.payoutRequest.create({
      data: {
        creatorId: creator.id,
        totalAmount,
        currency: 'eur',
        status: 'PENDING',
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
    });

    // Link all eligible payments to this payout request
    await db.payment.updateMany({
      where: {
        id: { in: eligiblePayments.map(p => p.id) },
      },
      data: {
        payoutRequestId: payoutRequest.id,
      },
    });

    // Fetch the updated payout request with payments
    const updatedPayoutRequest = await db.payoutRequest.findUnique({
      where: { id: payoutRequest.id },
      include: {
        payments: {
          include: {
            booking: {
              include: {
                callOffer: {
                  select: {
                    title: true,
                    dateTime: true,
                  },
                },
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
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
    });

    return NextResponse.json({
      success: true,
      message: `Demande de paiement créée avec succès pour ${totalAmount.toFixed(2)} €`,
      payoutRequest: updatedPayoutRequest,
      paymentCount: eligiblePayments.length,
    });
  } catch (error) {
    console.error('Error creating payout request:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la demande de paiement' },
      { status: 500 }
    );
  }
}

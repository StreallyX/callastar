import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { getConnectAccountDetails } from '@/lib/stripe';

/**
 * GET /api/admin/payout-requests/[id]
 * Get specific payout request details (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé - Accès administrateur requis' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Get the specific payout request with full details
    const payoutRequest = await db.payoutRequest.findUnique({
      where: { id },
      include: {
        payments: {
          include: {
            booking: {
              include: {
                callOffer: {
                  select: {
                    title: true,
                    description: true,
                    dateTime: true,
                    price: true,
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
          orderBy: {
            createdAt: 'desc',
          },
        },
        creator: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!payoutRequest) {
      return NextResponse.json(
        { error: 'Demande de paiement introuvable' },
        { status: 404 }
      );
    }

    // Get Stripe Connect account info
    let stripeAccountInfo = null;
    if (payoutRequest.creator.stripeAccountId) {
      try {
        const account = await getConnectAccountDetails(payoutRequest.creator.stripeAccountId);
        stripeAccountInfo = {
          id: account.id,
          payouts_enabled: account.payouts_enabled,
          charges_enabled: account.charges_enabled,
          details_submitted: account.details_submitted,
          country: account.country,
          default_currency: account.default_currency,
        };
      } catch (error) {
        console.error('Error fetching Stripe account details:', error);
        stripeAccountInfo = {
          error: 'Unable to fetch Stripe account details',
        };
      }
    }

    return NextResponse.json({
      payoutRequest: {
        ...payoutRequest,
        paymentCount: payoutRequest.payments.length,
        stripeAccountInfo,
      },
    });
  } catch (error) {
    console.error('Error fetching payout request (admin):', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la demande de paiement' },
      { status: 500 }
    );
  }
}

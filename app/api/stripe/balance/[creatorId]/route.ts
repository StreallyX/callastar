import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';

/**
 * GET /api/stripe/balance/[creatorId]
 * Fetch creator's Stripe account balance
 * Accessible by the creator themselves or admin
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { creatorId: string } }
) {
  try {
    // Verify user is authenticated
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const { creatorId } = params;

    // Get creator
    const creator = await db.creator.findUnique({
      where: { id: creatorId },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    // Authorization: creator can view their own balance, admin can view any
    const isOwnCreator = creator.userId === jwtUser.userId;
    const isAdmin = jwtUser.role === 'ADMIN';
    
    if (!isOwnCreator && !isAdmin) {
      return NextResponse.json(
        { error: 'Vous n\'avez pas la permission d\'accéder à cette ressource' },
        { status: 403 }
      );
    }

    // Check if creator has Stripe account
    if (!creator.stripeAccountId) {
      return NextResponse.json(
        { 
          error: 'Compte Stripe non configuré',
          message: 'Le créateur doit compléter l\'onboarding Stripe'
        },
        { status: 400 }
      );
    }

    // Check if Stripe account is ready for payouts
    if (!creator.isStripeOnboarded) {
      return NextResponse.json(
        { 
          error: 'Onboarding Stripe incomplet',
          message: 'L\'onboarding Stripe doit être complété avant de consulter le solde'
        },
        { status: 400 }
      );
    }

    // Fetch balance from Stripe
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: creator.stripeAccountId,
      });

      // Fetch account details to check payout capabilities
      const account = await stripe.accounts.retrieve(creator.stripeAccountId);

      return NextResponse.json({
        balance: {
          available: balance.available.map(b => ({
            amount: b.amount / 100, // Convert from cents to EUR
            currency: b.currency,
          })),
          pending: balance.pending.map(b => ({
            amount: b.amount / 100, // Convert from cents to EUR
            currency: b.currency,
          })),
        },
        account: {
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
        },
        creator: {
          id: creator.id,
          name: creator.user.name,
          email: creator.user.email,
          payoutSchedule: creator.payoutSchedule,
          payoutMinimum: creator.payoutMinimum,
          isPayoutBlocked: creator.isPayoutBlocked,
          payoutBlockReason: creator.payoutBlockReason,
        }
      });
    } catch (stripeError: any) {
      console.error('Stripe API error:', stripeError);
      
      // Handle specific Stripe errors
      if (stripeError.type === 'StripePermissionError') {
        return NextResponse.json(
          { error: 'Permissions insuffisantes pour accéder au compte Stripe' },
          { status: 403 }
        );
      }
      
      if (stripeError.type === 'StripeInvalidRequestError') {
        return NextResponse.json(
          { error: 'Compte Stripe invalide ou inexistant' },
          { status: 400 }
        );
      }

      throw stripeError;
    }
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du solde' },
      { status: 500 }
    );
  }
}

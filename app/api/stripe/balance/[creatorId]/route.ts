import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { getStripeAccountStatus } from '@/lib/stripe-account-validator';

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

      // ✅ NEW: Fetch Stripe account details to get default currency
      const stripeAccount = await stripe.accounts.retrieve(creator.stripeAccountId);
      const stripeCurrency = (stripeAccount.default_currency || 'eur').toUpperCase();

      // ✅ FIX: Use comprehensive validation logic instead of raw flags
      const accountStatus = await getStripeAccountStatus(creator.stripeAccountId);

      // Calculate total available and pending amounts (sum all currency balances)
      const availableTotal = balance.available.reduce((sum, b) => sum + (b.amount / 100), 0);
      const pendingTotal = balance.pending.reduce((sum, b) => sum + (b.amount / 100), 0);

      return NextResponse.json({
        available: availableTotal,
        pending: pendingTotal,
        currency: 'EUR', // Database currency (source of truth)
        stripeCurrency: stripeCurrency, // Stripe account currency
        // ✅ FIX: Return correct account status using validator
        detailsSubmitted: accountStatus.detailsSubmitted,
        requirementsCount: accountStatus.requirements.currentlyDue.length,
        // Include these for backward compatibility but marked as deprecated
        payoutsEnabled: accountStatus.payoutsEnabled,
        chargesEnabled: accountStatus.chargesEnabled,
        // Include comprehensive status for UI use
        accountStatus: {
          isFullyOnboarded: accountStatus.isFullyOnboarded,
          canReceivePayments: accountStatus.canReceivePayments,
          canReceivePayouts: accountStatus.canReceivePayouts,
          detailsSubmitted: accountStatus.detailsSubmitted,
          requirementsPending: accountStatus.requirements.currentlyDue.length > 0,
          requirementsCurrentlyDue: accountStatus.requirements.currentlyDue,
          requirementsPastDue: accountStatus.requirements.pastDue,
        },
        creator: {
          id: creator.id,
          name: creator.user.name,
          email: creator.user.email,
          payoutSchedule: creator.payoutSchedule,
          payoutMinimum: Number(creator.payoutMinimum),
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

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import { getConnectAccountBalance } from '@/lib/stripe';

/**
 * GET /api/creators/balance
 * 
 * Get creator's Stripe Connect account balance
 * Shows available, pending, and estimated arrival dates
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user || user.role !== 'CREATOR') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Get creator
    const creator = await prisma.creator.findUnique({
      where: { userId: user.userId },
    });

    if (!creator) {
      return NextResponse.json({ error: 'Créateur introuvable' }, { status: 404 });
    }

    if (!creator.stripeAccountId) {
      return NextResponse.json({
        hasStripeAccount: false,
        available: 0,
        pending: 0,
        currency: 'eur',
        message: 'Compte Stripe non configuré',
      });
    }

    // Get balance from Stripe
    const balance = await getConnectAccountBalance(creator.stripeAccountId);

    // Calculate total available and pending amounts
    const available = balance.available.reduce((sum, b) => {
      if (b.currency === 'eur') {
        return sum + b.amount;
      }
      return sum;
    }, 0);

    const pending = balance.pending.reduce((sum, b) => {
      if (b.currency === 'eur') {
        return sum + b.amount;
      }
      return sum;
    }, 0);

    // Get estimated arrival dates for pending amounts
    const pendingDetails = balance.pending.map((p) => ({
      amount: p.amount / 100, // Convert from cents
      currency: p.currency,
      source_types: p.source_types,
    }));

    return NextResponse.json({
      hasStripeAccount: true,
      available: available / 100, // Convert from cents
      pending: pending / 100, // Convert from cents
      currency: 'eur',
      availableDetails: balance.available,
      pendingDetails,
      instant_available: balance.instant_available?.map((ia) => ({
        amount: ia.amount / 100,
        currency: ia.currency,
        source_types: ia.source_types,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching creator balance:', error);

    // Handle Stripe errors gracefully
    if (error.type === 'StripePermissionError') {
      return NextResponse.json(
        {
          error: 'Impossible d\'accéder au solde Stripe',
          message: 'Compte Stripe non activé ou permissions insuffisantes',
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur lors de la récupération du solde' },
      { status: 500 }
    );
  }
}

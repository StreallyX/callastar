import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/stripe/express-dashboard
 * Generate Stripe Connect Express Dashboard login link for creator
 * 
 * This allows creators to manage their Stripe Connect account settings,
 * including bank account information, without accessing the full Stripe Dashboard
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated as creator
    const jwtUser = await getUserFromRequest(request);
    
    if (!jwtUser || jwtUser.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Get creator with Stripe account
    const creator = await db.creator.findUnique({
      where: { userId: jwtUser.userId },
      select: {
        id: true,
        stripeAccountId: true,
        isStripeOnboarded: true,
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    if (!creator.stripeAccountId) {
      return NextResponse.json(
        { error: 'Compte Stripe non configuré' },
        { status: 400 }
      );
    }

    // Create Stripe Connect Express Dashboard login link
    const loginLink = await stripe.accounts.createLoginLink(
      creator.stripeAccountId
    );

    return NextResponse.json({
      url: loginLink.url,
      expiresAt: new Date(loginLink.created * 1000 + 300000).toISOString(), // 5 minutes validity
    });
  } catch (error: any) {
    console.error('Error creating Express Dashboard link:', error);
    
    return NextResponse.json(
      { 
        error: 'Erreur lors de la création du lien',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

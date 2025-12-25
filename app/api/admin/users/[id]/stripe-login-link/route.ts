import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/admin/users/[id]/stripe-login-link
 * 
 * Generate a temporary login link to access a creator's Stripe Connected Account dashboard.
 * This is useful for debugging purposes - allows admins to view account balance, payouts, 
 * transfers, and troubleshoot issues.
 * 
 * Security:
 * - Admin authentication required
 * - Only works if user has a Stripe Connect account
 * - Generates temporary, single-use login links
 * 
 * @param id - User ID
 * @returns { url: string } - Temporary Stripe dashboard login URL
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    const userId = params.id;

    // Get user with creator profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        creator: {
          select: {
            id: true,
            stripeAccountId: true,
            isStripeOnboarded: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 }
      );
    }

    // Check if user is a creator
    if (!user.creator) {
      return NextResponse.json(
        { error: "L'utilisateur n'est pas un créateur" },
        { status: 400 }
      );
    }

    // Check if creator has a Stripe Connect account
    if (!user.creator.stripeAccountId) {
      return NextResponse.json(
        { error: "Le créateur n'a pas de compte Stripe Connect" },
        { status: 400 }
      );
    }

    console.log('Generating Stripe login link for user:', {
      userId,
      creatorId: user.creator.id,
      stripeAccountId: user.creator.stripeAccountId,
      isStripeOnboarded: user.creator.isStripeOnboarded,
    });

    // Create login link for the connected account
    // This generates a temporary URL that allows access to the account's dashboard
    try {
      const loginLink = await stripe.accounts.createLoginLink(
        user.creator.stripeAccountId
      );

      console.log('Stripe login link created successfully:', {
        url: loginLink.url,
        created: loginLink.created,
      });

      return NextResponse.json({
        url: loginLink.url,
      });
    } catch (stripeError: any) {
      console.error('Stripe API error:', stripeError);

      // Handle specific Stripe errors
      if (stripeError.type === 'StripeInvalidRequestError') {
        if (stripeError.message?.includes('No such account')) {
          return NextResponse.json(
            { error: 'Le compte Stripe Connect est introuvable' },
            { status: 404 }
          );
        }
        if (stripeError.message?.includes('not ready')) {
          return NextResponse.json(
            { error: 'Le compte Stripe Connect n\'est pas encore prêt pour les liens de connexion' },
            { status: 400 }
          );
        }
        if (stripeError.message?.includes('invalid')) {
          return NextResponse.json(
            { error: 'Le type de compte Stripe n\'est pas compatible avec les liens de connexion' },
            { status: 400 }
          );
        }
      }

      // Generic Stripe error
      return NextResponse.json(
        { 
          error: 'Erreur lors de la génération du lien Stripe',
          details: stripeError.message 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error generating Stripe login link:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du lien de connexion Stripe' },
      { status: 500 }
    );
  }
}

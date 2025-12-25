import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { getConnectAccountDetails } from '@/lib/stripe';

/**
 * POST /api/admin/payout-requests/[id]/prepare-stripe
 * Prepare Stripe transfer for a payout request (admin only)
 * This creates the transfer but requires manual confirmation on Stripe dashboard
 */
export async function POST(
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

    // Get the payout request
    const payoutRequest = await db.payoutRequest.findUnique({
      where: { id },
      include: {
        payments: true,
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

    if (!payoutRequest) {
      return NextResponse.json(
        { error: 'Demande de paiement introuvable' },
        { status: 404 }
      );
    }

    // Check if already processed
    if (payoutRequest.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cette demande de paiement a déjà été traitée' },
        { status: 400 }
      );
    }

    if (payoutRequest.status === 'PROCESSING') {
      return NextResponse.json(
        { 
          error: 'Cette demande est déjà en cours de traitement',
          stripeTransferId: payoutRequest.stripeTransferId,
          stripeDashboardLink: `https://dashboard.stripe.com/transfers/${payoutRequest.stripeTransferId}`,
        },
        { status: 400 }
      );
    }

    // Verify creator has valid Stripe Connect account
    if (!payoutRequest.creator.stripeAccountId) {
      return NextResponse.json(
        { error: 'Le créateur n\'a pas de compte Stripe Connect configuré' },
        { status: 400 }
      );
    }

    // Verify Stripe account is valid
    try {
      const account = await getConnectAccountDetails(payoutRequest.creator.stripeAccountId);
      if (!account.payouts_enabled) {
        return NextResponse.json(
          { error: 'Le compte Stripe du créateur n\'est pas configuré pour recevoir des paiements' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Error checking Stripe account:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la vérification du compte Stripe du créateur' },
        { status: 500 }
      );
    }

    // Create Stripe Transfer
    try {
      // Prepare metadata - CRITICAL: All values must be strings for Stripe
      const transferMetadata = {
        payoutRequestId: String(payoutRequest.id),
        creatorId: String(payoutRequest.creatorId),
        creatorName: String(payoutRequest.creator.user.name || 'Unknown'),
        creatorEmail: String(payoutRequest.creator.user.email || 'Unknown'),
        paymentIds: payoutRequest.payments.map(p => String(p.id)).join(','),
        paymentCount: String(payoutRequest.payments.length),
        platform: 'callastar',
      };

      console.log('========================================');
      console.log('PREPARING STRIPE TRANSFER');
      console.log('Payout Request ID:', payoutRequest.id);
      console.log('Amount:', Number(payoutRequest.totalAmount), 'EUR');
      console.log('Amount (cents):', Math.round(Number(payoutRequest.totalAmount) * 100));
      console.log('Currency:', payoutRequest.currency);
      console.log('Destination Account:', payoutRequest.creator.stripeAccountId);
      console.log('Payment Count:', payoutRequest.payments.length);
      console.log('========================================');
      console.log('TRANSFER METADATA (All values as strings):');
      console.log(JSON.stringify(transferMetadata, null, 2));
      console.log('========================================');

      const transfer = await stripe.transfers.create({
        amount: Math.round(Number(payoutRequest.totalAmount) * 100), // Convert to cents
        currency: payoutRequest.currency,
        destination: payoutRequest.creator.stripeAccountId,
        metadata: transferMetadata,
        description: `Paiement pour ${payoutRequest.payments.length} appels - ${payoutRequest.creator.user.name}`,
      });

      console.log('========================================');
      console.log('✅ STRIPE TRANSFER CREATED SUCCESSFULLY');
      console.log('Transfer ID:', transfer.id);
      console.log('Amount:', transfer.amount, 'cents');
      console.log('Destination:', transfer.destination);
      console.log('========================================');
      console.log('TRANSFER METADATA SAVED TO STRIPE:');
      console.log(JSON.stringify(transfer.metadata, null, 2));
      console.log('========================================');

      // Update PayoutRequest status to PROCESSING
      await db.payoutRequest.update({
        where: { id: payoutRequest.id },
        data: {
          status: 'PROCESSING',
          stripeTransferId: transfer.id,
          updatedAt: new Date(),
        },
      });

      console.log('✅ Database updated: PayoutRequest status -> PROCESSING');
      console.log('========================================');

      // Generate Stripe dashboard link
      const stripeDashboardLink = `https://dashboard.stripe.com/transfers/${transfer.id}`;

      return NextResponse.json({
        success: true,
        message: 'Transfert Stripe créé avec succès. Veuillez confirmer sur le tableau de bord Stripe.',
        transfer: {
          id: transfer.id,
          amount: Number(payoutRequest.totalAmount),
          currency: payoutRequest.currency,
          destination: payoutRequest.creator.stripeAccountId,
        },
        stripeDashboardLink,
        instructions: 'Le transfert a été créé sur Stripe. Il sera automatiquement traité par Stripe. Le statut sera mis à jour automatiquement via webhook lorsque le transfert sera terminé.',
      });
    } catch (error: any) {
      console.error('Error creating Stripe transfer:', error);
      
      // Update status to FAILED if transfer creation failed
      await db.payoutRequest.update({
        where: { id: payoutRequest.id },
        data: {
          status: 'FAILED',
          updatedAt: new Date(),
        },
      });

      return NextResponse.json(
        { 
          error: 'Erreur lors de la création du transfert Stripe: ' + (error.message || 'Erreur inconnue'),
          details: error.raw?.message || error.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error preparing payout:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la préparation du paiement' },
      { status: 500 }
    );
  }
}

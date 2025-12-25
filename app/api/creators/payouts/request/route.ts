import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { PayoutAction, PayoutStatus } from '@prisma/client';

/**
 * POST /api/creators/payouts/request
 * Creator requests a manual payout (only if payoutSchedule is MANUAL)
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

    // Parse request body
    const body = await request.json();
    const { amount, currency = 'eur' } = body;

    // Get creator with account details
    const creator = await db.creator.findUnique({
      where: { userId: jwtUser.userId },
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

    // Check if creator's payout schedule is MANUAL
    if (creator.payoutSchedule !== 'MANUAL') {
      return NextResponse.json(
        { 
          error: 'Paiements automatiques activés',
          message: `Votre planning de paiement est configuré sur ${creator.payoutSchedule}. Changez-le en MANUAL pour demander des paiements manuels.`
        },
        { status: 400 }
      );
    }

    // Validation
    const errors: string[] = [];

    if (!amount || isNaN(Number(amount))) {
      errors.push('Le montant est requis et doit être un nombre');
    } else {
      const requestedAmount = Number(amount);
      const minimumAmount = Number(creator.payoutMinimum);
      
      if (requestedAmount < minimumAmount) {
        errors.push(`Le montant minimum de paiement est de ${minimumAmount}€`);
      }
    }

    if (currency !== 'eur') {
      errors.push('Seule la devise EUR est supportée actuellement');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation échouée', details: errors },
        { status: 400 }
      );
    }

    // Check if creator has Stripe account
    if (!creator.stripeAccountId) {
      return NextResponse.json(
        { 
          error: 'Compte Stripe non configuré',
          message: 'Vous devez compléter l\'onboarding Stripe avant de demander un paiement'
        },
        { status: 400 }
      );
    }

    // Check if creator is blocked
    if (creator.isPayoutBlocked) {
      return NextResponse.json(
        { 
          error: 'Paiements bloqués',
          message: `Vos paiements sont actuellement bloqués. ${creator.payoutBlockReason ? 'Raison: ' + creator.payoutBlockReason : 'Veuillez contacter le support.'}`
        },
        { status: 403 }
      );
    }

    // Fetch Stripe account details
    let stripeAccount;
    try {
      stripeAccount = await stripe.accounts.retrieve(creator.stripeAccountId);
    } catch (stripeError: any) {
      console.error('Error retrieving Stripe account:', stripeError);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération du compte Stripe' },
        { status: 500 }
      );
    }

    // Validate KYC is complete
    if (!stripeAccount.charges_enabled) {
      return NextResponse.json(
        { 
          error: 'KYC incomplet',
          message: 'Vous devez compléter la vérification KYC avant de recevoir des paiements'
        },
        { status: 400 }
      );
    }

    // Validate bank account is verified
    if (!stripeAccount.payouts_enabled) {
      return NextResponse.json(
        { 
          error: 'Compte bancaire non validé',
          message: 'Vous devez valider votre compte bancaire avant de recevoir des paiements'
        },
        { status: 400 }
      );
    }

    // Fetch balance to verify sufficient funds
    let balance;
    try {
      balance = await stripe.balance.retrieve({
        stripeAccount: creator.stripeAccountId,
      });
    } catch (stripeError: any) {
      console.error('Error retrieving balance:', stripeError);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération du solde' },
        { status: 500 }
      );
    }

    // Check if sufficient balance (in the main currency)
    const availableBalance = balance.available.find(b => b.currency === currency);
    const requestedAmountInCents = Math.round(Number(amount) * 100);
    
    if (!availableBalance || availableBalance.amount < requestedAmountInCents) {
      const availableAmount = availableBalance ? (availableBalance.amount / 100).toFixed(2) : '0.00';
      return NextResponse.json(
        { 
          error: 'Solde insuffisant',
          message: `Solde disponible: ${availableAmount}€, Montant demandé: ${amount}€`,
          availableBalance: Number(availableAmount)
        },
        { status: 400 }
      );
    }

    // Create payout via Stripe
    let stripePayout;
    try {
      stripePayout = await stripe.payouts.create(
        {
          amount: requestedAmountInCents,
          currency: currency,
          metadata: {
            creatorId: creator.id,
            creatorEmail: creator.user.email,
            triggeredBy: 'creator',
            platform: 'callastar'
          }
        },
        {
          stripeAccount: creator.stripeAccountId,
        }
      );
    } catch (stripeError: any) {
      console.error('Error creating payout:', stripeError);
      
      // Log failed attempt in audit log
      await db.payoutAuditLog.create({
        data: {
          creatorId: creator.id,
          action: PayoutAction.FAILED,
          amount: Number(amount),
          status: PayoutStatus.FAILED,
          reason: `Échec de création du paiement Stripe: ${stripeError.message}`,
          metadata: JSON.stringify({
            stripeErrorType: stripeError.type,
            stripeErrorCode: stripeError.code,
            triggeredBy: 'creator'
          })
        }
      });

      return NextResponse.json(
        { 
          error: 'Échec de création du paiement',
          message: stripeError.message
        },
        { status: 500 }
      );
    }

    // Create audit log entry
    const auditLog = await db.payoutAuditLog.create({
      data: {
        creatorId: creator.id,
        action: PayoutAction.TRIGGERED,
        amount: Number(amount),
        status: PayoutStatus.PROCESSING,
        stripePayoutId: stripePayout.id,
        reason: 'Paiement demandé manuellement par le créateur',
        metadata: JSON.stringify({
          stripePayout: {
            id: stripePayout.id,
            status: stripePayout.status,
            arrival_date: stripePayout.arrival_date,
          },
          triggeredBy: 'creator'
        })
      }
    });

    return NextResponse.json({
      message: 'Demande de paiement créée avec succès',
      payout: {
        id: stripePayout.id,
        amount: Number(amount),
        currency: currency,
        status: stripePayout.status,
        arrivalDate: new Date(stripePayout.arrival_date * 1000),
      },
      auditLog: {
        id: auditLog.id,
        action: auditLog.action,
        createdAt: auditLog.createdAt,
      }
    });
  } catch (error) {
    console.error('Error requesting payout:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la demande de paiement' },
      { status: 500 }
    );
  }
}

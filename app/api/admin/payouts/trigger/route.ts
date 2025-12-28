import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { PayoutAction, PayoutStatus } from '@prisma/client';

/**
 * POST /api/admin/payouts/trigger
 * Trigger a payout for a creator (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated as admin
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé - Accès administrateur requis' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { creatorId, amount } = body;

    // Validation
    const errors: string[] = [];

    if (!creatorId) {
      errors.push('L\'ID du créateur est requis');
    }

    if (!amount || isNaN(Number(amount))) {
      errors.push('Le montant est requis et doit être un nombre');
    } else if (Number(amount) < 10) {
      errors.push('Le montant minimum de paiement est de 10');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation échouée', details: errors },
        { status: 400 }
      );
    }

    // Get creator with account details
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

    // Check if creator is blocked
    if (creator.isPayoutBlocked) {
      return NextResponse.json(
        { 
          error: 'Paiements bloqués',
          message: `Les paiements pour ce créateur sont bloqués. Raison: ${creator.payoutBlockReason || 'Non spécifiée'}`
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

    // ✅ USE CREATOR'S CURRENCY FROM DATABASE (source of truth)
    const currency = creator.currency.toLowerCase();
    const stripeCurrency = (stripeAccount.default_currency || 'eur').toUpperCase();

    // ⚠️ DETECT CURRENCY INCONSISTENCY
    if (stripeCurrency !== creator.currency) {
      console.warn(`[payout-trigger] ⚠️  INCOHÉRENCE DEVISE DÉTECTÉE pour créateur ${creator.id} (${creator.user.name}):
        - Base de données : ${creator.currency}
        - Compte Stripe   : ${stripeCurrency}
        → Action requise : Resynchroniser via /api/admin/sync-currency`);
      
      // Log the inconsistency but continue with DB currency (source of truth)
      // This ensures we don't fail the payout but we alert admins
    }

    // Validate KYC is complete
    if (!stripeAccount.charges_enabled) {
      return NextResponse.json(
        { 
          error: 'KYC incomplet',
          message: 'Le créateur doit compléter la vérification KYC avant de recevoir des paiements'
        },
        { status: 400 }
      );
    }

    // Validate bank account is verified
    if (!stripeAccount.payouts_enabled) {
      return NextResponse.json(
        { 
          error: 'Compte bancaire non validé',
          message: 'Le créateur doit valider son compte bancaire avant de recevoir des paiements'
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

    // Check if sufficient balance (in the creator's currency)
    const availableBalance = balance.available.find(b => b.currency === currency);
    const requestedAmountInCents = Math.round(Number(amount) * 100);
    
    if (!availableBalance) {
      console.error(`[payout-trigger] ❌ Solde non trouvé dans la devise ${creator.currency} pour créateur ${creator.id}`);
      console.error(`[payout-trigger] Devises disponibles:`, balance.available.map(b => b.currency).join(', '));
      return NextResponse.json(
        { 
          error: 'Solde non trouvé dans la devise',
          message: `Solde non trouvé dans la devise ${creator.currency}. Devises disponibles: ${balance.available.map(b => b.currency).join(', ')}`
        },
        { status: 400 }
      );
    }
    
    if (availableBalance.amount < requestedAmountInCents) {
      const availableAmount = (availableBalance.amount / 100).toFixed(2);
      return NextResponse.json(
        { 
          error: 'Solde insuffisant',
          message: `Solde disponible: ${availableAmount} ${creator.currency}, Montant demandé: ${amount} ${creator.currency}`
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
            triggeredBy: 'admin',
            adminId: jwtUser.userId,
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
          adminId: jwtUser.userId,
          reason: `Échec de création du paiement Stripe: ${stripeError.message}`,
          metadata: JSON.stringify({
            stripeErrorType: stripeError.type,
            stripeErrorCode: stripeError.code,
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
        adminId: jwtUser.userId,
        reason: 'Paiement déclenché manuellement par un administrateur',
        metadata: JSON.stringify({
          stripePayout: {
            id: stripePayout.id,
            status: stripePayout.status,
            arrival_date: stripePayout.arrival_date,
          }
        })
      }
    });

    return NextResponse.json({
      message: 'Paiement créé avec succès',
      payout: {
        id: stripePayout.id,
        amount: Number(amount),
        currency: currency,
        status: stripePayout.status,
        arrivalDate: new Date(stripePayout.arrival_date * 1000),
        creator: {
          id: creator.id,
          name: creator.user.name,
          email: creator.user.email,
        }
      },
      auditLog: {
        id: auditLog.id,
        action: auditLog.action,
        createdAt: auditLog.createdAt,
      }
    });
  } catch (error) {
    console.error('Error triggering payout:', error);
    return NextResponse.json(
      { error: 'Erreur lors du déclenchement du paiement' },
      { status: 500 }
    );
  }
}

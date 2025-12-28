import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { PayoutAction, PayoutStatus, LogLevel, LogActor } from '@prisma/client';
import { logPayoutEvent, logError as logSystemError, logInfo } from '@/lib/system-logger';

/**
 * POST /api/creators/payouts/request
 * Creator requests a manual payout (only if payoutSchedule is MANUAL)
 */
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  
  try {
    // Verify user is authenticated as creator
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'CREATOR') {
      // Log unauthorized access attempt
      await logSystemError(
        'PAYOUT_REQUEST_UNAUTHORIZED',
        LogActor.GUEST,
        'Tentative de demande de payout non autorisée',
        undefined,
        {
          endpoint: '/api/creators/payouts/request',
          hasAuth: !!jwtUser,
          role: jwtUser?.role,
        }
      );
      
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { amount } = body;

    // Get creator with account details
    const creator = await db.creator.findUnique({
      where: { userId: jwtUser.userId },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    // ✅ NEW: Use creator's currency instead of hardcoded 'eur'
    const currency = (creator?.currency || 'EUR').toLowerCase();

    if (!creator) {
      // Log creator not found
      await logSystemError(
        'PAYOUT_REQUEST_CREATOR_NOT_FOUND',
        LogActor.USER,
        'Créateur introuvable lors de la demande de payout',
        jwtUser.userId,
        {
          userId: jwtUser.userId,
          endpoint: '/api/creators/payouts/request',
        }
      );
      
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }
    
    // Log payout request initiation
    await logInfo(
      'PAYOUT_REQUEST_INITIATED',
      LogActor.CREATOR,
      `Demande de payout initiée par ${creator.user.name}`,
      creator.id,
      {
        creatorId: creator.id,
        creatorEmail: creator.user.email,
        requestedAmount: amount,
        currency: currency.toUpperCase(),
        payoutSchedule: creator.payoutSchedule,
      }
    );

    // Check if creator's payout schedule is MANUAL
    if (creator.payoutSchedule !== 'MANUAL') {
      // Log validation error
      await logSystemError(
        'PAYOUT_REQUEST_VALIDATION_ERROR',
        LogActor.CREATOR,
        'Demande de payout refusée : planning de paiement non MANUAL',
        creator.id,
        {
          creatorId: creator.id,
          currentSchedule: creator.payoutSchedule,
          requestedAmount: amount,
          currency: currency.toUpperCase(),
        }
      );
      
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
        // ✅ MODIFIED: Use currency symbol in message
        errors.push(`Le montant minimum de paiement est de ${minimumAmount} ${currency.toUpperCase()}`);
      }
    }

    // ✅ REMOVED: Currency validation - now supports all currencies

    if (errors.length > 0) {
      // Log validation error
      await logSystemError(
        'PAYOUT_REQUEST_VALIDATION_ERROR',
        LogActor.CREATOR,
        `Erreurs de validation: ${errors.join(', ')}`,
        creator.id,
        {
          creatorId: creator.id,
          validationErrors: errors,
          requestedAmount: amount,
          currency: currency.toUpperCase(),
        }
      );
      
      return NextResponse.json(
        { error: 'Validation échouée', details: errors },
        { status: 400 }
      );
    }

    // Check if creator has Stripe account
    if (!creator.stripeAccountId) {
      // Log Stripe account not configured
      await logSystemError(
        'PAYOUT_REQUEST_NO_STRIPE_ACCOUNT',
        LogActor.CREATOR,
        'Demande de payout refusée : compte Stripe non configuré',
        creator.id,
        {
          creatorId: creator.id,
          creatorEmail: creator.user.email,
          requestedAmount: amount,
          currency: currency.toUpperCase(),
        }
      );
      
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
      // Log payout blocked
      await logSystemError(
        'PAYOUT_REQUEST_BLOCKED',
        LogActor.CREATOR,
        `Demande de payout refusée : payouts bloqués`,
        creator.id,
        {
          creatorId: creator.id,
          creatorEmail: creator.user.email,
          requestedAmount: amount,
          currency: currency.toUpperCase(),
          blockReason: creator.payoutBlockReason,
        }
      );
      
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
      // Log Stripe account verification start
      await logInfo(
        'PAYOUT_REQUEST_STRIPE_VERIFICATION',
        LogActor.SYSTEM,
        `Vérification du compte Stripe pour la demande de payout`,
        creator.id,
        {
          creatorId: creator.id,
          stripeAccountId: creator.stripeAccountId,
          requestedAmount: amount,
          currency: currency.toUpperCase(),
        }
      );
      
      stripeAccount = await stripe.accounts.retrieve(creator.stripeAccountId);
      
      // Log successful Stripe account retrieval
      await logInfo(
        'PAYOUT_REQUEST_STRIPE_VERIFICATION_SUCCESS',
        LogActor.SYSTEM,
        `Compte Stripe vérifié avec succès`,
        creator.id,
        {
          creatorId: creator.id,
          stripeAccountId: creator.stripeAccountId,
          chargesEnabled: stripeAccount.charges_enabled,
          payoutsEnabled: stripeAccount.payouts_enabled,
          detailsSubmitted: stripeAccount.details_submitted,
        }
      );
    } catch (stripeError: any) {
      console.error('Error retrieving Stripe account:', stripeError);
      
      // Log Stripe error
      await logSystemError(
        'PAYOUT_REQUEST_STRIPE_ERROR',
        LogActor.SYSTEM,
        `Erreur lors de la récupération du compte Stripe: ${stripeError.message}`,
        creator.id,
        {
          creatorId: creator.id,
          stripeAccountId: creator.stripeAccountId,
          errorType: stripeError.type,
          errorCode: stripeError.code,
          errorMessage: stripeError.message,
        }
      );
      
      return NextResponse.json(
        { error: 'Erreur lors de la récupération du compte Stripe' },
        { status: 500 }
      );
    }

    // Validate KYC is complete
    if (!stripeAccount.charges_enabled) {
      // Log KYC incomplete
      await logSystemError(
        'PAYOUT_REQUEST_KYC_INCOMPLETE',
        LogActor.CREATOR,
        'Demande de payout refusée : KYC incomplet',
        creator.id,
        {
          creatorId: creator.id,
          stripeAccountId: creator.stripeAccountId,
          chargesEnabled: false,
          payoutsEnabled: stripeAccount.payouts_enabled,
        }
      );
      
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
      // Log bank account not verified
      await logSystemError(
        'PAYOUT_REQUEST_BANK_NOT_VERIFIED',
        LogActor.CREATOR,
        'Demande de payout refusée : compte bancaire non validé',
        creator.id,
        {
          creatorId: creator.id,
          stripeAccountId: creator.stripeAccountId,
          chargesEnabled: stripeAccount.charges_enabled,
          payoutsEnabled: false,
        }
      );
      
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
      // Log balance check
      await logInfo(
        'PAYOUT_REQUEST_BALANCE_CHECK',
        LogActor.SYSTEM,
        `Vérification du solde disponible pour la demande de payout`,
        creator.id,
        {
          creatorId: creator.id,
          stripeAccountId: creator.stripeAccountId,
          requestedAmount: amount,
          currency: currency.toUpperCase(),
        }
      );
      
      balance = await stripe.balance.retrieve({
        stripeAccount: creator.stripeAccountId,
      });
      
      // Log balance retrieved
      await logInfo(
        'PAYOUT_REQUEST_BALANCE_RETRIEVED',
        LogActor.SYSTEM,
        `Solde récupéré avec succès`,
        creator.id,
        {
          creatorId: creator.id,
          availableBalances: balance.available.map(b => ({
            currency: b.currency,
            amount: b.amount / 100,
          })),
          pendingBalances: balance.pending.map(b => ({
            currency: b.currency,
            amount: b.amount / 100,
          })),
        }
      );
    } catch (stripeError: any) {
      console.error('Error retrieving balance:', stripeError);
      
      // Log balance retrieval error
      await logSystemError(
        'PAYOUT_REQUEST_BALANCE_ERROR',
        LogActor.SYSTEM,
        `Erreur lors de la récupération du solde: ${stripeError.message}`,
        creator.id,
        {
          creatorId: creator.id,
          stripeAccountId: creator.stripeAccountId,
          errorType: stripeError.type,
          errorCode: stripeError.code,
          errorMessage: stripeError.message,
        }
      );
      
      return NextResponse.json(
        { error: 'Erreur lors de la récupération du solde' },
        { status: 500 }
      );
    }

    // ✅ MODIFIED: Check balance in creator's currency
    const availableBalance = balance.available.find(b => b.currency === currency);
    const requestedAmountInCents = Math.round(Number(amount) * 100);
    
    if (!availableBalance) {
      // Log currency not found
      await logSystemError(
        'PAYOUT_REQUEST_CURRENCY_NOT_FOUND',
        LogActor.CREATOR,
        `Solde non trouvé dans la devise ${currency.toUpperCase()}`,
        creator.id,
        {
          creatorId: creator.id,
          requestedCurrency: currency.toUpperCase(),
          availableCurrencies: balance.available.map(b => b.currency.toUpperCase()),
        }
      );
      
      return NextResponse.json(
        { 
          error: 'Solde non trouvé',
          message: `Aucun solde trouvé dans la devise ${currency.toUpperCase()}. Votre compte Stripe est peut-être configuré dans une autre devise.`,
          availableCurrencies: balance.available.map(b => b.currency.toUpperCase())
        },
        { status: 400 }
      );
    }

    if (availableBalance.amount < requestedAmountInCents) {
      const availableAmount = (availableBalance.amount / 100).toFixed(2);
      
      // Log insufficient balance
      await logSystemError(
        'PAYOUT_REQUEST_INSUFFICIENT_BALANCE',
        LogActor.CREATOR,
        `Solde insuffisant pour la demande de payout`,
        creator.id,
        {
          creatorId: creator.id,
          requestedAmount: amount,
          availableAmount: availableAmount,
          currency: currency.toUpperCase(),
        }
      );
      
      return NextResponse.json(
        { 
          error: 'Solde insuffisant',
          message: `Solde disponible: ${availableAmount} ${currency.toUpperCase()}, Montant demandé: ${amount} ${currency.toUpperCase()}`,
          availableBalance: Number(availableAmount),
          currency: currency.toUpperCase()
        },
        { status: 400 }
      );
    }

    // Create payout via Stripe
    let stripePayout;
    try {
      // Log payout creation start
      await logInfo(
        'PAYOUT_REQUEST_STRIPE_CREATION',
        LogActor.SYSTEM,
        `Création du payout Stripe en cours`,
        creator.id,
        {
          creatorId: creator.id,
          amount: amount,
          amountInCents: requestedAmountInCents,
          currency: currency.toUpperCase(),
          stripeAccountId: creator.stripeAccountId,
        }
      );
      
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
      
      // Log successful payout creation
      await logInfo(
        'PAYOUT_REQUEST_STRIPE_CREATION_SUCCESS',
        LogActor.SYSTEM,
        `Payout Stripe créé avec succès`,
        creator.id,
        {
          creatorId: creator.id,
          stripePayoutId: stripePayout.id,
          amount: amount,
          currency: currency.toUpperCase(),
          status: stripePayout.status,
          arrivalDate: new Date(stripePayout.arrival_date * 1000).toISOString(),
        }
      );
    } catch (stripeError: any) {
      console.error('Error creating payout:', stripeError);
      
      // Log comprehensive Stripe error
      await logSystemError(
        'PAYOUT_REQUEST_STRIPE_CREATION_ERROR',
        LogActor.SYSTEM,
        `Échec de création du payout Stripe: ${stripeError.message}`,
        creator.id,
        {
          creatorId: creator.id,
          creatorEmail: creator.user.email,
          amount: amount,
          currency: currency.toUpperCase(),
          stripeErrorType: stripeError.type,
          stripeErrorCode: stripeError.code,
          stripeErrorMessage: stripeError.message,
          stripeErrorDeclineCode: stripeError.decline_code,
        }
      );
      
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
    
    // Log successful payout request completion
    const requestDuration = Date.now() - requestStartTime;
    await logPayoutEvent(
      'REQUESTED',
      stripePayout.id,
      creator.id,
      Number(amount),
      currency.toUpperCase(),
      LogLevel.INFO,
      {
        creatorId: creator.id,
        creatorEmail: creator.user.email,
        stripePayoutId: stripePayout.id,
        status: stripePayout.status,
        arrivalDate: new Date(stripePayout.arrival_date * 1000).toISOString(),
        triggeredBy: 'creator',
        auditLogId: auditLog.id,
        processingTimeMs: requestDuration,
      }
    );

    // ✅ MODIFIED: Return currency in uppercase for consistency
    return NextResponse.json({
      message: 'Demande de paiement créée avec succès',
      payout: {
        id: stripePayout.id,
        amount: Number(amount),
        currency: currency.toUpperCase(), // ✅ MODIFIED: Return uppercase currency
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
    
    // Log fatal error
    const requestDuration = Date.now() - requestStartTime;
    await logSystemError(
      'PAYOUT_REQUEST_FATAL_ERROR',
      LogActor.SYSTEM,
      `Erreur fatale lors de la demande de payout: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: requestDuration,
      }
    );
    
    return NextResponse.json(
      { error: 'Erreur lors de la demande de paiement' },
      { status: 500 }
    );
  }
}

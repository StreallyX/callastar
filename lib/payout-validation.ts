import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Payout eligibility check result
 */
export interface PayoutEligibility extends ValidationResult {
  creator?: any;
  account?: Stripe.Account;
  balance?: Stripe.Balance;
  checks: {
    hasStripeAccount: boolean;
    kycComplete: boolean;
    bankValidated: boolean;
    notBlocked: boolean;
    sufficientBalance: boolean;
    meetsMinimum: boolean;
  };
}

/**
 * Validate minimum payout amount (must be >= 10€)
 */
export function checkMinimumAmount(amount: number): ValidationResult {
  const errors: string[] = [];
  
  if (amount < 10) {
    errors.push('Le montant minimum de paiement est de 10€');
  }
  
  if (amount > 1000000) {
    errors.push('Le montant maximum de paiement est de 1 000 000€');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if Stripe account is ready for payouts
 */
export async function checkStripeAccount(
  stripeAccountId: string
): Promise<ValidationResult & { account?: Stripe.Account }> {
  const errors: string[] = [];
  
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);
    
    if (!account.charges_enabled) {
      errors.push('La vérification KYC n\'est pas complétée');
    }
    
    if (!account.payouts_enabled) {
      errors.push('Le compte bancaire n\'est pas validé');
    }

    if (!account.details_submitted) {
      errors.push('Les détails du compte Stripe ne sont pas complets');
    }

    return {
      isValid: errors.length === 0,
      errors,
      account,
    };
  } catch (error) {
    console.error('Error checking Stripe account:', error);
    errors.push('Erreur lors de la vérification du compte Stripe');
    return {
      isValid: false,
      errors,
    };
  }
}

/**
 * Check if creator has sufficient balance for payout
 */
export async function checkBalance(
  stripeAccountId: string,
  amount: number,
  currency: string = 'eur'
): Promise<ValidationResult & { balance?: Stripe.Balance; available?: number }> {
  const errors: string[] = [];
  
  try {
    const balance = await stripe.balance.retrieve({
      stripeAccount: stripeAccountId,
    });
    
    const availableBalance = balance.available.find(b => b.currency === currency);
    
    if (!availableBalance) {
      errors.push(`Aucun solde disponible en ${currency.toUpperCase()}`);
      return {
        isValid: false,
        errors,
        balance,
        available: 0,
      };
    }
    
    const availableAmountEur = availableBalance.amount / 100;
    const requestedAmount = Number(amount);
    
    if (availableAmountEur < requestedAmount) {
      errors.push(`Solde insuffisant. Disponible: ${availableAmountEur.toFixed(2)}€, Demandé: ${requestedAmount.toFixed(2)}€`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      balance,
      available: availableAmountEur,
    };
  } catch (error) {
    console.error('Error checking balance:', error);
    errors.push('Erreur lors de la vérification du solde');
    return {
      isValid: false,
      errors,
      available: 0,
    };
  }
}

/**
 * Check if holding period has passed for payments
 * Note: This checks the Payment model's payoutStatus and payoutReleaseDate
 */
export async function checkHoldingPeriod(creatorId: string): Promise<ValidationResult> {
  const errors: string[] = [];
  
  try {
    // Get creator's bookings with payments
    const creator = await db.creator.findUnique({
      where: { id: creatorId },
      include: {
        callOffers: {
          include: {
            booking: {
              include: {
                payment: true,
              }
            }
          }
        }
      }
    });

    if (!creator) {
      errors.push('Créateur introuvable');
      return { isValid: false, errors };
    }

    // Check if any payments are still held
    const heldPayments = creator.callOffers
      .flatMap(offer => offer.booking ? [offer.booking] : [])
      .filter(booking => booking.payment)
      .map(booking => booking.payment!)
      .filter(payment => payment.payoutStatus === 'REQUESTED');

    if (heldPayments.length > 0) {
      const earliestRelease = heldPayments
        .map(p => p.payoutReleaseDate)
        .filter((date): date is Date => date !== null)
        .sort((a, b) => a.getTime() - b.getTime())[0];

      if (earliestRelease) {
        errors.push(`Certains paiements sont encore en période de sécurisation. Prochain déblocage: ${earliestRelease.toLocaleDateString('fr-FR')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  } catch (error) {
    console.error('Error checking holding period:', error);
    errors.push('Erreur lors de la vérification de la période de sécurisation');
    return {
      isValid: false,
      errors,
    };
  }
}

/**
 * Comprehensive payout eligibility check
 */
export async function validatePayoutEligibility(
  creatorId: string,
  amount?: number
): Promise<PayoutEligibility> {
  const errors: string[] = [];
  const checks = {
    hasStripeAccount: false,
    kycComplete: false,
    bankValidated: false,
    notBlocked: false,
    sufficientBalance: false,
    meetsMinimum: false,
  };

  try {
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
      errors.push('Créateur introuvable');
      return { isValid: false, errors, checks };
    }

    // Check if blocked
    if (creator.isPayoutBlocked) {
      errors.push(`Les paiements sont bloqués. Raison: ${creator.payoutBlockReason || 'Non spécifiée'}`);
    } else {
      checks.notBlocked = true;
    }

    // Check if has Stripe account
    if (!creator.stripeAccountId) {
      errors.push('Compte Stripe non configuré');
      return { isValid: false, errors, checks, creator };
    }
    checks.hasStripeAccount = true;

    // Check Stripe account status
    const accountCheck = await checkStripeAccount(creator.stripeAccountId);
    if (!accountCheck.isValid) {
      errors.push(...accountCheck.errors);
    } else {
      checks.kycComplete = accountCheck.account?.charges_enabled || false;
      checks.bankValidated = accountCheck.account?.payouts_enabled || false;
    }

    // If amount is provided, validate it
    if (amount !== undefined) {
      // Check minimum amount
      const minimumCheck = checkMinimumAmount(amount);
      if (!minimumCheck.isValid) {
        errors.push(...minimumCheck.errors);
      } else {
        checks.meetsMinimum = true;
      }

      // Check if meets creator's minimum
      const creatorMinimum = Number(creator.payoutMinimum);
      if (amount < creatorMinimum) {
        errors.push(`Le montant doit être au moins ${creatorMinimum}€ (minimum défini par le créateur)`);
        checks.meetsMinimum = false;
      }

      // Check balance
      const balanceCheck = await checkBalance(creator.stripeAccountId, amount);
      if (!balanceCheck.isValid) {
        errors.push(...balanceCheck.errors);
      } else {
        checks.sufficientBalance = true;
      }

      return {
        isValid: errors.length === 0,
        errors,
        checks,
        creator,
        account: accountCheck.account,
        balance: balanceCheck.balance,
      };
    }

    return {
      isValid: errors.length === 0,
      errors,
      checks,
      creator,
      account: accountCheck.account,
    };
  } catch (error) {
    console.error('Error validating payout eligibility:', error);
    errors.push('Erreur lors de la validation de l\'éligibilité au paiement');
    return {
      isValid: false,
      errors,
      checks,
    };
  }
}

/**
 * Validate currency
 */
export function validateCurrency(currency: string): ValidationResult {
  const supportedCurrencies = ['eur'];
  const errors: string[] = [];

  if (!supportedCurrencies.includes(currency.toLowerCase())) {
    errors.push(`Devise non supportée. Devises supportées: ${supportedCurrencies.join(', ').toUpperCase()}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate payout schedule
 */
export function validatePayoutSchedule(schedule: string): ValidationResult {
  const validSchedules = ['DAILY', 'WEEKLY', 'MANUAL'];
  const errors: string[] = [];

  if (!validSchedules.includes(schedule)) {
    errors.push(`Planning de paiement invalide. Valeurs valides: ${validSchedules.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if creator can request manual payout
 */
export async function canRequestManualPayout(creatorId: string): Promise<ValidationResult> {
  const errors: string[] = [];

  try {
    const creator = await db.creator.findUnique({
      where: { id: creatorId },
    });

    if (!creator) {
      errors.push('Créateur introuvable');
      return { isValid: false, errors };
    }

    if (creator.payoutSchedule !== 'MANUAL') {
      errors.push(`Les demandes manuelles ne sont pas activées. Planning actuel: ${creator.payoutSchedule}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  } catch (error) {
    console.error('Error checking manual payout eligibility:', error);
    errors.push('Erreur lors de la vérification de l\'éligibilité au paiement manuel');
    return {
      isValid: false,
      errors,
    };
  }
}

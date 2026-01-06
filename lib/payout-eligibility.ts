import prisma from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { getPlatformSettings } from '@/lib/settings';
import { PayoutFrequency } from '@prisma/client';

/**
 * Payout Eligibility Result
 */
export interface PayoutEligibilityResult {
  eligible: boolean;
  reason?: string;
  availableBalance?: number;
  requirements?: string[];
  details?: {
    hasStripeAccount: boolean;
    stripeAccountId?: string;
    payoutBlocked: boolean;
    payoutBlockReason?: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    kycComplete: boolean;
    bankAccountConnected: boolean;
    meetsMinimumAmount: boolean;
    minimumAmount: number;
    availableBalance: number;
    currency: string;
    holdingPeriodPassed: boolean;
    pendingRequirements: string[];
  };
}

/**
 * Balance Cache - prevents rate limiting from Stripe
 * Cache balance for 30 seconds per creator
 */
const balanceCache = new Map<string, { balance: number; timestamp: number }>();
const BALANCE_CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Check if a creator is eligible for payout
 * Comprehensive eligibility checker for automatic and manual payouts
 */
export async function checkPayoutEligibility(
  creatorId: string
): Promise<PayoutEligibilityResult> {
  const requirements: string[] = [];
  const details: PayoutEligibilityResult['details'] = {
    hasStripeAccount: false,
    payoutBlocked: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    kycComplete: false,
    bankAccountConnected: false,
    meetsMinimumAmount: false,
    minimumAmount: 0,
    availableBalance: 0,
    currency: 'EUR',
    holdingPeriodPassed: false,
    pendingRequirements: [],
  };

  try {
    // 1. Check if creator exists
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      select: {
        id: true,
        stripeAccountId: true,
        payoutBlocked: true,
        payoutBlockReason: true,
        isStripeOnboarded: true,
      },
    });

    if (!creator) {
      return {
        eligible: false,
        reason: 'Creator not found',
        requirements: ['Creator account does not exist'],
      };
    }

    // 2. Check if creator has Stripe account
    if (!creator.stripeAccountId || !creator.isStripeOnboarded) {
      requirements.push('Stripe Connect account not configured');
      return {
        eligible: false,
        reason: 'Stripe Connect account not configured',
        requirements,
        details: {
          ...details,
          hasStripeAccount: false,
        },
      };
    }

    details.hasStripeAccount = true;
    details.stripeAccountId = creator.stripeAccountId;

    // 3. Check if payout is blocked by admin
    if (creator.payoutBlocked) {
      requirements.push(`Payouts blocked: ${creator.payoutBlockReason || 'Unknown reason'}`);
      details.payoutBlocked = true;
      details.payoutBlockReason = creator.payoutBlockReason || undefined;
      
      return {
        eligible: false,
        reason: `Payouts blocked: ${creator.payoutBlockReason || 'Unknown reason'}`,
        requirements,
        details,
      };
    }

    // 4. Fetch Stripe account details
    let stripeAccount;
    try {
      stripeAccount = await stripe.accounts.retrieve(creator.stripeAccountId);
    } catch (error: any) {
      requirements.push('Failed to retrieve Stripe account');
      return {
        eligible: false,
        reason: 'Failed to retrieve Stripe account: ' + error.message,
        requirements,
        details,
      };
    }

    // 5. Check charges_enabled
    if (!stripeAccount.charges_enabled) {
      requirements.push('Charges not enabled on Stripe account');
      details.chargesEnabled = false;
    } else {
      details.chargesEnabled = true;
    }

    // 6. Check payouts_enabled
    if (!stripeAccount.payouts_enabled) {
      requirements.push('Payouts not enabled on Stripe account');
      details.payoutsEnabled = false;
    } else {
      details.payoutsEnabled = true;
    }

    // 7. Check KYC requirements
    const currentlyDue = stripeAccount.requirements?.currently_due || [];
    if (currentlyDue.length > 0) {
      requirements.push(`KYC requirements pending: ${currentlyDue.join(', ')}`);
      details.kycComplete = false;
      details.pendingRequirements = currentlyDue;
    } else {
      details.kycComplete = true;
    }

    // 8. Check external accounts (bank account)
    const externalAccounts = stripeAccount.external_accounts?.data || [];
    if (externalAccounts.length === 0) {
      requirements.push('No bank account connected');
      details.bankAccountConnected = false;
    } else {
      details.bankAccountConnected = true;
    }

    // 9. Fetch available balance from Stripe
    let availableBalance = 0;
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: creator.stripeAccountId,
      });

      // Get available balance in primary currency (EUR)
      const availableBalances = balance.available.filter((b) => b.currency === 'eur');
      if (availableBalances.length > 0) {
        availableBalance = availableBalances[0].amount / 100; // Convert from cents
      }

      details.availableBalance = availableBalance;
      details.currency = 'EUR';
    } catch (error: any) {
      console.error('Error fetching balance:', error);
      requirements.push('Failed to fetch available balance');
      return {
        eligible: false,
        reason: 'Failed to fetch available balance: ' + error.message,
        requirements,
        details,
      };
    }

    // 10. Get platform settings for minimum payout amount
    const settings = await getPlatformSettings();
    const minimumPayoutAmount = Number(settings.minimumPayoutAmount);
    details.minimumAmount = minimumPayoutAmount;

    // 11. Check if available balance meets minimum
    if (availableBalance < minimumPayoutAmount) {
      requirements.push(
        `Available balance (${availableBalance.toFixed(2)} EUR) is below minimum (${minimumPayoutAmount.toFixed(2)} EUR)`
      );
      details.meetsMinimumAmount = false;
    } else {
      details.meetsMinimumAmount = true;
    }

    // 12. Check holding period
    const holdingPeriodDays = Number(settings.holdingPeriodDays);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - holdingPeriodDays);

    const recentPayments = await prisma.payment.findMany({
      where: {
        booking: {
          callOffer: {
            creatorId: creator.id,
          },
        },
        status: 'SUCCEEDED',
        payoutStatus: {
          in: ['REQUESTED', 'APPROVED'],
        },
        createdAt: {
          gt: cutoffDate,
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    // Check if all payments have passed holding period
    const now = new Date();
    const allPaymentsPastHolding = recentPayments.every((payment) => {
      const paymentDate = new Date(payment.createdAt);
      const holdingEndDate = new Date(paymentDate);
      holdingEndDate.setDate(holdingEndDate.getDate() + holdingPeriodDays);
      return now >= holdingEndDate;
    });

    if (!allPaymentsPastHolding && recentPayments.length > 0) {
      requirements.push(
        `Some payments are still in holding period (${holdingPeriodDays} days)`
      );
      details.holdingPeriodPassed = false;
    } else {
      details.holdingPeriodPassed = true;
    }

    // Final eligibility check
    if (requirements.length > 0) {
      return {
        eligible: false,
        reason: 'One or more eligibility requirements not met',
        availableBalance,
        requirements,
        details,
      };
    }

    return {
      eligible: true,
      availableBalance,
      requirements: [],
      details,
    };
  } catch (error: any) {
    console.error('Error checking payout eligibility:', error);
    return {
      eligible: false,
      reason: 'Error checking eligibility: ' + error.message,
      requirements: ['Internal error occurred'],
    };
  }
}

/**
 * Get creator's available balance from Stripe (with caching)
 * Returns balance in EUR
 */
export async function getCreatorAvailableBalance(
  creatorId: string
): Promise<number | null> {
  try {
    // Check cache first
    const cached = balanceCache.get(creatorId);
    if (cached && Date.now() - cached.timestamp < BALANCE_CACHE_TTL) {
      return cached.balance;
    }

    // Fetch creator
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      select: { stripeAccountId: true },
    });

    if (!creator?.stripeAccountId) {
      return null;
    }

    // Fetch balance from Stripe
    const balance = await stripe.balance.retrieve({
      stripeAccount: creator.stripeAccountId,
    });

    // Get available balance in EUR
    const availableBalances = balance.available.filter((b) => b.currency === 'eur');
    const availableBalance = availableBalances.length > 0 
      ? availableBalances[0].amount / 100 
      : 0;

    // Cache the result
    balanceCache.set(creatorId, {
      balance: availableBalance,
      timestamp: Date.now(),
    });

    return availableBalance;
  } catch (error) {
    console.error('Error fetching creator balance:', error);
    return null;
  }
}

/**
 * Calculate next payout date based on frequency
 */
export function calculateNextPayoutDate(
  frequency: PayoutFrequency,
  currentDate: Date = new Date()
): Date {
  const nextDate = new Date(currentDate);

  switch (frequency) {
    case 'DAILY':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'WEEKLY':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'MONTHLY':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    default:
      // Default to weekly
      nextDate.setDate(nextDate.getDate() + 7);
  }

  return nextDate;
}

/**
 * Clear balance cache for a creator (useful after payout)
 */
export function clearBalanceCache(creatorId: string): void {
  balanceCache.delete(creatorId);
}

/**
 * Clear all balance cache (useful for testing)
 */
export function clearAllBalanceCache(): void {
  balanceCache.clear();
}

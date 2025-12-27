import Stripe from 'stripe';
import prisma from '@/lib/db';

// Allow build to succeed even without STRIPE_SECRET_KEY
// At runtime, operations will fail with proper error messages
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_for_build';

if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  STRIPE_SECRET_KEY is not defined in environment variables');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

export const PAYOUT_HOLDING_DAYS = 7; // Hold payments for 7 days before allowing payout

// ❌ OBSOLÈTE : PLATFORM_FEE_PERCENTAGE et calculateFees() supprimés
// ✅ NOUVEAU : La commission est maintenant gérée dynamiquement via PlatformSettings
// Pour obtenir la commission: utilisez getPlatformSettings().platformFeePercentage

/**
 * Calculate payout release date (7 days from payment)
 */
export function calculatePayoutReleaseDate(paymentDate: Date): Date {
  const releaseDate = new Date(paymentDate);
  releaseDate.setDate(releaseDate.getDate() + PAYOUT_HOLDING_DAYS);
  return releaseDate;
}

/**
 * Get creator's currency from DB or Stripe account
 * 
 * @param creatorId - Creator ID in database
 * @returns Currency code (e.g., 'GBP', 'EUR', 'CHF')
 * 
 * ✅ Priority:
 * 1. Check creator.currency in DB (cached value)
 * 2. Fetch from Stripe account if not in DB
 * 3. Update DB with fetched currency
 * 4. Default to 'EUR' if all fails
 */
export async function getCreatorCurrency(creatorId: string): Promise<string> {
  try {
    // 1. Try to get from DB first (fastest)
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      select: { 
        currency: true, 
        stripeAccountId: true 
      },
    });

    if (!creator) {
      console.warn(`[getCreatorCurrency] Creator ${creatorId} not found`);
      return 'EUR';
    }

    // If currency is already cached in DB, return it
    if (creator.currency) {
      return creator.currency.toUpperCase();
    }

    // 2. If no currency in DB, fetch from Stripe
    if (!creator.stripeAccountId) {
      console.warn(`[getCreatorCurrency] Creator ${creatorId} has no Stripe account`);
      return 'EUR';
    }

    const stripeAccount = await stripe.accounts.retrieve(creator.stripeAccountId);
    const currency = (stripeAccount.default_currency || 'eur').toUpperCase();

    // 3. Update DB with fetched currency
    await prisma.creator.update({
      where: { id: creatorId },
      data: { currency },
    });

    console.log(`[getCreatorCurrency] Fetched and cached currency for creator ${creatorId}: ${currency}`);
    return currency;
  } catch (error) {
    console.error(`[getCreatorCurrency] Error fetching currency for creator ${creatorId}:`, error);
    return 'EUR';
  }
}

/**
 * Get creator's currency by Stripe account ID
 * 
 * @param stripeAccountId - Stripe Connect account ID
 * @returns Currency code (e.g., 'GBP', 'EUR', 'CHF')
 */
export async function getCreatorCurrencyByStripeAccount(stripeAccountId: string): Promise<string> {
  try {
    // Try to find creator in DB first
    const creator = await prisma.creator.findFirst({
      where: { stripeAccountId },
      select: { id: true, currency: true },
    });

    if (creator?.currency) {
      return creator.currency.toUpperCase();
    }

    // Fetch from Stripe
    const stripeAccount = await stripe.accounts.retrieve(stripeAccountId);
    const currency = (stripeAccount.default_currency || 'eur').toUpperCase();

    // Update DB if we found the creator
    if (creator?.id) {
      await prisma.creator.update({
        where: { id: creator.id },
        data: { currency },
      });
    }

    return currency;
  } catch (error) {
    console.error(`[getCreatorCurrencyByStripeAccount] Error fetching currency:`, error);
    return 'EUR';
  }
}

/**
 * Create a Stripe Payment Intent using Destination Charges (Option 1)
 * 
 * ✅ DESTINATION CHARGES ARCHITECTURE:
 * - Charge is created on platform account WITH transfer_data
 * - Transfer happens automatically by Stripe when payment succeeds
 * - Platform retains application_fee_amount as commission
 * - Creator receives payment MINUS platform fee and Stripe fees
 * 
 * Example calculation for 100 EUR payment with 15% commission:
 * 1. Client pays: 100.00 EUR → Platform account
 * 2. Stripe deducts fees: ~3.20 EUR (from creator's share)
 * 3. Platform keeps: 15.00 EUR commission (application_fee_amount)
 * 4. Creator receives: 81.80 EUR (100 - 15 - 3.20)
 * 5. Net platform: ~11.80 EUR (15.00 - platform's Stripe fees)
 * 
 * Benefits:
 * - Simpler webhook logic (no manual Transfer creation)
 * - Stripe handles the transfer automatically
 * - Lower risk of transfer failures
 * - Immediate fund availability to creator
 */
export async function createPaymentIntent({
  amount,
  currency = 'eur',
  metadata = {},
  stripeAccountId,
  platformFeePercentage,
}: {
  amount: number;
  currency?: string;
  metadata?: Record<string, string>;
  stripeAccountId?: string | null;
  platformFeePercentage?: number;
}) {
  try {
    const amountInCents = Math.round(amount * 100);
    
    // Calculate platform fee (15% of total for default 15% commission)
    const feePercentage = platformFeePercentage || 15; // Default 15%
    const platformFeeInCents = Math.round(amountInCents * (feePercentage / 100));

    // ✅ DESTINATION CHARGES: Use transfer_data and application_fee_amount
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency: currency.toLowerCase(),
      transfer_data: stripeAccountId ? {
        destination: stripeAccountId,
      } : undefined,
      application_fee_amount: stripeAccountId ? platformFeeInCents : undefined,
      metadata: {
        ...metadata,
        // ✅ Store for tracking purposes only
        creatorId: metadata.creatorId || '',
        offerId: metadata.offerId || '',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    };

    console.log('💳 Creating payment intent with Destination Charges:', {
      amount: amount,
      currency: currency,
      platformFeePercentage: feePercentage,
      platformFee: (platformFeeInCents / 100).toFixed(2),
      destination: stripeAccountId || 'none (no transfer)',
      note: 'Stripe will handle the transfer automatically',
    });

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    console.log('✅ Payment Intent created:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      transfer_data: paymentIntent.transfer_data,
      application_fee_amount: paymentIntent.application_fee_amount,
    });

    return paymentIntent;
  } catch (error) {
    console.error('❌ Error creating payment intent:', error);
    throw error;
  }
}

/**
 * Create a payout (transfer) to creator's Stripe Connect account
 * Should only be called after holding period has passed
 */
export async function createPayout({
  amount,
  stripeAccountId,
  metadata = {},
}: {
  amount: number;
  stripeAccountId: string;
  metadata?: Record<string, string>;
}) {
  try {
    // Create a transfer to the connected account
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'eur',
      destination: stripeAccountId,
      metadata,
    });

    return transfer;
  } catch (error) {
    console.error('Error creating payout:', error);
    throw error;
  }
}

/**
 * Retrieve Stripe Connect account details
 */
export async function getConnectAccountDetails(stripeAccountId: string) {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);
    return account;
  } catch (error) {
    console.error('Error retrieving account details:', error);
    throw error;
  }
}

/**
 * Retrieve a Payment Intent
 */
export async function retrievePaymentIntent(paymentIntentId: string) {
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    console.error('Error retrieving payment intent:', error);
    throw error;
  }
}

/**
 * Get balance from a Stripe Connect account
 * This shows the available and pending balance for the creator
 */
export async function getConnectAccountBalance(stripeAccountId: string) {
  try {
    const balance = await stripe.balance.retrieve({
      stripeAccount: stripeAccountId,
    });
    return balance;
  } catch (error) {
    console.error('Error retrieving account balance:', error);
    throw error;
  }
}

/**
 * Create a payout from creator's Stripe Connect account to their bank account
 * This is what creators use to withdraw funds from their Stripe balance
 */
export async function createConnectPayout({
  amount,
  currency = 'eur',
  stripeAccountId,
  metadata = {},
}: {
  amount: number;
  currency?: string;
  stripeAccountId: string;
  metadata?: Record<string, string>;
}) {
  try {
    // Create payout on the connected account (not a transfer)
    const payout = await stripe.payouts.create(
      {
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata,
      },
      {
        stripeAccount: stripeAccountId, // Create on connected account
      }
    );

    console.log('💸 Created payout for connected account:', {
      amount,
      currency,
      stripeAccountId,
      payoutId: payout.id,
    });

    return payout;
  } catch (error) {
    console.error('Error creating connect payout:', error);
    throw error;
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    throw error;
  }
}

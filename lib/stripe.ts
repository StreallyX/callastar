import Stripe from 'stripe';

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
 * Create a Stripe Payment Intent using Separate Charges and Transfers
 * 
 * ✅ NEW ARCHITECTURE (Phase 1.1 - Separate Charges and Transfers):
 * - Charge is created on platform account (no destination)
 * - Transfer happens in webhook after payment_intent.succeeded
 * - Creator receives EXACTLY 85% of total (85 EUR for 100 EUR payment)
 * - Platform absorbs Stripe fees (~2.9% + €0.30)
 * 
 * Example calculation for 100 EUR payment with 15% commission:
 * 1. Client pays: 100.00 EUR → Platform account
 * 2. Stripe deducts fees: ~3.20 EUR from platform
 * 3. Platform keeps: 15.00 EUR commission
 * 4. Transfer to creator: 85.00 EUR (guaranteed via Transfer API)
 * 5. Net platform: 15.00 - 3.20 = 11.80 EUR
 * 
 * Benefits:
 * - Creator always receives exact expected amount (85 EUR, not 81.80)
 * - Platform absorbs all Stripe fees
 * - Better control over fund flow
 * - Same currency for charge and transfer (no conversion issues)
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
    
    // Calculate creator amount (85% of total for 15% commission)
    const feePercentage = platformFeePercentage || 15; // Default 15%
    const creatorAmount = amount * (1 - feePercentage / 100);
    const creatorAmountInCents = Math.round(creatorAmount * 100);
    const platformFeeAmount = amount - creatorAmount;

    // ✅ NEW: Separate Charges and Transfers
    // Create a simple PaymentIntent on platform account (no destination, no application_fee)
    // Transfer will be created in webhook after payment_intent.succeeded
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency: currency.toLowerCase(),
      metadata: {
        ...metadata,
        // ✅ Store creator info for webhook transfer
        creatorId: metadata.creatorId || '',
        offerId: metadata.offerId || '',
        stripeAccountId: stripeAccountId || '',
        // ✅ Store amounts for transfer calculation
        creatorAmount: String(creatorAmountInCents), // Amount in cents for transfer
        platformFeePercentage: String(feePercentage),
        platformFeeAmount: platformFeeAmount.toFixed(2),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    };

    console.log('💳 Creating payment intent with Separate Charges and Transfers:', {
      amount: amount,
      currency: currency,
      platformFeePercentage: feePercentage,
      platformFeeAmount: platformFeeAmount.toFixed(2),
      creatorAmount: creatorAmount.toFixed(2),
      creatorAmountCents: creatorAmountInCents,
      destination: stripeAccountId || 'none (transfer in webhook)',
    });

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    console.log('✅ Payment Intent created:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
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
 * Get creator's Stripe account currency
 * Retrieves the default currency from their Stripe Connect account
 * @param stripeAccountId - Stripe Connect account ID
 * @returns Currency code (EUR, CHF, USD, GBP, etc.) in uppercase
 */
export async function getCreatorCurrency(stripeAccountId: string): Promise<string> {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);
    const currency = account.default_currency || 'eur';
    return currency.toUpperCase();
  } catch (error) {
    console.error('Error fetching creator currency:', error);
    return 'EUR'; // Fallback to EUR
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

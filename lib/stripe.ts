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

export const PLATFORM_FEE_PERCENTAGE = 10; // 10% platform fee
export const PAYOUT_HOLDING_DAYS = 7; // Hold payments for 7 days before allowing payout

/**
 * Calculate platform fee and creator amount
 */
export function calculateFees(totalAmount: number) {
  const platformFee = (totalAmount * PLATFORM_FEE_PERCENTAGE) / 100;
  const creatorAmount = totalAmount - platformFee;
  
  return {
    platformFee: Number(platformFee.toFixed(2)),
    creatorAmount: Number(creatorAmount.toFixed(2)),
  };
}

/**
 * Calculate payout release date (7 days from payment)
 */
export function calculatePayoutReleaseDate(paymentDate: Date): Date {
  const releaseDate = new Date(paymentDate);
  releaseDate.setDate(releaseDate.getDate() + PAYOUT_HOLDING_DAYS);
  return releaseDate;
}

/**
 * Create a Stripe Payment Intent
 * 
 * For OnlyFans-style routing:
 * - Uses destination charges when stripeAccountId is provided
 * - Platform fee is automatically deducted
 * - Funds go to creator's Stripe Connect account balance immediately
 * - Creator can request payouts from their balance (manual or automatic)
 */
export async function createPaymentIntent({
  amount,
  currency = 'eur',
  metadata = {},
  stripeAccountId,
  platformFee,
}: {
  amount: number;
  currency?: string;
  metadata?: Record<string, string>;
  stripeAccountId?: string | null;
  platformFee?: number;
}) {
  try {
    const amountInCents = Math.round(amount * 100);
    const platformFeeInCents = platformFee ? Math.round(platformFee * 100) : 0;
    const creatorAmountInCents = amountInCents - platformFeeInCents;

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency,
      metadata: {
        ...metadata,
        stripeAccountId: stripeAccountId || '',
        platformFee: String(platformFee || 0),
        creatorAmount: String((amountInCents - platformFeeInCents) / 100),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    };

    // Use destination charges if creator has Stripe account
    // This automatically routes funds to creator's connected account balance
    // minus the platform fee (application_fee_amount)
    // ✅ FIX: Check for platformFee !== undefined to handle 0 fee edge case
    if (stripeAccountId && platformFee !== undefined) {
      paymentIntentParams.application_fee_amount = platformFeeInCents;
      paymentIntentParams.transfer_data = {
        destination: stripeAccountId,
      };

      console.log('💳 Creating destination charge:', {
        amount: amount,
        platformFee: platformFee,
        creatorAmount: (amountInCents - platformFeeInCents) / 100,
        destination: stripeAccountId,
      });
    } else {
      // Fallback: separate charges (funds held on platform)
      // Transfer happens manually via createPayout()
      console.log('💳 Creating separate charge (no connected account)', {
        stripeAccountId: stripeAccountId || 'not provided',
        platformFee: platformFee !== undefined ? platformFee : 'not provided',
      });
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    return paymentIntent;
  } catch (error) {
    console.error('Error creating payment intent:', error);
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

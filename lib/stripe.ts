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
 * Create a Stripe Payment Intent (separate charges - funds held on platform)
 * This allows us to implement a holding period before transferring to creators
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
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        ...metadata,
        // Store creator account ID in metadata for later transfer
        stripeAccountId: stripeAccountId || '',
        creatorAmount: platformFee ? String((amount - platformFee) * 100) : String(amount * 100),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    };

    // NOTE: We're using separate charges instead of destination charges
    // This keeps funds on the platform account, allowing us to:
    // 1. Hold payments for 7 days (dispute protection)
    // 2. Handle refunds/cancellations before payout
    // 3. Give admin control over payouts
    // The transfer to creator happens separately via createPayout()

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

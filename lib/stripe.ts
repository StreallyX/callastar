import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
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
 * Create a Stripe Payment Intent with Stripe Connect support
 * 
 * STRIPE CONNECT CHARGE TYPES:
 * We use "Destination Charges" for our platform. This is the correct pattern when:
 * - Platform collects payment on behalf of creator
 * - Funds are automatically transferred to creator's connected account
 * - Platform takes a fee before transfer
 * 
 * Destination Charges Configuration:
 * - `application_fee_amount`: Platform fee deducted from payment
 * - `transfer_data.destination`: Connected account receiving funds
 * - NO `on_behalf_of` parameter (this is for Direct Charges only)
 * 
 * Why we DON'T use `on_behalf_of`:
 * - `on_behalf_of` is for Direct Charges where the connected account is the merchant of record
 * - Direct Charges require the connected account to have `card_payments` capability
 * - This would make creators responsible for disputes, chargebacks, and customer support
 * - Destination Charges keep the platform as merchant of record, which is our business model
 * 
 * When stripeAccountId is provided, uses destination charges with platform fee.
 * Otherwise, uses regular payment intent (funds held on platform).
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
    const amountInCents = Math.round(amount * 100); // Convert to cents
    
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency,
      metadata: {
        ...metadata,
        // Metadata values are already provided in the metadata object from create-intent
        // Do not override them here
      },
      automatic_payment_methods: {
        enabled: true,
      },
    };

    // If creator has Stripe Connect enabled, use destination charges
    // This transfers funds directly to creator with platform fee deducted
    if (stripeAccountId && platformFee !== undefined) {
      const platformFeeInCents = Math.round(platformFee * 100);
      
      console.log('Creating Stripe Connect payment intent (Destination Charge):', {
        amount: amountInCents,
        platformFee: platformFeeInCents,
        stripeAccountId,
        creatorAmount: amountInCents - platformFeeInCents,
      });

      // Add Stripe Connect parameters for destination charge
      // Note: We do NOT include `on_behalf_of` for destination charges
      // This keeps the platform as merchant of record
      paymentIntentParams.application_fee_amount = platformFeeInCents;
      paymentIntentParams.transfer_data = {
        destination: stripeAccountId,
      };

      console.log('Payment intent params with Stripe Connect:', JSON.stringify(paymentIntentParams, null, 2));
    } else {
      // Regular payment - funds stay on platform account
      // Transfer to creator happens separately via createPayout()
      console.log('Creating regular payment intent (no Stripe Connect):', {
        amount: amountInCents,
      });
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
    
    console.log('Payment intent created successfully:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      application_fee_amount: paymentIntent.application_fee_amount,
      transfer_data: paymentIntent.transfer_data,
    });

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

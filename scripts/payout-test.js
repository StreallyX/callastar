/**
 * Test Stripe Connect payout (TEST MODE)
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_xxx node payout-test.js
 */

const Stripe = require('stripe');

/* ==============================
   CONFIGURATION
================================ */

const CONNECTED_ACCOUNT_ID = 'acct_1SkT0jGljdep0jvl'; // 🔴 CHANGE ICI
const CURRENCY = 'chf';
const AMOUNT = 5000; // 50.00

/* ==============================
   STRIPE INIT
================================ */

const stripe = new Stripe("", {
  apiVersion: '2023-10-16',
});

/* ==============================
   EXECUTION
================================ */

(async () => {
  try {
    console.log('🔁 Step 1: Platform charges card');

    const paymentIntent = await stripe.paymentIntents.create({
      amount: AMOUNT,
      currency: CURRENCY,
      payment_method: 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      description: 'Platform charge for payout test',
    });

    console.log('✅ Platform payment:', paymentIntent.id);

    console.log('🔁 Step 2: Transfer funds to connected account');

    const transfer = await stripe.transfers.create({
      amount: AMOUNT,
      currency: CURRENCY,
      destination: CONNECTED_ACCOUNT_ID,
      description: 'Test transfer to connected account',
    });

    console.log('✅ Transfer created:', transfer.id);

    console.log('🔁 Step 3: Check connected account balance');

    const balance = await stripe.balance.retrieve({
      stripeAccount: CONNECTED_ACCOUNT_ID,
    });

    console.log('💰 Connected balance:', balance.available);

    console.log('🔁 Step 4: Create payout');

    const payout = await stripe.payouts.create(
      {
        amount: AMOUNT,
        currency: CURRENCY,
        description: 'Manual test payout',
      },
      {
        stripeAccount: CONNECTED_ACCOUNT_ID,
      }
    );

    console.log('✅ Payout created');
    console.log({
      id: payout.id,
      status: payout.status,
      arrival_date: payout.arrival_date,
    });

    console.log('🎉 DONE — payout pipeline fully validated');

  } catch (err) {
    console.error('❌ Stripe error');
    console.error(err?.raw?.message || err.message);
    process.exit(1);
  }
})();

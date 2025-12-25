/**
 * Webhook Testing Script
 * 
 * This script helps test webhook handlers locally by simulating Stripe webhook events.
 * 
 * Usage:
 *   npx ts-node scripts/test-webhooks.ts <event-type>
 * 
 * Example:
 *   npx ts-node scripts/test-webhooks.ts payment_intent.succeeded
 *   npx ts-node scripts/test-webhooks.ts charge.refunded
 *   npx ts-node scripts/test-webhooks.ts payout.paid
 * 
 * Note: This is for development purposes only. Do not use in production.
 */

import Stripe from 'stripe';

// Sample webhook event templates
const webhookTemplates = {
  'payment_intent.succeeded': {
    id: 'evt_test_payment_succeeded',
    object: 'event',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_test_12345',
        object: 'payment_intent',
        amount: 5000, // $50.00
        currency: 'eur',
        status: 'succeeded',
        metadata: {
          bookingId: 'test_booking_id',
          userId: 'test_user_id',
          creatorId: 'test_creator_id',
          platformFee: '500',
          creatorAmount: '4500',
        },
      },
    },
  },

  'payment_intent.payment_failed': {
    id: 'evt_test_payment_failed',
    object: 'event',
    type: 'payment_intent.payment_failed',
    data: {
      object: {
        id: 'pi_test_12345',
        object: 'payment_intent',
        amount: 5000,
        currency: 'eur',
        status: 'requires_payment_method',
        last_payment_error: {
          message: 'Your card was declined.',
        },
        metadata: {
          bookingId: 'test_booking_id',
        },
      },
    },
  },

  'charge.refunded': {
    id: 'evt_test_charge_refunded',
    object: 'event',
    type: 'charge.refunded',
    data: {
      object: {
        id: 'ch_test_12345',
        object: 'charge',
        amount: 5000,
        amount_refunded: 5000,
        currency: 'eur',
        refunded: true,
        refunds: {
          object: 'list',
          data: [
            {
              id: 're_test_12345',
              object: 'refund',
              amount: 5000,
              currency: 'eur',
              status: 'succeeded',
              reason: 'requested_by_customer',
            },
          ],
        },
      },
    },
  },

  'charge.dispute.created': {
    id: 'evt_test_dispute_created',
    object: 'event',
    type: 'charge.dispute.created',
    data: {
      object: {
        id: 'dp_test_12345',
        object: 'dispute',
        amount: 5000,
        currency: 'eur',
        reason: 'fraudulent',
        status: 'needs_response',
        payment_intent: 'pi_test_12345',
        evidence_details: {
          due_by: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days from now
        },
      },
    },
  },

  'charge.dispute.closed': {
    id: 'evt_test_dispute_closed',
    object: 'event',
    type: 'charge.dispute.closed',
    data: {
      object: {
        id: 'dp_test_12345',
        object: 'dispute',
        amount: 5000,
        currency: 'eur',
        reason: 'fraudulent',
        status: 'won',
        payment_intent: 'pi_test_12345',
      },
    },
  },

  'payout.paid': {
    id: 'evt_test_payout_paid',
    object: 'event',
    type: 'payout.paid',
    data: {
      object: {
        id: 'po_test_12345',
        object: 'payout',
        amount: 4500,
        currency: 'eur',
        status: 'paid',
        arrival_date: Math.floor(Date.now() / 1000) + 86400 * 2,
      },
    },
  },

  'payout.failed': {
    id: 'evt_test_payout_failed',
    object: 'event',
    type: 'payout.failed',
    data: {
      object: {
        id: 'po_test_12345',
        object: 'payout',
        amount: 4500,
        currency: 'eur',
        status: 'failed',
        failure_message: 'Insufficient funds in account',
      },
    },
  },

  'account.updated': {
    id: 'evt_test_account_updated',
    object: 'event',
    type: 'account.updated',
    data: {
      object: {
        id: 'acct_test_12345',
        object: 'account',
        charges_enabled: true,
        payouts_enabled: true,
        requirements: {
          disabled_reason: null,
        },
      },
    },
  },

  'transfer.reversed': {
    id: 'evt_test_transfer_reversed',
    object: 'event',
    type: 'transfer.reversed',
    data: {
      object: {
        id: 'tr_test_12345',
        object: 'transfer',
        amount: 4500,
        currency: 'eur',
        reversed: true,
      },
    },
  },
};

/**
 * Send a test webhook event to the local server
 */
async function sendTestWebhook(eventType: string) {
  const template = webhookTemplates[eventType as keyof typeof webhookTemplates];

  if (!template) {
    console.error(`Unknown event type: ${eventType}`);
    console.log('\nAvailable event types:');
    Object.keys(webhookTemplates).forEach(type => {
      console.log(`  - ${type}`);
    });
    process.exit(1);
  }

  console.log(`\n🧪 Testing webhook: ${eventType}`);
  console.log('================================');
  console.log('Event data:', JSON.stringify(template, null, 2));
  console.log('================================\n');

  // In a real scenario, you would:
  // 1. Sign the webhook payload with your Stripe webhook secret
  // 2. Send it to your local webhook endpoint (http://localhost:3000/api/payments/webhook)
  // 3. Verify the response

  console.log('💡 To test this webhook:');
  console.log('1. Use Stripe CLI: stripe trigger ' + eventType);
  console.log('2. Or use this payload with curl:');
  console.log('\n');
  console.log('curl -X POST http://localhost:3000/api/payments/webhook \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log(`  -d '${JSON.stringify(template)}'`);
  console.log('\n');
  console.log('⚠️  Note: You need to sign the webhook with Stripe CLI for signature verification');
  console.log('Use: stripe listen --forward-to localhost:3000/api/payments/webhook');
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx ts-node scripts/test-webhooks.ts <event-type>');
    console.log('\nAvailable event types:');
    Object.keys(webhookTemplates).forEach(type => {
      console.log(`  - ${type}`);
    });
    process.exit(0);
  }

  const eventType = args[0];
  sendTestWebhook(eventType);
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { webhookTemplates, sendTestWebhook };

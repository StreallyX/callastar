/**
 * Script to update existing payments with payout tracking fields
 * This adds payoutStatus and payoutReleaseDate to existing payments
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config();

const prisma = new PrismaClient();

const PAYOUT_HOLDING_DAYS = 7;

function calculatePayoutReleaseDate(paymentDate) {
  const releaseDate = new Date(paymentDate);
  releaseDate.setDate(releaseDate.getDate() + PAYOUT_HOLDING_DAYS);
  return releaseDate;
}

async function updateExistingPayments() {
  console.log('Starting payment update...');

  try {
    // Get all payments that don't have payout release dates
    const payments = await prisma.payment.findMany({
      where: {
        status: 'SUCCEEDED',
        payoutReleaseDate: null,
      },
    });

    console.log(`Found ${payments.length} payments to update`);

    if (payments.length === 0) {
      console.log('No payments to update. All done!');
      return;
    }

    // Update each payment
    for (const payment of payments) {
      const payoutReleaseDate = calculatePayoutReleaseDate(payment.createdAt);
      const now = new Date();
      
      // Determine payout status based on release date
      const payoutStatus = payoutReleaseDate <= now ? 'READY' : 'HELD';

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          payoutStatus,
          payoutReleaseDate,
        },
      });

      console.log(
        `Updated payment ${payment.id}: Status=${payoutStatus}, ReleaseDate=${payoutReleaseDate.toISOString()}`
      );
    }

    console.log('\n✅ Payment update completed successfully!');
    console.log(`Updated ${payments.length} payment(s)`);

    // Show summary
    const heldCount = await prisma.payment.count({
      where: { payoutStatus: 'HELD' },
    });
    const readyCount = await prisma.payment.count({
      where: { payoutStatus: 'READY' },
    });
    const paidCount = await prisma.payment.count({
      where: { payoutStatus: 'PAID' },
    });

    console.log('\nPayout Status Summary:');
    console.log(`  HELD (waiting): ${heldCount}`);
    console.log(`  READY (can be paid out): ${readyCount}`);
    console.log(`  PAID (already transferred): ${paidCount}`);
  } catch (error) {
    console.error('Error updating payments:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateExistingPayments();

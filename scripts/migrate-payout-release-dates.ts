/**
 * Migration Script: Update Existing Payments with NULL payoutReleaseDate
 * 
 * This script sets payoutReleaseDate for all existing payments where it's NULL.
 * Uses createdAt + 7 days as the release date for historical payments.
 * 
 * Usage:
 *   npx tsx scripts/migrate-payout-release-dates.ts
 */

import prisma from '../lib/db';
import { calculatePayoutReleaseDate } from '../lib/stripe';

async function migratePayoutReleaseDates() {
  console.log('🔄 Starting migration: Update NULL payoutReleaseDate values...');
  
  try {
    // Find all payments with NULL payoutReleaseDate
    const paymentsWithoutReleaseDate = await prisma.payment.findMany({
      where: {
        payoutReleaseDate: null,
      },
      select: {
        id: true,
        createdAt: true,
        amount: true,
        status: true,
      },
    });

    console.log(`📊 Found ${paymentsWithoutReleaseDate.length} payments with NULL payoutReleaseDate`);

    if (paymentsWithoutReleaseDate.length === 0) {
      console.log('✅ No payments to migrate. All payments already have payoutReleaseDate set.');
      return;
    }

    // Update each payment
    let successCount = 0;
    let errorCount = 0;

    for (const payment of paymentsWithoutReleaseDate) {
      try {
        // Calculate release date based on payment creation date + 7 days
        const releaseDate = calculatePayoutReleaseDate(payment.createdAt);

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            payoutReleaseDate: releaseDate,
          },
        });

        console.log(`✓ Updated payment ${payment.id}: releaseDate = ${releaseDate.toISOString()}`);
        successCount++;
      } catch (error) {
        console.error(`✗ Error updating payment ${payment.id}:`, error);
        errorCount++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`  ✅ Successfully updated: ${successCount} payments`);
    console.log(`  ❌ Failed: ${errorCount} payments`);
    console.log(`  📊 Total processed: ${paymentsWithoutReleaseDate.length} payments`);

    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review the logs above.');
    }
  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migratePayoutReleaseDates()
  .then(() => {
    console.log('\n👋 Migration script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });

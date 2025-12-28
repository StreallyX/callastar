/**
 * Manual Log Cleanup Script
 * 
 * This script can be run manually to clean up old logs based on retention policy.
 * 
 * Usage:
 *   npm run cleanup-logs
 *   OR
 *   npx tsx scripts/cleanup-logs.ts
 * 
 * Retention Policy:
 * - INFO: 30 days
 * - WARNING: 60 days
 * - ERROR: 90 days
 * - CRITICAL: Unlimited (never deleted)
 */

import { deleteLogsByRetention, logSystem } from '../lib/system-logger';
import { LogLevel } from '@prisma/client';

async function main() {
  console.log('🧹 Starting log cleanup...\n');
  console.log('Retention Policy:');
  console.log('- INFO logs: 30 days');
  console.log('- WARNING logs: 60 days');
  console.log('- ERROR logs: 90 days');
  console.log('- CRITICAL logs: Unlimited (never deleted)\n');

  try {
    const startTime = Date.now();
    const result = await deleteLogsByRetention();
    const duration = Date.now() - startTime;

    console.log('\n✅ Cleanup completed successfully!\n');
    console.log('Results:');
    console.log(`- INFO logs deleted: ${result.infoDeleted}`);
    console.log(`- WARNING logs deleted: ${result.warningDeleted}`);
    console.log(`- ERROR logs deleted: ${result.errorDeleted}`);
    console.log(`- Total deleted: ${result.totalDeleted}`);
    console.log(`- Duration: ${duration}ms\n`);

    // Log the cleanup operation
    await logSystem(
      'LOG_CLEANUP_MANUAL',
      `Manual log cleanup completed: ${result.totalDeleted} logs deleted`,
      LogLevel.INFO,
      {
        infoDeleted: result.infoDeleted,
        warningDeleted: result.warningDeleted,
        errorDeleted: result.errorDeleted,
        totalDeleted: result.totalDeleted,
        durationMs: duration,
        manual: true,
      }
    );

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);

    // Log the error
    await logSystem(
      'LOG_CLEANUP_ERROR',
      `Manual log cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      LogLevel.ERROR,
      {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        manual: true,
      }
    );

    process.exit(1);
  }
}

main();

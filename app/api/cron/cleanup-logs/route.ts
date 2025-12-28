import { NextRequest, NextResponse } from 'next/server';
import { deleteLogsByRetention } from '@/lib/system-logger';
import { logSystem } from '@/lib/system-logger';
import { LogLevel } from '@prisma/client';

/**
 * POST /api/cron/cleanup-logs
 * Automatic log cleanup based on retention policy
 * 
 * Retention Policy:
 * - INFO: 30 days
 * - WARNING: 60 days
 * - ERROR: 90 days
 * - CRITICAL: Unlimited (never deleted)
 * 
 * This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions, or external scheduler)
 * Recommended frequency: Daily (e.g., every day at 2:00 AM)
 * 
 * Security: Should be protected by a secret token or IP whitelist in production
 * 
 * Example cron setup in vercel.json:
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/cleanup-logs",
 *       "schedule": "0 2 * * *"
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Security: Verify cron authorization
    // Option 1: Check for Vercel cron secret header
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Cleanup Logs] Unauthorized cron attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cleanup Logs] Starting automatic log cleanup...');

    // Execute retention cleanup
    const startTime = Date.now();
    const result = await deleteLogsByRetention();
    const duration = Date.now() - startTime;

    console.log('[Cleanup Logs] Cleanup completed:', {
      infoDeleted: result.infoDeleted,
      warningDeleted: result.warningDeleted,
      errorDeleted: result.errorDeleted,
      totalDeleted: result.totalDeleted,
      durationMs: duration,
    });

    // Log the cleanup operation
    await logSystem(
      'LOG_CLEANUP',
      `Automatic log cleanup completed: ${result.totalDeleted} logs deleted`,
      LogLevel.INFO,
      {
        infoDeleted: result.infoDeleted,
        warningDeleted: result.warningDeleted,
        errorDeleted: result.errorDeleted,
        totalDeleted: result.totalDeleted,
        durationMs: duration,
        retentionPolicy: {
          INFO: '30 days',
          WARNING: '60 days',
          ERROR: '90 days',
          CRITICAL: 'Unlimited',
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Log cleanup completed successfully',
      stats: {
        infoDeleted: result.infoDeleted,
        warningDeleted: result.warningDeleted,
        errorDeleted: result.errorDeleted,
        totalDeleted: result.totalDeleted,
        durationMs: duration,
      },
    });
  } catch (error) {
    console.error('[Cleanup Logs] Error during cleanup:', error);

    // Log the error
    await logSystem(
      'LOG_CLEANUP_ERROR',
      `Log cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      LogLevel.ERROR,
      {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
      }
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Log cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/cleanup-logs
 * Test endpoint to check cron job status (can be removed in production)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Log cleanup cron endpoint is ready',
    retentionPolicy: {
      INFO: '30 days',
      WARNING: '60 days',
      ERROR: '90 days',
      CRITICAL: 'Unlimited (never deleted)',
    },
    usage: 'POST to this endpoint to trigger cleanup',
    security: 'Requires Bearer token in Authorization header matching CRON_SECRET env var',
  });
}

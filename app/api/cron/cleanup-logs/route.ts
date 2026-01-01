import { NextRequest, NextResponse } from 'next/server';
import { deleteLogsByRetention } from '@/lib/system-logger';
import { logCronRun, logCronError } from '@/lib/logger';

// Force dynamic rendering for cron routes (prevents static rendering errors)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
  const startTime = Date.now();
  
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
    const result = await deleteLogsByRetention();
    const duration = Date.now() - startTime;

    console.log('[Cleanup Logs] Cleanup completed:', {
      successDeleted: result.successDeleted,
      errorDeleted: result.errorDeleted,
      totalDeleted: result.totalDeleted,
      durationMs: duration,
    });

    // ✅ Log successful cron execution with detailed info
    await logCronRun(
      'cleanup-logs',
      result.totalDeleted,
      duration,
      {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        successDeleted: result.successDeleted,
        errorDeleted: result.errorDeleted,
        retentionPolicy: {
          SUCCESS: '30 days',
          ERROR: '90 days',
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Log cleanup completed successfully',
      stats: {
        successDeleted: result.successDeleted,
        errorDeleted: result.errorDeleted,
        totalDeleted: result.totalDeleted,
        durationMs: duration,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Cleanup Logs] Error during cleanup:', error);

    // ✅ Log cron error with detailed info
    await logCronError(
      'cleanup-logs',
      error,
      {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration,
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

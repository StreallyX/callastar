import { NextRequest, NextResponse } from 'next/server';
import { deleteLogsByRetention } from '@/lib/system-logger';
import { logCronRun, logCronError } from '@/lib/logger';

// Force dynamic rendering for cron routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Shared cron execution logic
 */
async function runCleanup(request: NextRequest) {
  const startTime = Date.now();

  try {
    /**
     * 🔐 SECURITY (Vercel Cron only)
     * Vercel automatically sends: x-vercel-cron: 1
     */
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    if (!isVercelCron && process.env.NODE_ENV === 'production') {
      await logCronError(
        'cleanup-logs',
        new Error('Unauthorized cron access'),
        {
          reason: 'Missing x-vercel-cron header',
          headers: Object.fromEntries(request.headers.entries()),
        }
      );

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    console.log('[Cleanup Logs] Cron started');

    // Execute retention cleanup
    const result = await deleteLogsByRetention();
    const duration = Date.now() - startTime;

    console.log('[Cleanup Logs] Cron completed', {
      successDeleted: result.successDeleted,
      errorDeleted: result.errorDeleted,
      totalDeleted: result.totalDeleted,
      durationMs: duration,
    });

    // ✅ Log successful cron execution
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
        successDeleted: result.successDeleted,
        errorDeleted: result.errorDeleted,
        totalDeleted: result.totalDeleted,
        durationMs: duration,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('[Cleanup Logs] Cron failed', error);

    // ✅ Log cron error
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
 * ✅ GET — used by Vercel Cron
 */
export async function GET(request: NextRequest) {
  return runCleanup(request);
}

/**
 * ✅ POST — manual trigger / testing
 */
export async function POST(request: NextRequest) {
  return runCleanup(request);
}

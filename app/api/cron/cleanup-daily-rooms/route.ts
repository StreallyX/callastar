import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { checkDailyRoomExists, deleteDailyRoom } from '@/lib/daily';
import { logCronRun, logCronError, logDailyRoomDeleted, logDailyRoomError } from '@/lib/logger';
import { BookingStatus } from '@prisma/client';

// Force dynamic rendering for cron routes (prevents static rendering errors)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/cron/cleanup-daily-rooms
 * Automatic cleanup of Daily.io rooms for completed or cancelled bookings
 * 
 * This endpoint:
 * 1. Finds all bookings with status COMPLETED or CANCELLED that still have a dailyRoomName
 * 2. Checks if the room still exists on Daily.io
 * 3. Deletes the room if it exists
 * 4. Updates the booking to remove the dailyRoomName and dailyRoomUrl
 * 5. Logs all operations for traceability
 * 
 * Recommended frequency: Every hour (to clean up rooms promptly after calls end)
 * 
 * Security: Protected by CRON_SECRET environment variable
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let roomsDeleted = 0;
  let roomsAlreadyDeleted = 0;
  let roomsFailed = 0;

  try {
    // Security: Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Cleanup Daily Rooms] Unauthorized cron attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cleanup Daily Rooms] Starting Daily.io room cleanup...');

    // Find all bookings that are completed or cancelled and still have a Daily room
    const bookingsWithRooms = await prisma.booking.findMany({
      where: {
        status: {
          in: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
        },
        dailyRoomName: {
          not: null,
        },
      },
      select: {
        id: true,
        dailyRoomName: true,
        dailyRoomUrl: true,
        status: true,
      },
    });

    console.log(`[Cleanup Daily Rooms] Found ${bookingsWithRooms.length} bookings with Daily rooms to clean up`);

    // Process each booking
    for (const booking of bookingsWithRooms) {
      if (!booking.dailyRoomName) continue;

      try {
        console.log(`[Cleanup Daily Rooms] Processing room ${booking.dailyRoomName} for booking ${booking.id}...`);

        // Check if the room still exists
        const roomExists = await checkDailyRoomExists(booking.dailyRoomName);

        if (!roomExists) {
          console.log(`[Cleanup Daily Rooms] Room ${booking.dailyRoomName} already deleted, updating booking...`);
          roomsAlreadyDeleted++;

          // Update booking to remove room info
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              dailyRoomName: null,
              dailyRoomUrl: null,
            },
          });

          continue;
        }

        // Delete the room
        await deleteDailyRoom(booking.dailyRoomName);
        console.log(`[Cleanup Daily Rooms] Successfully deleted room ${booking.dailyRoomName}`);

        // Update booking to remove room info
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            dailyRoomName: null,
            dailyRoomUrl: null,
          },
        });

        // Log successful deletion
        await logDailyRoomDeleted(
          booking.dailyRoomName,
          booking.id,
          {
            roomUrl: booking.dailyRoomUrl || undefined,
            bookingStatus: booking.status,
            deletedBy: 'cron_job',
          }
        );

        roomsDeleted++;
      } catch (error) {
        console.error(`[Cleanup Daily Rooms] Error processing room ${booking.dailyRoomName}:`, error);
        roomsFailed++;

        // Log the error
        await logDailyRoomError(
          booking.dailyRoomName,
          booking.id,
          error,
          {
            operation: 'delete',
            bookingStatus: booking.status,
            errorSource: 'cron_job',
          }
        );
      }
    }

    const duration = Date.now() - startTime;
    const totalProcessed = roomsDeleted + roomsAlreadyDeleted;

    console.log('[Cleanup Daily Rooms] Cleanup completed:', {
      totalBookings: bookingsWithRooms.length,
      roomsDeleted,
      roomsAlreadyDeleted,
      roomsFailed,
      durationMs: duration,
    });

    // ✅ Log successful cron execution with detailed info
    await logCronRun(
      'cleanup-daily-rooms',
      totalProcessed,
      duration,
      {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        totalBookings: bookingsWithRooms.length,
        roomsDeleted,
        roomsAlreadyDeleted,
        roomsFailed,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Daily room cleanup completed successfully',
      stats: {
        totalBookings: bookingsWithRooms.length,
        roomsDeleted,
        roomsAlreadyDeleted,
        roomsFailed,
        durationMs: duration,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Cleanup Daily Rooms] Error during cleanup:', error);

    // ✅ Log cron error with detailed info
    await logCronError(
      'cleanup-daily-rooms',
      error,
      {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration,
        roomsDeleted,
        roomsAlreadyDeleted,
        roomsFailed,
      }
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Daily room cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/cleanup-daily-rooms
 * Test endpoint to check cron job status (can be removed in production)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Daily room cleanup cron endpoint is ready',
    description: 'Cleans up Daily.io rooms for completed or cancelled bookings',
    usage: 'POST to this endpoint to trigger cleanup',
    security: 'Requires Bearer token in Authorization header matching CRON_SECRET env var',
  });
}

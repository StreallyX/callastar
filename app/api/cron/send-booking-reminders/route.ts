import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendEmail, generateBookingReminderEmail } from '@/lib/email';
import { logCronRun, logCronError, logEmailSent, logEmailError } from '@/lib/logger';
import { BookingStatus } from '@prisma/client';

// Force dynamic rendering for cron routes (prevents static rendering errors)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/cron/send-booking-reminders
 * Automatic email reminders for confirmed bookings starting in 15-20 minutes
 * 
 * This endpoint:
 * 1. Finds all CONFIRMED bookings starting in 15-20 minutes
 * 2. Checks if a reminder has already been sent (reminderSent flag)
 * 3. Sends reminder emails to both the creator and the client
 * 4. Emails are in English only
 * 5. Emails contain the platform booking URL (not Daily.io direct link)
 * 6. Marks bookings as reminderSent = true after successful send
 * 7. Logs all operations for traceability
 * 
 * Recommended frequency: Every 5 minutes (to be responsive)
 * 
 * Security: Protected by CRON_SECRET environment variable
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let emailsSent = 0;
  let emailsFailed = 0;

  try {
    // Security: Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Send Booking Reminders] Unauthorized cron attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Send Booking Reminders] Starting booking reminder job...');

    // Calculate time window: 15-20 minutes from now
    const now = new Date();
    const minTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
    const maxTime = new Date(now.getTime() + 20 * 60 * 1000); // 20 minutes

    // Find all confirmed bookings in the time window that haven't received a reminder
    const bookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        reminderSent: false,
        callOffer: {
          dateTime: {
            gte: minTime,
            lte: maxTime,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        callOffer: {
          include: {
            creator: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    console.log(`[Send Booking Reminders] Found ${bookings.length} bookings requiring reminders`);

    // Get the base URL for the platform
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Process each booking
    for (const booking of bookings) {
      try {
        const clientName = booking.user.name || 'Valued Customer';
        const clientEmail = booking.user.email;
        const creatorName = booking.callOffer.creator.user.name || 'Creator';
        const creatorEmail = booking.callOffer.creator.user.email;
        const callDateTime = booking.callOffer.dateTime;
        
        // Build the booking URL (link to platform, not Daily.io)
        const bookingUrl = `${baseUrl}/bookings/${booking.id}`;

        console.log(`[Send Booking Reminders] Sending reminders for booking ${booking.id}...`);

        // Send reminder to client
        try {
          const clientEmailHtml = generateBookingReminderEmail({
            userName: clientName,
            creatorName,
            callDateTime,
            bookingUrl,
          });

          await sendEmail({
            to: clientEmail,
            subject: '⏰ Reminder: Your call is starting soon!',
            html: clientEmailHtml,
          });

          console.log(`[Send Booking Reminders] Reminder sent to client ${clientEmail}`);
          
          // Log successful email send
          await logEmailSent(
            booking.id,
            booking.user.id,
            'booking_reminder_client',
            {
              recipientEmail: clientEmail,
              recipientName: clientName,
              creatorName,
              callDateTime: callDateTime.toISOString(),
            }
          );
          
          emailsSent++;
        } catch (error) {
          console.error(`[Send Booking Reminders] Failed to send reminder to client ${clientEmail}:`, error);
          emailsFailed++;

          // Log email error
          await logEmailError(
            booking.id,
            booking.user.id,
            'booking_reminder_client',
            error,
            {
              recipientEmail: clientEmail,
              recipientName: clientName,
            }
          );
        }

        // Send reminder to creator
        try {
          const creatorEmailHtml = generateBookingReminderEmail({
            userName: creatorName,
            creatorName: clientName, // From creator's perspective, client is the other person
            callDateTime,
            bookingUrl,
          });

          await sendEmail({
            to: creatorEmail,
            subject: '⏰ Reminder: Your call is starting soon!',
            html: creatorEmailHtml,
          });

          console.log(`[Send Booking Reminders] Reminder sent to creator ${creatorEmail}`);
          
          // Log successful email send
          await logEmailSent(
            booking.id,
            booking.callOffer.creator.user.id,
            'booking_reminder_creator',
            {
              recipientEmail: creatorEmail,
              recipientName: creatorName,
              clientName,
              callDateTime: callDateTime.toISOString(),
            }
          );
          
          emailsSent++;
        } catch (error) {
          console.error(`[Send Booking Reminders] Failed to send reminder to creator ${creatorEmail}:`, error);
          emailsFailed++;

          // Log email error
          await logEmailError(
            booking.id,
            booking.callOffer.creator.user.id,
            'booking_reminder_creator',
            error,
            {
              recipientEmail: creatorEmail,
              recipientName: creatorName,
            }
          );
        }

        // Mark booking as reminderSent = true (even if one email failed, we don't want to spam)
        await prisma.booking.update({
          where: { id: booking.id },
          data: { reminderSent: true },
        });

        console.log(`[Send Booking Reminders] Marked booking ${booking.id} as reminderSent`);
      } catch (error) {
        console.error(`[Send Booking Reminders] Error processing booking ${booking.id}:`, error);
        emailsFailed++;
      }
    }

    const duration = Date.now() - startTime;

    console.log('[Send Booking Reminders] Reminder job completed:', {
      totalBookings: bookings.length,
      emailsSent,
      emailsFailed,
      durationMs: duration,
    });

    // ✅ Log successful cron execution with detailed info
    await logCronRun(
      'send-booking-reminders',
      emailsSent,
      duration,
      {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        totalBookings: bookings.length,
        emailsSent,
        emailsFailed,
        timeWindow: {
          minTime: minTime.toISOString(),
          maxTime: maxTime.toISOString(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Booking reminders sent successfully',
      stats: {
        totalBookings: bookings.length,
        emailsSent,
        emailsFailed,
        durationMs: duration,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Send Booking Reminders] Error during reminder job:', error);

    // ✅ Log cron error with detailed info
    await logCronError(
      'send-booking-reminders',
      error,
      {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration,
        emailsSent,
        emailsFailed,
      }
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Booking reminder job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/send-booking-reminders
 * Test endpoint to check cron job status (can be removed in production)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Booking reminder cron endpoint is ready',
    description: 'Sends email reminders 15 minutes before confirmed bookings',
    usage: 'POST to this endpoint to trigger reminder job',
    security: 'Requires Bearer token in Authorization header matching CRON_SECRET env var',
  });
}

/**
 * ✅ Logger Utility for Call a Star
 * 
 * This module provides type-safe logging functions for auditing emails, crons,
 * and system events. All logs are stored in the database for 100% traceability.
 * 
 * @module logger
 */

import { PrismaClient, LogType, LogStatus } from "@prisma/client";

// Initialize Prisma Client (singleton pattern)
const prisma = new PrismaClient();

// ========================================
// TypeScript Types for Context Objects
// ========================================

export interface EmailContext {
  bookingId?: string;
  userId?: string;
  emailType?: string;
  recipientEmail?: string;
  subject?: string;
  [key: string]: any;
}

export interface CronContext {
  cronType: string;
  itemsProcessed?: number;
  duration?: number; // in milliseconds
  startTime?: string;
  endTime?: string;
  [key: string]: any;
}

export interface DailyRoomContext {
  roomId?: string;
  roomName?: string;
  bookingId?: string;
  creatorId?: string;
  userId?: string;
  [key: string]: any;
}

export interface BookingContext {
  bookingId: string;
  userId?: string;
  creatorId?: string;
  offerId?: string;
  amount?: number;
  currency?: string;
  [key: string]: any;
}

export interface PaymentContext {
  paymentId?: string;
  bookingId?: string;
  userId?: string;
  creatorId?: string;
  amount?: number;
  currency?: string;
  stripePaymentIntentId?: string;
  [key: string]: any;
}

export type LogContext = EmailContext | CronContext | DailyRoomContext | BookingContext | PaymentContext | Record<string, any>;

// ========================================
// Core Logging Functions
// ========================================

/**
 * Log a successful operation
 * 
 * @param type - The type of log entry (from LogType enum)
 * @param message - Human-readable message describing the success
 * @param context - Optional context object with relevant IDs and data
 * @returns Promise<void>
 * 
 * @example
 * await logSuccess(LogType.EMAIL_SENT, "Booking confirmation email sent successfully", {
 *   bookingId: "clx123456",
 *   userId: "user123",
 *   emailType: "booking_confirmation"
 * });
 */
export async function logSuccess(
  type: LogType,
  message: string,
  context?: LogContext
): Promise<void> {
  try {
    await prisma.log.create({
      data: {
        type,
        status: LogStatus.SUCCESS,
        message,
        context: context ? (context as any) : undefined,
        error: null,
      },
    });
  } catch (error) {
    // Fallback: Log to console if database logging fails
    console.error("[LOGGER ERROR] Failed to log success:", error);
    console.log("[FALLBACK LOG]", { type, message, context });
  }
}

/**
 * Log an error or failure
 * 
 * @param type - The type of log entry (from LogType enum)
 * @param message - Human-readable message describing the error
 * @param error - Error object or string with stack trace
 * @param context - Optional context object with relevant IDs and data
 * @returns Promise<void>
 * 
 * @example
 * await logError(LogType.EMAIL_ERROR, "Failed to send booking confirmation email", error, {
 *   bookingId: "clx123456",
 *   userId: "user123",
 *   emailType: "booking_confirmation"
 * });
 */
export async function logError(
  type: LogType,
  message: string,
  error: Error | string | unknown,
  context?: LogContext
): Promise<void> {
  try {
    // Extract error message and stack trace
    let errorString = "";
    if (error instanceof Error) {
      errorString = `${error.message}\n\nStack trace:\n${error.stack}`;
    } else if (typeof error === "string") {
      errorString = error;
    } else {
      errorString = JSON.stringify(error, null, 2);
    }

    await prisma.log.create({
      data: {
        type,
        status: LogStatus.ERROR,
        message,
        context: context ? (context as any) : undefined,
        error: errorString,
      },
    });
  } catch (logError) {
    // Fallback: Log to console if database logging fails
    console.error("[LOGGER ERROR] Failed to log error:", logError);
    console.error("[FALLBACK LOG]", { type, message, error, context });
  }
}

// ========================================
// Email Logging Helpers
// ========================================

/**
 * Log a successful email send
 * 
 * @param bookingId - The booking ID associated with the email
 * @param userId - The user ID who received the email
 * @param emailType - Type of email (e.g., "booking_confirmation", "booking_reminder")
 * @param additionalContext - Any additional context to include
 * 
 * @example
 * await logEmailSent("clx123456", "user123", "booking_confirmation", {
 *   recipientEmail: "user@example.com",
 *   subject: "Your booking is confirmed!"
 * });
 */
export async function logEmailSent(
  bookingId: string,
  userId: string,
  emailType: string,
  additionalContext?: Partial<EmailContext>
): Promise<void> {
  const context: EmailContext = {
    bookingId,
    userId,
    emailType,
    ...additionalContext,
  };

  await logSuccess(
    LogType.EMAIL_SENT,
    `Email sent: ${emailType} for booking ${bookingId}`,
    context
  );
}

/**
 * Log an email sending error
 * 
 * @param bookingId - The booking ID associated with the email
 * @param userId - The user ID who should have received the email
 * @param emailType - Type of email that failed to send
 * @param error - The error that occurred
 * @param additionalContext - Any additional context to include
 * 
 * @example
 * await logEmailError("clx123456", "user123", "booking_confirmation", error, {
 *   recipientEmail: "user@example.com",
 *   subject: "Your booking is confirmed!"
 * });
 */
export async function logEmailError(
  bookingId: string,
  userId: string,
  emailType: string,
  error: Error | string | unknown,
  additionalContext?: Partial<EmailContext>
): Promise<void> {
  const context: EmailContext = {
    bookingId,
    userId,
    emailType,
    ...additionalContext,
  };

  await logError(
    LogType.EMAIL_ERROR,
    `Email failed: ${emailType} for booking ${bookingId}`,
    error,
    context
  );
}

// ========================================
// Cron Job Logging Helpers
// ========================================

/**
 * Log a successful cron job execution
 * 
 * @param cronType - Type of cron job (e.g., "cleanup_daily_rooms", "send_reminders")
 * @param itemsProcessed - Number of items processed by the cron job
 * @param duration - Duration of the cron job in milliseconds
 * @param additionalContext - Any additional context to include
 * 
 * @example
 * const startTime = Date.now();
 * // ... execute cron job ...
 * const duration = Date.now() - startTime;
 * await logCronRun("cleanup_daily_rooms", 15, duration);
 */
export async function logCronRun(
  cronType: string,
  itemsProcessed: number,
  duration: number,
  additionalContext?: Partial<CronContext>
): Promise<void> {
  const context: CronContext = {
    cronType,
    itemsProcessed,
    duration,
    durationSeconds: Math.round(duration / 1000),
    ...additionalContext,
  };

  await logSuccess(
    LogType.CRON_RUN,
    `Cron job completed: ${cronType} (processed ${itemsProcessed} items in ${Math.round(duration / 1000)}s)`,
    context
  );
}

/**
 * Log a cron job error
 * 
 * @param cronType - Type of cron job that failed
 * @param error - The error that occurred
 * @param additionalContext - Any additional context to include
 * 
 * @example
 * try {
 *   // ... execute cron job ...
 * } catch (error) {
 *   await logCronError("cleanup_daily_rooms", error, {
 *     itemsProcessed: 10,
 *     failedAt: "Room ID clx789"
 *   });
 * }
 */
export async function logCronError(
  cronType: string,
  error: Error | string | unknown,
  additionalContext?: Partial<CronContext>
): Promise<void> {
  const context: CronContext = {
    cronType,
    ...additionalContext,
  };

  await logError(
    LogType.CRON_ERROR,
    `Cron job failed: ${cronType}`,
    error,
    context
  );
}

// ========================================
// Daily.io Room Logging Helpers
// ========================================

/**
 * Log a successful Daily.io room deletion
 * 
 * @param roomId - The Daily.io room ID that was deleted
 * @param bookingId - The booking ID associated with the room
 * @param additionalContext - Any additional context to include
 * 
 * @example
 * await logDailyRoomDeleted("daily-room-abc123", "clx123456", {
 *   roomName: "call-with-creator-abc",
 *   deletedBy: "cron_job"
 * });
 */
export async function logDailyRoomDeleted(
  roomId: string,
  bookingId: string,
  additionalContext?: Partial<DailyRoomContext>
): Promise<void> {
  const context: DailyRoomContext = {
    roomId,
    bookingId,
    ...additionalContext,
  };

  await logSuccess(
    LogType.DAILY_ROOM_DELETED,
    `Daily.io room deleted: ${roomId} for booking ${bookingId}`,
    context
  );
}

/**
 * Log a Daily.io room operation error
 * 
 * @param roomId - The Daily.io room ID that failed
 * @param bookingId - The booking ID associated with the room
 * @param error - The error that occurred
 * @param additionalContext - Any additional context to include
 * 
 * @example
 * await logDailyRoomError("daily-room-abc123", "clx123456", error, {
 *   roomName: "call-with-creator-abc",
 *   operation: "delete"
 * });
 */
export async function logDailyRoomError(
  roomId: string,
  bookingId: string,
  error: Error | string | unknown,
  additionalContext?: Partial<DailyRoomContext>
): Promise<void> {
  const context: DailyRoomContext = {
    roomId,
    bookingId,
    ...additionalContext,
  };

  await logError(
    LogType.DAILY_ROOM_ERROR,
    `Daily.io room operation failed: ${roomId} for booking ${bookingId}`,
    error,
    context
  );
}

/**
 * Log a successful Daily.io room creation
 * 
 * @param roomId - The Daily.io room ID that was created
 * @param bookingId - The booking ID associated with the room
 * @param additionalContext - Any additional context to include
 * 
 * @example
 * await logDailyRoomCreated("daily-room-abc123", "clx123456", {
 *   roomName: "call-with-creator-abc",
 *   roomUrl: "https://example.daily.co/call-with-creator-abc"
 * });
 */
export async function logDailyRoomCreated(
  roomId: string,
  bookingId: string,
  additionalContext?: Partial<DailyRoomContext>
): Promise<void> {
  const context: DailyRoomContext = {
    roomId,
    bookingId,
    ...additionalContext,
  };

  await logSuccess(
    LogType.DAILY_ROOM_CREATED,
    `Daily.io room created: ${roomId} for booking ${bookingId}`,
    context
  );
}

// ========================================
// Booking Logging Helpers
// ========================================

/**
 * Log a successful booking creation
 * 
 * @param bookingId - The booking ID that was created
 * @param userId - The user who created the booking
 * @param additionalContext - Any additional context to include
 * 
 * @example
 * await logBookingCreated("clx123456", "user123", {
 *   creatorId: "creator456",
 *   offerId: "offer789",
 *   amount: 50,
 *   currency: "EUR"
 * });
 */
export async function logBookingCreated(
  bookingId: string,
  userId: string,
  additionalContext?: Partial<BookingContext>
): Promise<void> {
  const context: BookingContext = {
    bookingId,
    userId,
    ...additionalContext,
  };

  await logSuccess(
    LogType.BOOKING_CREATED,
    `Booking created: ${bookingId} by user ${userId}`,
    context
  );
}

/**
 * Log a booking creation error
 * 
 * @param userId - The user who attempted to create the booking
 * @param error - The error that occurred
 * @param additionalContext - Any additional context to include
 * 
 * @example
 * await logBookingError("user123", error, {
 *   offerId: "offer789",
 *   amount: 50,
 *   currency: "EUR",
 *   reason: "Payment intent creation failed"
 * });
 */
export async function logBookingError(
  userId: string,
  error: Error | string | unknown,
  additionalContext?: Partial<BookingContext>
): Promise<void> {
  const context: BookingContext = {
    bookingId: "N/A",
    userId,
    ...additionalContext,
  };

  await logError(
    LogType.BOOKING_ERROR,
    `Booking creation failed for user ${userId}`,
    error,
    context
  );
}

// ========================================
// Payment Logging Helpers
// ========================================

/**
 * Log a successful payment
 * 
 * @param paymentId - The payment ID
 * @param bookingId - The booking ID associated with the payment
 * @param amount - Payment amount
 * @param currency - Payment currency
 * @param additionalContext - Any additional context to include
 * 
 * @example
 * await logPaymentSuccess("payment123", "clx123456", 50, "EUR", {
 *   stripePaymentIntentId: "pi_abc123",
 *   userId: "user123",
 *   creatorId: "creator456"
 * });
 */
export async function logPaymentSuccess(
  paymentId: string,
  bookingId: string,
  amount: number,
  currency: string,
  additionalContext?: Partial<PaymentContext>
): Promise<void> {
  const context: PaymentContext = {
    paymentId,
    bookingId,
    amount,
    currency,
    ...additionalContext,
  };

  await logSuccess(
    LogType.PAYMENT_SUCCESS,
    `Payment successful: ${paymentId} for booking ${bookingId} (${amount} ${currency})`,
    context
  );
}

/**
 * Log a payment error
 * 
 * @param bookingId - The booking ID associated with the payment
 * @param error - The error that occurred
 * @param additionalContext - Any additional context to include
 * 
 * @example
 * await logPaymentError("clx123456", error, {
 *   stripePaymentIntentId: "pi_abc123",
 *   userId: "user123",
 *   amount: 50,
 *   currency: "EUR"
 * });
 */
export async function logPaymentError(
  bookingId: string,
  error: Error | string | unknown,
  additionalContext?: Partial<PaymentContext>
): Promise<void> {
  const context: PaymentContext = {
    bookingId,
    ...additionalContext,
  };

  await logError(
    LogType.PAYMENT_ERROR,
    `Payment failed for booking ${bookingId}`,
    error,
    context
  );
}

// ========================================
// Utility Functions
// ========================================

/**
 * Get recent logs with filtering
 * 
 * @param options - Filter options
 * @returns Promise with array of logs
 * 
 * @example
 * const recentErrors = await getRecentLogs({
 *   status: LogStatus.ERROR,
 *   type: LogType.EMAIL_ERROR,
 *   limit: 50
 * });
 */
export async function getRecentLogs(options?: {
  type?: LogType;
  status?: LogStatus;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const { type, status, limit = 100, startDate, endDate } = options || {};

  return await prisma.log.findMany({
    where: {
      ...(type && { type }),
      ...(status && { status }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}

/**
 * Get log statistics for monitoring dashboard
 * 
 * @param options - Filter options (optional date range)
 * @returns Promise with log statistics
 * 
 * @example
 * const stats = await getLogStats({
 *   startDate: new Date("2024-01-01"),
 *   endDate: new Date()
 * });
 */
export async function getLogStats(options?: {
  startDate?: Date;
  endDate?: Date;
}) {
  const { startDate, endDate } = options || {};

  const whereClause = {
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
  };

  const [totalLogs, successLogs, errorLogs, emailsSent, emailErrors, cronRuns, cronErrors] =
    await Promise.all([
      prisma.log.count({ where: whereClause }),
      prisma.log.count({ where: { ...whereClause, status: LogStatus.SUCCESS } }),
      prisma.log.count({ where: { ...whereClause, status: LogStatus.ERROR } }),
      prisma.log.count({ where: { ...whereClause, type: LogType.EMAIL_SENT } }),
      prisma.log.count({ where: { ...whereClause, type: LogType.EMAIL_ERROR } }),
      prisma.log.count({ where: { ...whereClause, type: LogType.CRON_RUN } }),
      prisma.log.count({ where: { ...whereClause, type: LogType.CRON_ERROR } }),
    ]);

  return {
    totalLogs,
    successLogs,
    errorLogs,
    successRate: totalLogs > 0 ? ((successLogs / totalLogs) * 100).toFixed(2) : "0",
    errorRate: totalLogs > 0 ? ((errorLogs / totalLogs) * 100).toFixed(2) : "0",
    emails: {
      sent: emailsSent,
      errors: emailErrors,
      successRate: emailsSent + emailErrors > 0 
        ? ((emailsSent / (emailsSent + emailErrors)) * 100).toFixed(2) 
        : "0",
    },
    crons: {
      runs: cronRuns,
      errors: cronErrors,
      successRate: cronRuns + cronErrors > 0 
        ? ((cronRuns / (cronRuns + cronErrors)) * 100).toFixed(2) 
        : "0",
    },
  };
}

/**
 * Clean up old logs (for data retention policies)
 * 
 * @param daysToKeep - Number of days to keep logs (default: 90)
 * @returns Promise with number of deleted logs
 * 
 * @example
 * // Delete logs older than 90 days
 * const deletedCount = await cleanupOldLogs(90);
 * console.log(`Deleted ${deletedCount} old logs`);
 */
export async function cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await prisma.log.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}

// Export types for use in other modules
export { LogType, LogStatus } from "@prisma/client";



// ========================================
// Stub functions for backward compatibility
// ========================================

/**
 * @deprecated Stub function - not implemented
 */
export async function logTransaction(...args: any[]): Promise<void> {
  console.log('[logTransaction] Not implemented - stub called with:', args.length, 'arguments');
}

/**
 * @deprecated Stub function - not implemented
 */
export async function getTransactionLogs(...args: any[]): Promise<any> {
  console.log('[getTransactionLogs] Not implemented - stub called');
  return { logs: [], total: 0, hasMore: false, limit: 50, offset: 0 };
}

/**
 * @deprecated Stub function - not implemented
 */
export async function logPayout(...args: any[]): Promise<void> {
  console.log('[logPayout] Not implemented - stub called with:', args.length, 'arguments');
}

/**
 * @deprecated Stub function - not implemented
 */
export async function logRefund(...args: any[]): Promise<void> {
  console.log('[logRefund] Not implemented - stub called with:', args.length, 'arguments');
}

/**
 * @deprecated Stub function - not implemented
 */
export async function logPayment(...args: any[]): Promise<void> {
  console.log('[logPayment] Not implemented - stub called with:', args.length, 'arguments');
}

/**
 * @deprecated Stub function - not implemented
 */
export async function logWebhook(...args: any[]): Promise<void> {
  console.log('[logWebhook] Not implemented - stub called with:', args.length, 'arguments');
}

/**
 * @deprecated Stub function - not implemented
 */
export async function logDispute(...args: any[]): Promise<void> {
  console.log('[logDispute] Not implemented - stub called with:', args.length, 'arguments');
}

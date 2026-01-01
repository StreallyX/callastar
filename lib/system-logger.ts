import { LogType, LogStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/db";

/**
 * System-wide logging service for tracking all platform activities
 * Separate from TransactionLog which focuses on financial transactions
 */

export interface SystemLogData {
  type: LogType | string;
  status: LogStatus;
  message: string;
  context?: Record<string, any>;
  error?: string;
}

/**
 * Create a system log entry
 * This is the base logging function used by all specialized loggers
 */
export async function createLog(data: SystemLogData): Promise<void> {
  try {
    const logEntry: Prisma.LogCreateInput = {
      type: data.type as LogType,
      status: data.status,
      message: data.message,
      context: data.context ? (data.context as any) : undefined,
      error: data.error || null,
    };

    await prisma.log.create({ data: logEntry });

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[SystemLog]', {
        type: data.type,
        status: data.status,
        message: data.message,
        context: data.context,
      });
    }
  } catch (error) {
    // Logging should never crash the application
    console.error('[SystemLog Error]', error);
    console.error('[Original log data]', data);
  }
}

/**
 * Log a success event
 * Supports both old (5 args) and new (3 args) signatures
 */
export async function logInfo(
  type: string,
  messageOrActor: string | any,
  messageOrContext?: string | Record<string, any>,
  actorIdOrUndefined?: string,
  contextOrUndefined?: Record<string, any>
): Promise<void> {
  // Detect which signature is being used
  if (typeof messageOrActor === 'string' && typeof messageOrContext !== 'string') {
    // New signature: (type, message, context)
    await createLog({
      type,
      status: LogStatus.SUCCESS,
      message: messageOrActor,
      context: messageOrContext as Record<string, any>,
    });
  } else {
    // Old signature: (type, actor, message, actorId, context)
    await createLog({
      type,
      status: LogStatus.SUCCESS,
      message: messageOrContext as string,
      context: {
        ...contextOrUndefined,
        actor: messageOrActor?.toString(),
        actorId: actorIdOrUndefined,
      },
    });
  }
}

/**
 * Log a WARNING level event
 * Supports both old (5 args) and new (3 args) signatures
 */
export async function logWarning(
  type: string,
  messageOrActor: string | any,
  messageOrContext?: string | Record<string, any>,
  actorIdOrUndefined?: string,
  contextOrUndefined?: Record<string, any>
): Promise<void> {
  // Detect which signature is being used
  if (typeof messageOrActor === 'string' && typeof messageOrContext !== 'string') {
    // New signature: (type, message, context)
    await createLog({
      type,
      status: LogStatus.SUCCESS,
      message: messageOrActor,
      context: { ...messageOrContext as Record<string, any>, warning: true },
    });
  } else {
    // Old signature: (type, actor, message, actorId, context)
    await createLog({
      type,
      status: LogStatus.SUCCESS,
      message: messageOrContext as string,
      context: {
        ...contextOrUndefined,
        actor: messageOrActor?.toString(),
        actorId: actorIdOrUndefined,
        warning: true,
      },
    });
  }
}

/**
 * Log an ERROR level event
 * Supports both old (5 args) and new (4 args) signatures
 */
export async function logError(
  type: string,
  messageOrActor: string | any,
  errorOrMessage?: Error | string,
  contextOrActorId?: Record<string, any> | string,
  finalContext?: Record<string, any>
): Promise<void> {
  // Detect which signature is being used
  if (typeof messageOrActor === 'string' && (errorOrMessage instanceof Error || typeof errorOrMessage === 'string' || errorOrMessage === undefined)) {
    // New signature: (type, message, error?, context?)
    const errorString = errorOrMessage instanceof Error ? `${errorOrMessage.message}\n\n${errorOrMessage.stack}` : errorOrMessage;
    await createLog({
      type,
      status: LogStatus.ERROR,
      message: messageOrActor,
      context: contextOrActorId as Record<string, any>,
      error: errorString,
    });
  } else {
    // Old signature: (type, actor, message, actorId, context)
    await createLog({
      type,
      status: LogStatus.ERROR,
      message: errorOrMessage as string,
      context: {
        ...finalContext,
        actor: messageOrActor?.toString(),
        actorId: contextOrActorId as string,
      },
    });
  }
}

/**
 * Log a CRITICAL level event
 */
export async function logCritical(
  type: string,
  message: string,
  error?: Error | string,
  context?: Record<string, any>
): Promise<void> {
  const errorString = error instanceof Error ? `${error.message}\n\n${error.stack}` : error;
  await createLog({
    type,
    status: LogStatus.ERROR,
    message: `CRITICAL: ${message}`,
    context: { ...context, critical: true },
    error: errorString,
  });
}

/**
 * Log user authentication events
 */
export async function logAuth(
  action: 'LOGIN' | 'LOGOUT' | 'REGISTER' | 'PASSWORD_RESET' | 'EMAIL_VERIFY',
  userId: string,
  success: boolean,
  context?: Record<string, any>
): Promise<void> {
  const status = success ? LogStatus.SUCCESS : LogStatus.ERROR;
  const message = success 
    ? `User ${action.toLowerCase()} successful`
    : `User ${action.toLowerCase()} failed`;

  await createLog({
    type: `AUTH_${action}` as LogType,
    status,
    message,
    context: {
      ...context,
      userId,
      success,
    },
  });
}

/**
 * Log user actions
 */
export async function logUserAction(
  action: string,
  userId: string,
  message: string,
  context?: Record<string, any>
): Promise<void> {
  await logInfo(
    `USER_${action}`,
    message,
    { ...context, userId }
  );
}

/**
 * Log creator actions
 */
export async function logCreatorAction(
  action: string,
  creatorId: string,
  message: string,
  context?: Record<string, any>
): Promise<void> {
  await logInfo(
    `CREATOR_${action}`,
    message,
    { ...context, creatorId }
  );
}

/**
 * Log admin actions
 */
export async function logAdminAction(
  action: string,
  adminId: string,
  message: string,
  status: LogStatus = LogStatus.SUCCESS,
  context?: Record<string, any>
): Promise<void> {
  await createLog({
    type: `ADMIN_${action}` as LogType,
    status,
    message,
    context: { ...context, adminId },
  });
}

/**
 * Log system events
 */
export async function logSystem(
  action: string,
  message: string,
  status: LogStatus = LogStatus.SUCCESS,
  context?: Record<string, any>
): Promise<void> {
  await createLog({
    type: `SYSTEM_${action}` as LogType,
    status,
    message,
    context,
  });
}

/**
 * Log booking events
 */
export async function logBooking(
  action: 'CREATED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED',
  bookingId: string,
  userId: string,
  creatorId: string,
  context?: Record<string, any>
): Promise<void> {
  await logInfo(
    LogType.BOOKING_CREATED,
    `Booking ${action.toLowerCase()}: ${bookingId}`,
    {
      ...context,
      bookingId,
      userId,
      creatorId,
    }
  );
}

/**
 * Log payment events (high-level, complementary to TransactionLog)
 */
export async function logPaymentEvent(
  action: 'INITIATED' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED',
  paymentId: string,
  userId: string,
  amount: number,
  currency: string,
  status?: LogStatus,
  context?: Record<string, any>
): Promise<void> {
  const logStatus = status || (action === 'FAILED' ? LogStatus.ERROR : LogStatus.SUCCESS);
  const logType = action === 'SUCCEEDED' ? LogType.PAYMENT_SUCCESS : LogType.PAYMENT_ERROR;
  
  await createLog({
    type: logType,
    status: logStatus,
    message: `Payment ${action.toLowerCase()}: ${amount} ${currency}`,
    context: {
      ...context,
      paymentId,
      userId,
      amount,
      currency,
    },
  });
}

/**
 * Log payout events (high-level, complementary to TransactionLog)
 */
export async function logPayoutEvent(
  action: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PAID' | 'FAILED',
  payoutId: string,
  creatorId: string,
  amount: number,
  currency: string,
  status?: LogStatus,
  context?: Record<string, any>
): Promise<void> {
  const logStatus = status || (
    action === 'FAILED' || action === 'REJECTED' 
      ? LogStatus.ERROR 
      : LogStatus.SUCCESS
  );
  const logType = action === 'FAILED' ? LogType.PAYOUT_ERROR : LogType.PAYOUT_SUCCESS;
  
  await createLog({
    type: logType,
    status: logStatus,
    message: `Payout ${action.toLowerCase()}: ${amount} ${currency}`,
    context: {
      ...context,
      payoutId,
      creatorId,
      amount,
      currency,
    },
  });
}

/**
 * Log webhook events
 */
export async function logWebhookEvent(
  source: string,
  eventType: string,
  success: boolean,
  context?: Record<string, any>
): Promise<void> {
  const status = success ? LogStatus.SUCCESS : LogStatus.ERROR;
  const logType = success ? LogType.STRIPE_WEBHOOK : LogType.STRIPE_WEBHOOK_ERROR;
  const message = success
    ? `Webhook ${source} processed: ${eventType}`
    : `Webhook ${source} failed: ${eventType}`;

  await createLog({
    type: logType,
    status,
    message,
    context: {
      ...context,
      source,
      eventType,
      success,
    },
  });
}

/**
 * Log API errors
 */
export async function logApiError(
  endpoint: string,
  error: Error | string,
  context?: Record<string, any>
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  await createLog({
    type: LogType.API_ERROR,
    status: LogStatus.ERROR,
    message: `API Error at ${endpoint}: ${errorMessage}`,
    context: {
      ...context,
      endpoint,
      errorMessage,
    },
    error: errorStack,
  });
}

/**
 * Get system logs with filtering and pagination
 */
export async function getSystemLogs(filters: {
  status?: LogStatus;
  type?: LogType | string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'asc' | 'desc';
}) {
  const where: Prisma.LogWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.type) {
    where.type = filters.type as LogType;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  if (filters.search) {
    where.OR = [
      { message: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  const orderBy = filters.orderBy || 'desc';

  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where,
      orderBy: { createdAt: orderBy },
      take: limit,
      skip: offset,
    }),
    prisma.log.count({ where }),
  ]);

  return {
    logs,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

/**
 * Delete logs based on retention policy
 */
export async function deleteLogsByRetention() {
  const now = new Date();
  
  // SUCCESS logs: 30 days retention
  const successCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const successDeleted = await prisma.log.deleteMany({
    where: {
      status: LogStatus.SUCCESS,
      createdAt: { lt: successCutoff },
    },
  });

  // ERROR logs: 90 days retention
  const errorCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const errorDeleted = await prisma.log.deleteMany({
    where: {
      status: LogStatus.ERROR,
      createdAt: { lt: errorCutoff },
    },
  });

  return {
    successDeleted: successDeleted.count,
    errorDeleted: errorDeleted.count,
    totalDeleted: successDeleted.count + errorDeleted.count,
  };
}

/**
 * Delete logs by date range
 */
export async function deleteLogsByDateRange(startDate: Date, endDate: Date, status?: LogStatus) {
  const where: Prisma.LogWhereInput = {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (status) {
    where.status = status;
  }

  const result = await prisma.log.deleteMany({ where });
  return result.count;
}

/**
 * Delete logs by filters
 */
export async function deleteLogsByFilters(filters: {
  status?: LogStatus;
  type?: LogType | string;
  startDate?: Date;
  endDate?: Date;
}) {
  const where: Prisma.LogWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.type) {
    where.type = filters.type as LogType;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  const result = await prisma.log.deleteMany({ where });
  return result.count;
}

/**
 * Get log statistics
 */
export async function getLogStats(startDate?: Date, endDate?: Date) {
  const where: Prisma.LogWhereInput = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  const [
    totalLogs,
    successCount,
    errorCount,
  ] = await Promise.all([
    prisma.log.count({ where }),
    prisma.log.count({ where: { ...where, status: LogStatus.SUCCESS } }),
    prisma.log.count({ where: { ...where, status: LogStatus.ERROR } }),
  ]);

  return {
    totalLogs,
    byStatus: {
      success: successCount,
      error: errorCount,
    },
  };
}



// ========================================
// Backward compatibility types and functions
// ========================================

/**
 * LogActor enum for backward compatibility (deprecated)
 * @deprecated Use context fields instead
 */
export enum LogActor {
  USER = 'USER',
  CREATOR = 'CREATOR',
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM',
  GUEST = 'GUEST',
}

/**
 * Log a system error with actor info (backward compatibility)
 */
export async function logSystemError(
  type: string,
  actor: any, // Keeping for compatibility, will be ignored
  message: string,
  actorId?: string,
  context?: Record<string, any>
): Promise<void> {
  await logError(
    type,
    message,
    undefined,
    { ...context, actorId, actor: actor?.toString() }
  );
}

/**
 * Overload of logInfo for backward compatibility with 5 arguments
 */
export async function logInfoOld(
  type: string,
  actor: any,
  message: string,
  actorId?: string,
  context?: Record<string, any>
): Promise<void> {
  await logInfo(
    type,
    message,
    { ...context, actorId, actor: actor?.toString() }
  );
}

/**
 * Overload of logError for backward compatibility with 5 arguments
 */
export async function logErrorOld(
  type: string,
  actor: any,
  message: string,
  actorId?: string,
  context?: Record<string, any>
): Promise<void> {
  await logError(
    type,
    message,
    undefined,
    { ...context, actorId, actor: actor?.toString() }
  );
}

/**
 * Overload of logWarning for backward compatibility with 5 arguments
 */
export async function logWarningOld(
  type: string,
  actor: any,
  message: string,
  actorId?: string,
  context?: Record<string, any>
): Promise<void> {
  await logWarning(
    type,
    message,
    { ...context, actorId, actor: actor?.toString() }
  );
}

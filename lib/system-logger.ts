import { LogLevel, LogActor, Prisma } from "@prisma/client";
import prisma from "@/lib/db";

/**
 * System-wide logging service for tracking all platform activities
 * Separate from TransactionLog which focuses on financial transactions
 */

export interface SystemLogData {
  level: LogLevel;
  type: string;
  actor: LogActor;
  actorId?: string;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Create a system log entry
 * This is the base logging function used by all specialized loggers
 */
export async function createLog(data: SystemLogData): Promise<void> {
  try {
    const logEntry: Prisma.LogCreateInput = {
      level: data.level,
      type: data.type,
      actor: data.actor,
      actorId: data.actorId,
      message: data.message,
      metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
    };

    await prisma.log.create({ data: logEntry });

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[SystemLog]', {
        level: data.level,
        type: data.type,
        actor: data.actor,
        actorId: data.actorId,
        message: data.message,
      });
    }
  } catch (error) {
    // Logging should never crash the application
    console.error('[SystemLog Error]', error);
    console.error('[Original log data]', data);
  }
}

/**
 * Log an INFO level event
 */
export async function logInfo(
  type: string,
  actor: LogActor,
  message: string,
  actorId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await createLog({
    level: LogLevel.INFO,
    type,
    actor,
    actorId,
    message,
    metadata,
  });
}

/**
 * Log a WARNING level event
 */
export async function logWarning(
  type: string,
  actor: LogActor,
  message: string,
  actorId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await createLog({
    level: LogLevel.WARNING,
    type,
    actor,
    actorId,
    message,
    metadata,
  });
}

/**
 * Log an ERROR level event
 */
export async function logError(
  type: string,
  actor: LogActor,
  message: string,
  actorId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await createLog({
    level: LogLevel.ERROR,
    type,
    actor,
    actorId,
    message,
    metadata,
  });
}

/**
 * Log a CRITICAL level event
 */
export async function logCritical(
  type: string,
  actor: LogActor,
  message: string,
  actorId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await createLog({
    level: LogLevel.CRITICAL,
    type,
    actor,
    actorId,
    message,
    metadata,
  });
}

/**
 * Log user authentication events
 */
export async function logAuth(
  action: 'LOGIN' | 'LOGOUT' | 'REGISTER' | 'PASSWORD_RESET' | 'EMAIL_VERIFY',
  userId: string,
  success: boolean,
  metadata?: Record<string, any>
): Promise<void> {
  const level = success ? LogLevel.INFO : LogLevel.WARNING;
  const message = success 
    ? `User ${action.toLowerCase()} successful`
    : `User ${action.toLowerCase()} failed`;

  await createLog({
    level,
    type: `AUTH_${action}`,
    actor: LogActor.USER,
    actorId: userId,
    message,
    metadata: {
      ...metadata,
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
  metadata?: Record<string, any>
): Promise<void> {
  await logInfo(
    `USER_${action}`,
    LogActor.USER,
    message,
    userId,
    metadata
  );
}

/**
 * Log creator actions
 */
export async function logCreatorAction(
  action: string,
  creatorId: string,
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logInfo(
    `CREATOR_${action}`,
    LogActor.CREATOR,
    message,
    creatorId,
    metadata
  );
}

/**
 * Log admin actions
 */
export async function logAdminAction(
  action: string,
  adminId: string,
  message: string,
  level: LogLevel = LogLevel.INFO,
  metadata?: Record<string, any>
): Promise<void> {
  await createLog({
    level,
    type: `ADMIN_${action}`,
    actor: LogActor.ADMIN,
    actorId: adminId,
    message,
    metadata,
  });
}

/**
 * Log system events
 */
export async function logSystem(
  action: string,
  message: string,
  level: LogLevel = LogLevel.INFO,
  metadata?: Record<string, any>
): Promise<void> {
  await createLog({
    level,
    type: `SYSTEM_${action}`,
    actor: LogActor.SYSTEM,
    message,
    metadata,
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
  metadata?: Record<string, any>
): Promise<void> {
  await logInfo(
    `BOOKING_${action}`,
    LogActor.USER,
    `Booking ${action.toLowerCase()}: ${bookingId}`,
    userId,
    {
      ...metadata,
      bookingId,
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
  level?: LogLevel,
  metadata?: Record<string, any>
): Promise<void> {
  const logLevel = level || (action === 'FAILED' ? LogLevel.ERROR : LogLevel.INFO);
  
  await createLog({
    level: logLevel,
    type: `PAYMENT_${action}`,
    actor: LogActor.USER,
    actorId: userId,
    message: `Payment ${action.toLowerCase()}: ${amount} ${currency}`,
    metadata: {
      ...metadata,
      paymentId,
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
  level?: LogLevel,
  metadata?: Record<string, any>
): Promise<void> {
  const logLevel = level || (
    action === 'FAILED' || action === 'REJECTED' 
      ? LogLevel.ERROR 
      : LogLevel.INFO
  );
  
  await createLog({
    level: logLevel,
    type: `PAYOUT_${action}`,
    actor: LogActor.CREATOR,
    actorId: creatorId,
    message: `Payout ${action.toLowerCase()}: ${amount} ${currency}`,
    metadata: {
      ...metadata,
      payoutId,
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
  metadata?: Record<string, any>
): Promise<void> {
  const level = success ? LogLevel.INFO : LogLevel.ERROR;
  const message = success
    ? `Webhook ${source} processed: ${eventType}`
    : `Webhook ${source} failed: ${eventType}`;

  await createLog({
    level,
    type: `WEBHOOK_${source.toUpperCase()}`,
    actor: LogActor.SYSTEM,
    message,
    metadata: {
      ...metadata,
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
  actorType: LogActor = LogActor.SYSTEM,
  actorId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  await createLog({
    level: LogLevel.ERROR,
    type: 'API_ERROR',
    actor: actorType,
    actorId,
    message: `API Error at ${endpoint}: ${errorMessage}`,
    metadata: {
      ...metadata,
      endpoint,
      errorMessage,
      errorStack,
    },
  });
}

/**
 * Get system logs with filtering and pagination
 */
export async function getSystemLogs(filters: {
  level?: LogLevel;
  type?: string;
  actor?: LogActor;
  actorId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'asc' | 'desc';
}) {
  const where: Prisma.LogWhereInput = {};

  if (filters.level) {
    where.level = filters.level;
  }

  if (filters.type) {
    where.type = { contains: filters.type, mode: 'insensitive' };
  }

  if (filters.actor) {
    where.actor = filters.actor;
  }

  if (filters.actorId) {
    where.actorId = filters.actorId;
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
      { type: { contains: filters.search, mode: 'insensitive' } },
      { actorId: { contains: filters.search, mode: 'insensitive' } },
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
  
  // INFO logs: 30 days retention
  const infoCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const infoDeleted = await prisma.log.deleteMany({
    where: {
      level: LogLevel.INFO,
      createdAt: { lt: infoCutoff },
    },
  });

  // WARNING logs: 60 days retention
  const warningCutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const warningDeleted = await prisma.log.deleteMany({
    where: {
      level: LogLevel.WARNING,
      createdAt: { lt: warningCutoff },
    },
  });

  // ERROR logs: 90 days retention
  const errorCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const errorDeleted = await prisma.log.deleteMany({
    where: {
      level: LogLevel.ERROR,
      createdAt: { lt: errorCutoff },
    },
  });

  // CRITICAL logs: never deleted (unlimited retention)

  return {
    infoDeleted: infoDeleted.count,
    warningDeleted: warningDeleted.count,
    errorDeleted: errorDeleted.count,
    totalDeleted: infoDeleted.count + warningDeleted.count + errorDeleted.count,
  };
}

/**
 * Delete logs by date range
 */
export async function deleteLogsByDateRange(startDate: Date, endDate: Date, level?: LogLevel) {
  const where: Prisma.LogWhereInput = {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (level) {
    where.level = level;
  }

  const result = await prisma.log.deleteMany({ where });
  return result.count;
}

/**
 * Delete logs by filters
 */
export async function deleteLogsByFilters(filters: {
  level?: LogLevel;
  type?: string;
  actor?: LogActor;
  actorId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const where: Prisma.LogWhereInput = {};

  if (filters.level) {
    where.level = filters.level;
  }

  if (filters.type) {
    where.type = { contains: filters.type, mode: 'insensitive' };
  }

  if (filters.actor) {
    where.actor = filters.actor;
  }

  if (filters.actorId) {
    where.actorId = filters.actorId;
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
    infoCount,
    warningCount,
    errorCount,
    criticalCount,
    userCount,
    creatorCount,
    adminCount,
    systemCount,
  ] = await Promise.all([
    prisma.log.count({ where }),
    prisma.log.count({ where: { ...where, level: LogLevel.INFO } }),
    prisma.log.count({ where: { ...where, level: LogLevel.WARNING } }),
    prisma.log.count({ where: { ...where, level: LogLevel.ERROR } }),
    prisma.log.count({ where: { ...where, level: LogLevel.CRITICAL } }),
    prisma.log.count({ where: { ...where, actor: LogActor.USER } }),
    prisma.log.count({ where: { ...where, actor: LogActor.CREATOR } }),
    prisma.log.count({ where: { ...where, actor: LogActor.ADMIN } }),
    prisma.log.count({ where: { ...where, actor: LogActor.SYSTEM } }),
  ]);

  return {
    totalLogs,
    byLevel: {
      info: infoCount,
      warning: warningCount,
      error: errorCount,
      critical: criticalCount,
    },
    byActor: {
      user: userCount,
      creator: creatorCount,
      admin: adminCount,
      system: systemCount,
    },
  };
}

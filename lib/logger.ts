import { TransactionEventType, EntityType, Prisma } from "@prisma/client";
import prisma from "@/lib/db";

/**
 * Base transaction log data structure
 */
export interface TransactionLogData {
  eventType: TransactionEventType;
  entityType: EntityType;
  entityId: string;
  stripeEventId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  metadata?: Record<string, any>;
  errorMessage?: string;
  paymentId?: string;
  payoutId?: string;
  refundId?: string;
}

/**
 * Payment-specific log data
 */
export interface PaymentLogData {
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  stripePaymentIntentId?: string;
  metadata?: Record<string, any>;
  errorMessage?: string;
}

/**
 * Payout-specific log data
 */
export interface PayoutLogData {
  payoutId: string;
  creatorId: string;
  amount: number;
  currency?: string;
  status: string;
  stripePayoutId?: string;
  metadata?: Record<string, any>;
  errorMessage?: string;
}

/**
 * Refund-specific log data
 */
export interface RefundLogData {
  refundId: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  stripeRefundId?: string;
  reason?: string;
  metadata?: Record<string, any>;
  errorMessage?: string;
}

/**
 * Webhook-specific log data
 */
export interface WebhookLogData {
  stripeEventId: string;
  eventType: string;
  entityType: EntityType;
  entityId?: string;
  metadata?: Record<string, any>;
  errorMessage?: string;
}

/**
 * Create a transaction log entry
 * This is the base logging function used by all specialized loggers
 */
export async function logTransaction(data: TransactionLogData): Promise<void> {
  try {
    const logEntry: Prisma.TransactionLogCreateInput = {
      eventType: data.eventType,
      entityType: data.entityType,
      entityId: data.entityId,
      stripeEventId: data.stripeEventId,
      amount: data.amount ? new Prisma.Decimal(data.amount) : undefined,
      currency: data.currency,
      status: data.status,
      metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
      errorMessage: data.errorMessage,
    };

    // Add optional relations
    if (data.paymentId) {
      logEntry.payment = { connect: { id: data.paymentId } };
    }
    if (data.payoutId) {
      logEntry.payout = { connect: { id: data.payoutId } };
    }
    if (data.refundId) {
      logEntry.refund = { connect: { id: data.refundId } };
    }

    await prisma.transactionLog.create({ data: logEntry });

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[TransactionLog]', {
        eventType: data.eventType,
        entityType: data.entityType,
        entityId: data.entityId,
        status: data.status,
        amount: data.amount,
      });
    }
  } catch (error) {
    // Logging should never crash the application
    console.error('[TransactionLog Error]', error);
    console.error('[Original log data]', data);
  }
}

/**
 * Log a payment event
 */
export async function logPayment(
  eventType: TransactionEventType,
  data: PaymentLogData
): Promise<void> {
  await logTransaction({
    eventType,
    entityType: EntityType.PAYMENT,
    entityId: data.paymentId,
    paymentId: data.paymentId,
    amount: data.amount,
    currency: data.currency,
    status: data.status,
    stripeEventId: data.stripePaymentIntentId,
    metadata: data.metadata,
    errorMessage: data.errorMessage,
  });
}

/**
 * Log a payout event
 */
export async function logPayout(
  eventType: TransactionEventType,
  data: PayoutLogData
): Promise<void> {
  await logTransaction({
    eventType,
    entityType: EntityType.PAYOUT,
    entityId: data.payoutId,
    payoutId: data.payoutId,
    amount: data.amount,
    currency: data.currency || 'EUR',
    status: data.status,
    stripeEventId: data.stripePayoutId,
    metadata: {
      ...data.metadata,
      creatorId: data.creatorId,
    },
    errorMessage: data.errorMessage,
  });
}

/**
 * Log a refund event
 */
export async function logRefund(
  eventType: TransactionEventType,
  data: RefundLogData
): Promise<void> {
  await logTransaction({
    eventType,
    entityType: EntityType.REFUND,
    entityId: data.refundId,
    refundId: data.refundId,
    paymentId: data.paymentId,
    amount: data.amount,
    currency: data.currency,
    status: data.status,
    stripeEventId: data.stripeRefundId,
    metadata: {
      ...data.metadata,
      reason: data.reason,
    },
    errorMessage: data.errorMessage,
  });
}

/**
 * Log a webhook event
 */
export async function logWebhook(data: WebhookLogData): Promise<void> {
  await logTransaction({
    eventType: TransactionEventType.WEBHOOK_RECEIVED,
    entityType: data.entityType,
    entityId: data.entityId || 'unknown',
    stripeEventId: data.stripeEventId,
    metadata: {
      ...data.metadata,
      webhookEventType: data.eventType,
    },
    errorMessage: data.errorMessage,
  });
}

/**
 * Log a transfer event (Stripe Connect transfer to creator)
 */
export async function logTransfer(
  eventType: TransactionEventType,
  data: {
    transferId: string;
    paymentId?: string;
    amount: number;
    currency: string;
    status: string;
    stripeTransferId?: string;
    destinationAccount?: string;
    metadata?: Record<string, any>;
    errorMessage?: string;
  }
): Promise<void> {
  await logTransaction({
    eventType,
    entityType: EntityType.TRANSFER,
    entityId: data.transferId,
    paymentId: data.paymentId,
    amount: data.amount,
    currency: data.currency,
    status: data.status,
    stripeEventId: data.stripeTransferId,
    metadata: {
      ...data.metadata,
      destinationAccount: data.destinationAccount,
    },
    errorMessage: data.errorMessage,
  });
}

/**
 * Log an error with context
 */
export async function logError(
  eventType: TransactionEventType,
  entityType: EntityType,
  entityId: string,
  error: Error | string,
  metadata?: Record<string, any>
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  await logTransaction({
    eventType,
    entityType,
    entityId,
    status: 'ERROR',
    errorMessage,
    metadata: {
      ...metadata,
      errorStack,
    },
  });
}

/**
 * Log a dispute event
 */
export async function logDispute(
  eventType: TransactionEventType,
  data: {
    disputeId: string;
    paymentId: string;
    amount: number;
    currency: string;
    status: string;
    stripeDisputeId?: string;
    reason?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  await logTransaction({
    eventType,
    entityType: EntityType.DISPUTE,
    entityId: data.disputeId,
    paymentId: data.paymentId,
    amount: data.amount,
    currency: data.currency,
    status: data.status,
    stripeEventId: data.stripeDisputeId,
    metadata: {
      ...data.metadata,
      reason: data.reason,
    },
  });
}

/**
 * Get transaction logs with filtering and pagination
 */
export async function getTransactionLogs(filters: {
  eventType?: TransactionEventType;
  entityType?: EntityType;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: Prisma.TransactionLogWhereInput = {};

  if (filters.eventType) {
    where.eventType = filters.eventType;
  }

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters.entityId) {
    where.entityId = filters.entityId;
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

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const [logs, total] = await Promise.all([
    prisma.transactionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        payment: {
          select: {
            id: true,
            amount: true,
            stripePaymentIntentId: true,
            status: true,
          },
        },
        payout: {
          select: {
            id: true,
            amount: true,
            stripePayoutId: true,
            status: true,
          },
        },
        refund: {
          select: {
            id: true,
            amount: true,
            stripeRefundId: true,
            status: true,
          },
        },
      },
    }),
    prisma.transactionLog.count({ where }),
  ]);

  return {
    logs,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

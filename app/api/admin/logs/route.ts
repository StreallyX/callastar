import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { getTransactionLogs } from '@/lib/logger';
import { TransactionEventType, EntityType } from '@prisma/client';

// Schema validation for query parameters
const logsQuerySchema = z.object({
  eventType: z.nativeEnum(TransactionEventType).optional(),
  entityType: z.nativeEnum(EntityType).optional(),
  entityId: z.string().optional(),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(), // ISO date string
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val, 10) : 0),
});

/**
 * GET /api/admin/logs
 * Fetch transaction logs with filtering and pagination
 * 
 * Query Parameters:
 * - eventType: Filter by event type (PAYMENT_CREATED, PAYOUT_PAID, etc.)
 * - entityType: Filter by entity type (PAYMENT, PAYOUT, REFUND, DISPUTE)
 * - entityId: Filter by specific entity ID
 * - startDate: Filter logs from this date (ISO string)
 * - endDate: Filter logs until this date (ISO string)
 * - limit: Number of logs to return (default: 50, max: 100)
 * - offset: Number of logs to skip for pagination (default: 0)
 * 
 * Example: /api/admin/logs?eventType=PAYMENT_SUCCEEDED&limit=20&offset=0
 * 
 * @returns Paginated transaction logs with metadata
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ 
        success: false,
        error: 'Non authentifié' 
      }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Accès réservé aux administrateurs' 
        },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      eventType: searchParams.get('eventType') || undefined,
      entityType: searchParams.get('entityType') || undefined,
      entityId: searchParams.get('entityId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    };

    // Validate query parameters
    const validatedParams = logsQuerySchema.parse(queryParams);

    // Apply limit cap
    const limit = Math.min(validatedParams.limit || 50, 100);

    // Fetch logs with filters
    const filters = {
      eventType: validatedParams.eventType,
      entityType: validatedParams.entityType,
      entityId: validatedParams.entityId,
      startDate: validatedParams.startDate ? new Date(validatedParams.startDate) : undefined,
      endDate: validatedParams.endDate ? new Date(validatedParams.endDate) : undefined,
      limit,
      offset: validatedParams.offset || 0,
    };

    const result = await getTransactionLogs(filters);

    // Format response
    const formattedLogs = result.logs.map((log: any) => ({
      id: log.id,
      eventType: log.eventType,
      entityType: log.entityType,
      entityId: log.entityId,
      stripeEventId: log.stripeEventId,
      amount: log.amount ? Number(log.amount) : null,
      currency: log.currency,
      status: log.status,
      metadata: log.metadata,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt,
      // Include related entity data if available
      payment: log.payment ? {
        id: log.payment.id,
        amount: Number(log.payment.amount),
        stripePaymentIntentId: log.payment.stripePaymentIntentId,
        status: log.payment.status,
      } : null,
      payout: log.payout ? {
        id: log.payout.id,
        amount: Number(log.payout.amount),
        stripePayoutId: log.payout.stripePayoutId,
        status: log.payout.status,
      } : null,
      refund: log.refund ? {
        id: log.refund.id,
        amount: Number(log.refund.amount),
        stripeRefundId: log.refund.stripeRefundId,
        status: log.refund.status,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      logs: formattedLogs,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error('Error fetching transaction logs:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Paramètres de requête invalides',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la récupération des logs',
      },
      { status: 500 }
    );
  }
}

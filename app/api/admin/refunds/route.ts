import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { logRefund } from '@/lib/logger';
import { TransactionEventType, RefundStatus } from '@prisma/client';

// Schema validation for creating a refund
const createRefundSchema = z.object({
  paymentId: z.string().cuid(),
  amount: z.number().positive().optional(), // Optional - if omitted, full refund
  reason: z.string().min(1, 'Reason is required'),
});

/**
 * POST /api/admin/refunds
 * Create a new refund (admin only)
 * 
 * Request body:
 * - paymentId: string (CUID)
 * - amount?: number (optional, full refund if omitted)
 * - reason: string
 * 
 * @returns Refund details
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createRefundSchema.parse(body);

    // Get payment with booking and creator info
    const payment = await prisma.payment.findUnique({
      where: { id: validatedData.paymentId },
      include: {
        booking: {
          include: {
            callOffer: {
              include: {
                creator: {
                  select: {
                    id: true,
                    userId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Paiement introuvable' },
        { status: 404 }
      );
    }

    // Validate payment status
    if (payment.status !== 'SUCCEEDED') {
      return NextResponse.json(
        { error: 'Le paiement doit être réussi pour être remboursé' },
        { status: 400 }
      );
    }

    // Calculate refund amount
    const paymentAmount = Number(payment.amount);
    const alreadyRefunded = Number(payment.refundedAmount);
    const availableForRefund = paymentAmount - alreadyRefunded;

    const refundAmount = validatedData.amount || availableForRefund;

    // Validate refund amount
    if (refundAmount <= 0) {
      return NextResponse.json(
        { error: 'Le montant du remboursement doit être positif' },
        { status: 400 }
      );
    }

    if (refundAmount > availableForRefund) {
      return NextResponse.json(
        { error: `Montant de remboursement trop élevé. Maximum disponible: ${availableForRefund.toFixed(2)} EUR` },
        { status: 400 }
      );
    }

    // Create Stripe refund
    let stripeRefund;
    try {
      stripeRefund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100), // Convert to cents
        reason: 'requested_by_customer',
        metadata: {
          paymentId: payment.id,
          bookingId: payment.bookingId,
          adminReason: validatedData.reason,
        },
      });
    } catch (stripeError: any) {
      console.error('Stripe refund error:', stripeError);
      return NextResponse.json(
        { error: `Erreur Stripe: ${stripeError.message}` },
        { status: 500 }
      );
    }

    // Create refund record in database
    const refund = await prisma.refund.create({
      data: {
        paymentId: payment.id,
        amount: refundAmount,
        currency: 'EUR',
        reason: validatedData.reason,
        status: RefundStatus.PENDING,
        stripeRefundId: stripeRefund.id,
        initiatedById: payment.booking.callOffer.creator.id,
        metadata: {
          adminUserId: decoded.userId,
          isFullRefund: refundAmount === availableForRefund,
          originalPaymentAmount: paymentAmount,
          previouslyRefunded: alreadyRefunded,
        },
      },
      include: {
        payment: {
          select: {
            id: true,
            amount: true,
            stripePaymentIntentId: true,
            status: true,
          },
        },
        initiatedBy: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Log refund creation
    await logRefund(TransactionEventType.REFUND_CREATED, {
      refundId: refund.id,
      paymentId: payment.id,
      amount: refundAmount,
      currency: 'EUR',
      status: RefundStatus.PENDING,
      stripeRefundId: stripeRefund.id,
      reason: validatedData.reason,
      metadata: {
        adminUserId: decoded.userId,
        isFullRefund: refundAmount === availableForRefund,
      },
    });

    return NextResponse.json(
      {
        message: 'Remboursement créé avec succès',
        refund: {
          id: refund.id,
          amount: Number(refund.amount),
          currency: refund.currency,
          status: refund.status,
          reason: refund.reason,
          stripeRefundId: refund.stripeRefundId,
          createdAt: refund.createdAt,
          payment: {
            id: refund.payment.id,
            amount: Number(refund.payment.amount),
            stripePaymentIntentId: refund.payment.stripePaymentIntentId,
            status: refund.payment.status,
          },
          initiatedBy: {
            id: refund.initiatedBy.id,
            name: refund.initiatedBy.user.name,
            email: refund.initiatedBy.user.email,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create refund error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Une erreur est survenue lors de la création du remboursement' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/refunds
 * List all refunds with filtering (admin only)
 * 
 * Query parameters:
 * - paymentId?: string (filter by payment ID)
 * - status?: RefundStatus (filter by status)
 * - limit?: number (default: 50, max: 100)
 * - offset?: number (default: 0)
 * 
 * @returns Paginated refund list
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const status = searchParams.get('status') as RefundStatus | null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    if (paymentId) {
      where.paymentId = paymentId;
    }
    if (status && Object.values(RefundStatus).includes(status)) {
      where.status = status;
    }

    // Query refunds with pagination
    const [refunds, total] = await Promise.all([
      prisma.refund.findMany({
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
              bookingId: true,
              booking: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                  callOffer: {
                    select: {
                      id: true,
                      title: true,
                      creator: {
                        select: {
                          id: true,
                          user: {
                            select: {
                              id: true,
                              name: true,
                              email: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          initiatedBy: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.refund.count({ where }),
    ]);

    // Format response
    const formattedRefunds = refunds.map((refund) => ({
      id: refund.id,
      amount: Number(refund.amount),
      currency: refund.currency,
      status: refund.status,
      reason: refund.reason,
      stripeRefundId: refund.stripeRefundId,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
      payment: {
        id: refund.payment.id,
        amount: Number(refund.payment.amount),
        stripePaymentIntentId: refund.payment.stripePaymentIntentId,
        status: refund.payment.status,
        booking: {
          id: refund.payment.booking.id,
          title: refund.payment.booking.callOffer.title,
          user: refund.payment.booking.user,
          creator: refund.payment.booking.callOffer.creator.user,
        },
      },
      initiatedBy: {
        id: refund.initiatedBy.id,
        name: refund.initiatedBy.user.name,
        email: refund.initiatedBy.user.email,
      },
      metadata: refund.metadata,
    }));

    return NextResponse.json(
      {
        refunds: formattedRefunds,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('List refunds error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue lors de la récupération des remboursements' },
      { status: 500 }
    );
  }
}

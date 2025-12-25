import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

/**
 * GET /api/admin/refunds/[id]
 * Get refund details by ID (admin only)
 * 
 * @param params - Route parameters containing refund ID
 * @returns Refund details with related payment, creator, and user information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const refundId = params.id;

    // Get refund with full details
    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        payment: {
          include: {
            booking: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
                callOffer: {
                  include: {
                    creator: {
                      include: {
                        user: {
                          select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true,
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
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        transactionLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!refund) {
      return NextResponse.json(
        { error: 'Remboursement introuvable' },
        { status: 404 }
      );
    }

    // Format response
    const formattedRefund = {
      id: refund.id,
      amount: Number(refund.amount),
      currency: refund.currency,
      status: refund.status,
      reason: refund.reason,
      stripeRefundId: refund.stripeRefundId,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
      metadata: refund.metadata,
      payment: {
        id: refund.payment.id,
        amount: Number(refund.payment.amount),
        refundedAmount: Number(refund.payment.refundedAmount),
        platformFee: Number(refund.payment.platformFee),
        creatorAmount: Number(refund.payment.creatorAmount),
        stripePaymentIntentId: refund.payment.stripePaymentIntentId,
        status: refund.payment.status,
        disputeStatus: refund.payment.disputeStatus,
        payoutStatus: refund.payment.payoutStatus,
        createdAt: refund.payment.createdAt,
        booking: {
          id: refund.payment.booking.id,
          status: refund.payment.booking.status,
          totalPrice: Number(refund.payment.booking.totalPrice),
          createdAt: refund.payment.booking.createdAt,
          user: refund.payment.booking.user,
          callOffer: {
            id: refund.payment.booking.callOffer.id,
            title: refund.payment.booking.callOffer.title,
            description: refund.payment.booking.callOffer.description,
            price: Number(refund.payment.booking.callOffer.price),
            dateTime: refund.payment.booking.callOffer.dateTime,
            duration: refund.payment.booking.callOffer.duration,
            creator: {
              id: refund.payment.booking.callOffer.creator.id,
              bio: refund.payment.booking.callOffer.creator.bio,
              isStripeOnboarded: refund.payment.booking.callOffer.creator.isStripeOnboarded,
              user: refund.payment.booking.callOffer.creator.user,
            },
          },
        },
      },
      initiatedBy: {
        id: refund.initiatedBy.id,
        user: refund.initiatedBy.user,
      },
      transactionLogs: refund.transactionLogs.map((log) => ({
        id: log.id,
        eventType: log.eventType,
        entityType: log.entityType,
        amount: log.amount ? Number(log.amount) : null,
        currency: log.currency,
        status: log.status,
        stripeEventId: log.stripeEventId,
        errorMessage: log.errorMessage,
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
    };

    return NextResponse.json(
      {
        refund: formattedRefund,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get refund details error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue lors de la récupération du remboursement' },
      { status: 500 }
    );
  }
}

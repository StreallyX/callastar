import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';

/**
 * GET /api/admin/refunds-disputes
 * Get all refunds and disputes with their reconciliation status
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'reconciled', 'unreconciled', 'all'
    const type = searchParams.get('type'); // 'refunds', 'disputes', 'all'

    // Build where clause for refunds
    const refundWhere: any = {};
    if (status === 'reconciled') {
      refundWhere.reconciled = true;
    } else if (status === 'unreconciled') {
      refundWhere.reconciled = false;
    }

    // Build where clause for disputes
    const disputeWhere: any = {};
    if (status === 'reconciled') {
      disputeWhere.reconciled = true;
    } else if (status === 'unreconciled') {
      disputeWhere.reconciled = false;
    }

    // Fetch refunds
    let refunds: any[] = [];
    if (type !== 'disputes') {
      refunds = await prisma.refund.findMany({
        where: refundWhere,
        include: {
          payment: {
            include: {
              booking: {
                include: {
                  callOffer: {
                    include: {
                      creator: {
                        include: {
                          user: {
                            select: { id: true, name: true, email: true },
                          },
                        },
                      },
                    },
                  },
                  user: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Fetch disputes
    let disputes: any[] = [];
    if (type !== 'refunds') {
      disputes = await prisma.dispute.findMany({
        where: disputeWhere,
        include: {
          payment: {
            include: {
              booking: {
                include: {
                  callOffer: {
                    include: {
                      creator: {
                        include: {
                          user: {
                            select: { id: true, name: true, email: true },
                          },
                        },
                      },
                    },
                  },
                  user: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Calculate summary statistics
    const totalRefunds = refunds.length;
    const totalDisputes = disputes.length;
    const unreconciledRefunds = refunds.filter((r) => !r.reconciled).length;
    const unreconciledDisputes = disputes.filter((d) => !d.reconciled).length;
    const totalUnreconciledDebt =
      refunds
        .filter((r) => !r.reconciled)
        .reduce((sum, r) => sum + Number(r.creatorDebt), 0) +
      disputes
        .filter((d) => !d.reconciled)
        .reduce((sum, d) => sum + Number(d.creatorDebt), 0);

    return NextResponse.json({
      success: true,
      refunds,
      disputes,
      summary: {
        totalRefunds,
        totalDisputes,
        unreconciledRefunds,
        unreconciledDisputes,
        totalUnreconciledDebt,
      },
    });
  } catch (error) {
    console.error('Error fetching refunds/disputes:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/refunds-disputes
 * Mark a refund or dispute as reconciled manually
 * Admin only
 */
export async function PATCH(request: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, id, reversalId } = body;

    if (!type || !id || (type !== 'refund' && type !== 'dispute')) {
      return NextResponse.json(
        { error: 'Paramètres invalides' },
        { status: 400 }
      );
    }

    if (type === 'refund') {
      const { markRefundAsReconciled } = await import('@/lib/creator-debt');
      await markRefundAsReconciled(id, 'MANUAL', reversalId);

      // Get refund to check creator and unblock if needed
      const refund = await prisma.refund.findUnique({
        where: { id },
        include: {
          payment: {
            include: {
              booking: {
                include: {
                  callOffer: {
                    select: { creatorId: true },
                  },
                },
              },
            },
          },
        },
      });

      if (refund) {
        const { checkAndUnblockPayouts } = await import('@/lib/creator-debt');
        await checkAndUnblockPayouts(refund.payment.booking.callOffer.creatorId);
      }
    } else {
      const { markDisputeAsReconciled } = await import('@/lib/creator-debt');
      await markDisputeAsReconciled(id, 'MANUAL', reversalId);

      // Get dispute to check creator and unblock if needed
      const dispute = await prisma.dispute.findUnique({
        where: { id },
        include: {
          payment: {
            include: {
              booking: {
                include: {
                  callOffer: {
                    select: { creatorId: true },
                  },
                },
              },
            },
          },
        },
      });

      if (dispute) {
        const { checkAndUnblockPayouts } = await import('@/lib/creator-debt');
        await checkAndUnblockPayouts(dispute.payment.booking.callOffer.creatorId);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${type === 'refund' ? 'Remboursement' : 'Contestation'} marqué comme réconcilié`,
    });
  } catch (error) {
    console.error('Error marking as reconciled:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la réconciliation' },
      { status: 500 }
    );
  }
}

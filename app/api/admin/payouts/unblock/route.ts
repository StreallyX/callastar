import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { PayoutAction } from '@prisma/client';

/**
 * POST /api/admin/payouts/unblock
 * Unblock payouts for a creator (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated as admin
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé - Accès administrateur requis' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { creatorId } = body;

    // Validation
    if (!creatorId) {
      return NextResponse.json(
        { error: 'L\'ID du créateur est requis' },
        { status: 400 }
      );
    }

    // Get creator
    const creator = await db.creator.findUnique({
      where: { id: creatorId },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    // Check if not blocked
    if (!creator.isPayoutBlocked) {
      return NextResponse.json(
        { 
          error: 'Pas bloqué',
          message: 'Les paiements pour ce créateur ne sont pas bloqués'
        },
        { status: 400 }
      );
    }

    // Update creator - unblock payouts
    const updatedCreator = await db.creator.update({
      where: { id: creatorId },
      data: {
        isPayoutBlocked: false,
        payoutBlockReason: null,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    // Create audit log entry
    const auditLog = await db.payoutAuditLog.create({
      data: {
        creatorId: creator.id,
        action: PayoutAction.UNBLOCKED,
        adminId: jwtUser.userId,
        reason: 'Paiements débloqués par un administrateur',
        metadata: JSON.stringify({
          adminEmail: jwtUser.email,
          timestamp: new Date().toISOString(),
          previousBlockReason: creator.payoutBlockReason,
        })
      }
    });

    return NextResponse.json({
      message: 'Paiements débloqués avec succès',
      creator: {
        id: updatedCreator.id,
        name: updatedCreator.user.name,
        email: updatedCreator.user.email,
        isPayoutBlocked: updatedCreator.isPayoutBlocked,
        payoutBlockReason: updatedCreator.payoutBlockReason,
      },
      auditLog: {
        id: auditLog.id,
        action: auditLog.action,
        createdAt: auditLog.createdAt,
      }
    });
  } catch (error) {
    console.error('Error unblocking payouts:', error);
    return NextResponse.json(
      { error: 'Erreur lors du déblocage des paiements' },
      { status: 500 }
    );
  }
}

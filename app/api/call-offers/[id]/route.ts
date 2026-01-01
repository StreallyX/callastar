import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { logCreatorAction, logBooking, logApiError } from '@/lib/system-logger';
import { LogActor } from '@prisma/client';
import { sanitizeDecimals } from '@/lib/decimal-utils';

export const dynamic = 'force-dynamic';

const updateOfferSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  price: z.number().positive().optional(),
  dateTime: z.string().datetime().optional(),
  duration: z.number().positive().optional(),
  status: z.enum(['AVAILABLE', 'BOOKED', 'COMPLETED', 'CANCELLED']).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const callOffer = await db.callOffer.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            bio: true,
            profileImage: true,
            currency: true, // ✅ Include creator's currency
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        booking: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!callOffer) {
      return NextResponse.json(
        { error: 'Offre introuvable' },
        { status: 404 }
      );
    }

    // ✅ Convert Decimal to number to avoid React warnings
    const sanitizedCallOffer = sanitizeDecimals(callOffer);

    return NextResponse.json({ callOffer: sanitizedCallOffer }, { status: 200 });
  } catch (error) {
    console.error('Get call offer error:', error);

    // Log API error
    await logApiError(
      `/api/call-offers/${await params.then(p => p.id)}`,
      error instanceof Error ? error : 'Unknown error',
      {
        actor: LogActor.GUEST,
        actorId: undefined,
        action: 'GET_CALL_OFFER',
        offerId: await params.then(p => p.id)
      }
    );

    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    if (user.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Accès refusé' },
        { status: 403 }
      );
    }

    // Get call offer
    const callOffer = await db.callOffer.findUnique({
      where: { id },
      include: {
        creator: true,
      },
    });

    if (!callOffer) {
      return NextResponse.json(
        { error: 'Offre introuvable' },
        { status: 404 }
      );
    }

    // Check ownership
    if (callOffer.creator.userId !== user.userId) {
      return NextResponse.json(
        { error: 'Accès refusé. Vous ne pouvez modifier que vos propres offres.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateOfferSchema.parse(body);

    // Log the update initiation
    await logCreatorAction(
      'OFFER_UPDATE_INITIATED',
      callOffer.creator.id,
      `Modification d'offre initiée pour ${callOffer.title}`,
      {
        offerId: id,
        changes: validatedData,
        previousStatus: callOffer.status,
      }
    );

    // Update call offer
    const updatedData: any = {};
    const changes: string[] = [];
    
    if (validatedData.title) {
      updatedData.title = validatedData.title;
      changes.push(`title: ${callOffer.title} → ${validatedData.title}`);
    }
    if (validatedData.description) {
      updatedData.description = validatedData.description;
      changes.push('description modified');
    }
    if (validatedData.price) {
      updatedData.price = validatedData.price;
      changes.push(`price: ${callOffer.price} → ${validatedData.price}`);
    }
    if (validatedData.dateTime) {
      updatedData.dateTime = new Date(validatedData.dateTime);
      changes.push(`dateTime: ${callOffer.dateTime} → ${validatedData.dateTime}`);
    }
    if (validatedData.duration) {
      updatedData.duration = validatedData.duration;
      changes.push(`duration: ${callOffer.duration} → ${validatedData.duration}`);
    }
    if (validatedData.status) {
      updatedData.status = validatedData.status;
      changes.push(`status: ${callOffer.status} → ${validatedData.status}`);
    }

    const updated = await db.callOffer.update({
      where: { id },
      data: updatedData,
      include: {
        creator: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        booking: {
          include: {
            user: true,
          },
        },
      },
    });

    // Log the update completion
    await logCreatorAction(
      'OFFER_UPDATED',
      updated.creator.id,
      `Offre d'appel modifiée avec succès : ${updated.title}`,
      {
        offerId: id,
        changes: changes,
        newStatus: updated.status,
      }
    );

    // If status changed to CANCELLED or COMPLETED and there's a booking, log it
    if (validatedData.status && updated.booking) {
      if (validatedData.status === 'CANCELLED' && callOffer.status !== 'CANCELLED') {
        await logBooking(
          'CANCELLED',
          updated.booking.id,
          updated.booking.userId,
          updated.creator.id,
          {
            callOfferId: id,
            previousStatus: callOffer.status,
            newStatus: 'CANCELLED',
            cancelledBy: 'creator',
            cancelledByUserId: user.userId,
            cancelledAt: new Date().toISOString(),
            reason: 'Cancelled by creator via call offer update',
          }
        );
      } else if (validatedData.status === 'COMPLETED' && callOffer.status !== 'COMPLETED') {
        await logBooking(
          'COMPLETED',
          updated.booking.id,
          updated.booking.userId,
          updated.creator.id,
          {
            callOfferId: id,
            previousStatus: callOffer.status,
            newStatus: 'COMPLETED',
            completedAt: new Date().toISOString(),
            completedBy: 'creator',
          }
        );
      }
    }

    // ✅ Convert Decimal to number to avoid React warnings
    const sanitizedUpdated = sanitizeDecimals(updated);

    return NextResponse.json(
      { callOffer: sanitizedUpdated },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update call offer error:', error);

    // Log API error
    const user = await getUserFromRequest(request).catch(() => null);
    await logApiError(
      `/api/call-offers/${await params.then(p => p.id)}`,
      error instanceof Error ? error : 'Unknown error',
      {
        actor: LogActor.CREATOR,
        actorId: user?.userId,
        action: 'UPDATE_CALL_OFFER',
        offerId: await params.then(p => p.id)
      }
    );

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    if (user.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Accès refusé' },
        { status: 403 }
      );
    }

    // Get call offer
    const callOffer = await db.callOffer.findUnique({
      where: { id },
      include: {
        creator: true,
      },
    });

    if (!callOffer) {
      return NextResponse.json(
        { error: 'Offre introuvable' },
        { status: 404 }
      );
    }

    // Check ownership
    if (callOffer.creator.userId !== user.userId) {
      return NextResponse.json(
        { error: 'Accès refusé. Vous ne pouvez supprimer que vos propres offres.' },
        { status: 403 }
      );
    }

    // Log deletion initiation
    await logCreatorAction(
      'OFFER_DELETE_INITIATED',
      callOffer.creator.id,
      `Suppression d'offre initiée pour ${callOffer.title}`,
      {
        offerId: id,
        offerTitle: callOffer.title,
        offerStatus: callOffer.status,
      }
    );

    // Delete call offer
    await db.callOffer.delete({
      where: { id },
    });

    // Log successful deletion
    await logCreatorAction(
      'OFFER_DELETED',
      callOffer.creator.id,
      `Offre d'appel supprimée avec succès : ${callOffer.title}`,
      {
        offerId: id,
        offerTitle: callOffer.title,
        deletedAt: new Date().toISOString(),
      }
    );

    return NextResponse.json(
      { success: true, message: 'Offre supprimée avec succès' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete call offer error:', error);

    // Log API error
    const user = await getUserFromRequest(request).catch(() => null);
    await logApiError(
      `/api/call-offers/${await params.then(p => p.id)}`,
      error instanceof Error ? error : 'Unknown error',
      {
        actor: LogActor.CREATOR,
        actorId: user?.userId,
        action: 'DELETE_CALL_OFFER',
        offerId: await params.then(p => p.id)
      }
    );

    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

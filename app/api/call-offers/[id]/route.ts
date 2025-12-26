import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

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

    return NextResponse.json({ callOffer }, { status: 200 });
  } catch (error) {
    console.error('Get call offer error:', error);
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

    // Update call offer
    const updatedData: any = {};
    if (validatedData.title) updatedData.title = validatedData.title;
    if (validatedData.description) updatedData.description = validatedData.description;
    if (validatedData.price) updatedData.price = validatedData.price;
    if (validatedData.dateTime) updatedData.dateTime = new Date(validatedData.dateTime);
    if (validatedData.duration) updatedData.duration = validatedData.duration;
    if (validatedData.status) updatedData.status = validatedData.status;

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
      },
    });

    return NextResponse.json(
      { callOffer: updated },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update call offer error:', error);

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

    // Delete call offer
    await db.callOffer.delete({
      where: { id },
    });

    return NextResponse.json(
      { success: true, message: 'Offre supprimée avec succès' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete call offer error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

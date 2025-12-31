import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Schema validation
const createReviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.preprocess(
    (val) => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') return val.trim();
      return '';
    },
    z.string().max(200)
  ),
});



// POST /api/reviews - Create a review
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createReviewSchema.parse(body);

    // Get the booking
    const booking = await prisma.booking.findUnique({
      where: { id: validatedData.bookingId },
      include: {
        callOffer: {
          include: {
            creator: true,
          },
        },
        review: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 });
    }

    // Verify that the user owns this booking
    if (booking.userId !== decoded.userId) {
      return NextResponse.json(
        { error: 'Non autorisé à évaluer cette réservation' },
        { status: 403 }
      );
    }

    // Check if booking is completed
    const callDate = new Date(booking.callOffer.dateTime).getTime();
    const callEnd = callDate + booking.callOffer.duration * 60 * 1000;

    if (Date.now() < callEnd) {
      return NextResponse.json(
        { error: 'Vous ne pouvez évaluer qu’un appel terminé' },
        { status: 400 }
      );
    }


    // Check if already reviewed
    if (booking.review) {
      return NextResponse.json(
        { error: 'Vous avez déjà évalué cet appel' },
        { status: 400 }
      );
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        bookingId: validatedData.bookingId,
        userId: decoded.userId,
        creatorId: booking.callOffer.creatorId,
        rating: validatedData.rating,
        comment: validatedData.comment ?? '',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        booking: {
          include: {
            callOffer: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error('Error creating review:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'évaluation' },
      { status: 500 }
    );
  }
}

// GET /api/reviews - Get reviews with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creatorId');
    const userId = searchParams.get('userId');

    const reviews = await prisma.review.findMany({
      where: {
        ...(creatorId && { creatorId }),
        ...(userId && { userId }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        booking: {
          include: {
            callOffer: {
              select: {
                title: true,
                dateTime: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des évaluations' },
      { status: 500 }
    );
  }
}

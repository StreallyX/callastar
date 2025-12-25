import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/reviews/creator/[id] - Get reviews for a specific creator with average rating
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get all reviews for the creator
    const reviews = await prisma.review.findMany({
      where: {
        creatorId: params.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
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

    // Calculate average rating
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

    return NextResponse.json({
      reviews,
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      totalReviews: reviews.length,
    });
  } catch (error) {
    console.error('Error fetching creator reviews:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des évaluations' },
      { status: 500 }
    );
  }
}

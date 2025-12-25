import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const createOfferSchema = z.object({
  title: z.string().min(3, 'Le titre doit contenir au moins 3 caractères'),
  description: z.string().min(10, 'La description doit contenir au moins 10 caractères'),

  // Accept "59.99" or 59.99
  price: z.coerce.number().positive('Le prix doit être positif'),

  // Accept ISO string OR Date-compatible input
  dateTime: z.coerce.date(),

  // Accept "30" or 30
  duration: z.coerce.number().positive('La durée doit être positive'),
});


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creatorId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (creatorId) {
      where.creatorId = creatorId;
    }

    if (status) {
      where.status = status;
    }

    // Only show future dates for available offers
    if (status === 'AVAILABLE') {
      where.dateTime = { gte: new Date() };
    }

    const callOffers = await db.callOffer.findMany({
      where,
      skip,
      take: limit,
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
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            payment: true,
          },
        },
      },
      orderBy: {
        dateTime: 'asc',
      },
    });

    const total = await db.callOffer.count({ where });

    return NextResponse.json(
      {
        callOffers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get call offers error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    if (user.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Accès refusé. Seuls les créateurs peuvent créer des offres.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Get creator
    const creator = await db.creator.findUnique({
      where: { userId: user.userId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Profil créateur introuvable' },
        { status: 404 }
      );
    }

    // Note: Stripe Connect validation is enforced at booking time, not offer creation.
    // This allows creators to create offers first and set up payments later.
    // See /api/bookings/route.ts for the Stripe Connect validation.

    // Create call offer
    const validatedData = createOfferSchema.parse(body);

    const callOffer = await db.callOffer.create({
      data: {
        creatorId: creator.id,
        title: validatedData.title,
        description: validatedData.description,
        price: validatedData.price,
        dateTime: validatedData.dateTime,
        duration: validatedData.duration,
      },
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
      { callOffer },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create call offer error:', error);

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

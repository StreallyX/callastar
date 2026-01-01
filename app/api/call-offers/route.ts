import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { sanitizeDecimals } from '@/lib/decimal-utils';

export const dynamic = 'force-dynamic';

const createOfferSchema = z.object({
  title: z.string().min(3, 'Le titre doit contenir au moins 3 caractères'),
  description: z.string().min(10, 'La description doit contenir au moins 10 caractères'),
  price: z.number().positive('Le prix doit être positif'),
  dateTime: z.coerce.date(),
  duration: z.number().positive('La durée doit être positive'),
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

    // ✅ Convert Decimal to number to avoid React warnings
    const sanitizedCallOffers = sanitizeDecimals(callOffers);

    return NextResponse.json(
      {
        callOffers: sanitizedCallOffers,
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
    const validatedData = createOfferSchema.parse(body);

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

    // ✅ NEW: Use creator's currency for the offer
    const currency = creator.currency || 'EUR';

    // Create call offer
    const callOffer = await db.callOffer.create({
      data: {
        creatorId: creator.id,
        title: validatedData.title,
        description: validatedData.description,
        price: validatedData.price,
        currency: currency, // ✅ NEW: Store currency with offer
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

    // ✅ Convert Decimal to number to avoid React warnings
    const sanitizedCallOffer = sanitizeDecimals(callOffer);

    return NextResponse.json(
      { callOffer: sanitizedCallOffer },
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

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sanitizeDecimals } from '@/lib/decimal-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Get creators with their user info
    const creators = await db.creator.findMany({
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        callOffers: {
          where: {
            status: 'AVAILABLE',
            dateTime: {
              gte: new Date(),
            },
          },
          take: 3,
          orderBy: {
            dateTime: 'asc',
          },
        },
      },
    });

    // Get total count
    const total = await db.creator.count();

    // ✅ Convert Decimal to number to avoid React warnings
    const sanitizedCreators = sanitizeDecimals(creators);

    return NextResponse.json(
      {
        creators: sanitizedCreators,
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
    console.error('Get creators error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

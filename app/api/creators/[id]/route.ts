import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sanitizeDecimals } from '@/lib/decimal-utils';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const creator = await db.creator.findUnique({
      where: { id },
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
          orderBy: {
            dateTime: 'asc',
          },
        },
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    // ✅ Convert Decimal to number to avoid React warnings
    const sanitizedCreator = sanitizeDecimals(creator);

    return NextResponse.json({ creator: sanitizedCreator }, { status: 200 });
  } catch (error) {
    console.error('Get creator error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

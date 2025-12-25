import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Schema validation
const createCallRequestSchema = z.object({
  creatorId: z.string(),
  proposedPrice: z.number().positive(),
  proposedDateTime: z.string().transform(str => new Date(str)),
  message: z.string().min(10).max(500),
});

// POST /api/call-requests - Create a call request
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

    // Check if user is not a creator (users only can request calls)
    if (decoded.role === 'CREATOR') {
      return NextResponse.json(
        { error: 'Les créateurs ne peuvent pas faire de demandes d\'appels' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createCallRequestSchema.parse(body);

    // Check if creator exists
    const creator = await prisma.creator.findUnique({
      where: { id: validatedData.creatorId },
    });

    if (!creator) {
      return NextResponse.json({ error: 'Créateur introuvable' }, { status: 404 });
    }

    // Create call request
    const callRequest = await prisma.callRequest.create({
      data: {
        userId: decoded.userId,
        creatorId: validatedData.creatorId,
        proposedPrice: validatedData.proposedPrice,
        proposedDateTime: validatedData.proposedDateTime,
        message: validatedData.message,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            bio: true,
            profileImage: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(callRequest, { status: 201 });
  } catch (error) {
    console.error('Error creating call request:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur lors de la création de la demande' },
      { status: 500 }
    );
  }
}

// GET /api/call-requests - Get call requests (received for creators, sent for users)
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    let callRequests;

    if (decoded.role === 'CREATOR') {
      // Get creator's ID
      const creator = await prisma.creator.findUnique({
        where: { userId: decoded.userId },
      });

      if (!creator) {
        return NextResponse.json({ error: 'Profil créateur introuvable' }, { status: 404 });
      }

      // Get requests received by the creator
      callRequests = await prisma.callRequest.findMany({
        where: {
          creatorId: creator.id,
          ...(status && { status: status as any }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      // Get requests sent by the user
      callRequests = await prisma.callRequest.findMany({
        where: {
          userId: decoded.userId,
          ...(status && { status: status as any }),
        },
        include: {
          creator: {
            select: {
              id: true,
              bio: true,
              profileImage: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    return NextResponse.json(callRequests);
  } catch (error) {
    console.error('Error fetching call requests:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des demandes' },
      { status: 500 }
    );
  }
}

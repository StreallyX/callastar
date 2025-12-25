import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/call-requests/[id] - Get a specific call request
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const callRequest = await prisma.callRequest.findUnique({
      where: { id: params.id },
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
            userId: true,
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

    if (!callRequest) {
      return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
    }

    // Verify ownership (user who sent or creator who received)
    const isOwner = callRequest.userId === decoded.userId;
    const isCreator = decoded.role === 'CREATOR' && callRequest.creator.userId === decoded.userId;

    if (!isOwner && !isCreator && decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé à voir cette demande' },
        { status: 403 }
      );
    }

    return NextResponse.json(callRequest);
  } catch (error) {
    console.error('Error fetching call request:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la demande' },
      { status: 500 }
    );
  }
}

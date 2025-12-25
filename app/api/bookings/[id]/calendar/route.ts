import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { generateICS, getICSFilename } from '@/lib/calendar';

// GET - Download ICS calendar file for a booking
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tokenValue = req.cookies.get('auth-token')?.value;
    if (!tokenValue) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const token = await verifyToken(tokenValue);
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = params;

    // Fetch booking with all required relations
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        callOffer: {
          include: {
            creator: {
              include: {
                user: true,
              },
            },
          },
        },
        user: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 });
    }

    // Verify user has access to this booking
    if (booking.userId !== token.userId && booking.callOffer.creator.userId !== token.userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // Generate ICS content
    const icsContent = generateICS(booking);
    const filename = getICSFilename(booking);

    // Return ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating calendar file:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du fichier calendrier' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

// PUT /api/call-requests/[id]/reject - Reject a call request
export async function PUT(
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

    // Check if user is a creator
    if (decoded.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Seuls les créateurs peuvent rejeter des demandes' },
        { status: 403 }
      );
    }

    // Get creator's ID
    const creator = await prisma.creator.findUnique({
      where: { userId: decoded.userId },
    });

    if (!creator) {
      return NextResponse.json({ error: 'Profil créateur introuvable' }, { status: 404 });
    }

    // Get the call request
    const callRequest = await prisma.callRequest.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        creator: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!callRequest) {
      return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
    }

    // Verify that the creator owns this request
    if (callRequest.creatorId !== creator.id) {
      return NextResponse.json(
        { error: 'Non autorisé à rejeter cette demande' },
        { status: 403 }
      );
    }

    // Check if already accepted or rejected
    if (callRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cette demande a déjà été traitée' },
        { status: 400 }
      );
    }

    // Update the call request status
    const updatedCallRequest = await prisma.callRequest.update({
      where: { id: params.id },
      data: {
        status: 'REJECTED',
      },
      include: {
        user: true,
        creator: {
          include: {
            user: true,
          },
        },
      },
    });

    // Send email notification to the user
    try {
      await sendEmail({
        to: callRequest.user.email,
        subject: 'Votre demande d\'appel',
        html: `
          <h1>Demande d'appel</h1>
          <p>Bonjour ${callRequest.user.name},</p>
          <p><strong>${callRequest.creator.user.name}</strong> ne peut malheureusement pas accepter votre demande d'appel pour le moment.</p>
          <p>N'hésitez pas à consulter les autres offres disponibles sur Call a Star.</p>
        `,
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json(updatedCallRequest);
  } catch (error) {
    console.error('Error rejecting call request:', error);
    return NextResponse.json(
      { error: 'Erreur lors du rejet de la demande' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

// PUT /api/call-requests/[id]/accept - Accept a call request
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
        { error: 'Seuls les créateurs peuvent accepter des demandes' },
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
        { error: 'Non autorisé à accepter cette demande' },
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

    // Create a CallOffer from the request
    const callOffer = await prisma.callOffer.create({
      data: {
        creatorId: creator.id,
        title: `Appel avec ${callRequest.creator.user.name}`,
        description: `Appel demandé par ${callRequest.user.name}: ${callRequest.message}`,
        price: callRequest.proposedPrice,
        dateTime: callRequest.proposedDateTime,
        duration: 30, // Default 30 minutes
        status: 'AVAILABLE',
      },
    });

    // Update the call request status
    const updatedCallRequest = await prisma.callRequest.update({
      where: { id: params.id },
      data: {
        status: 'ACCEPTED',
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
        subject: 'Votre demande d\'appel a été acceptée !',
        html: `
          <h1>Bonne nouvelle !</h1>
          <p>Bonjour ${callRequest.user.name},</p>
          <p><strong>${callRequest.creator.user.name}</strong> a accepté votre demande d'appel.</p>
          <p><strong>Détails de l'appel :</strong></p>
          <ul>
            <li>Date et heure : ${new Date(callRequest.proposedDateTime).toLocaleString('fr-FR')}</li>
            <li>Prix : ${callRequest.proposedPrice}€</li>
          </ul>
          <p>Vous pouvez maintenant réserver cet appel sur Call a Star.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/book/${callOffer.id}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Réserver maintenant</a></p>
        `,
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      callRequest: updatedCallRequest,
      callOffer,
    });
  } catch (error) {
    console.error('Error accepting call request:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'acceptation de la demande' },
      { status: 500 }
    );
  }
}

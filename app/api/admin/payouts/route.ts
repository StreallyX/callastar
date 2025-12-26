import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

// Schema validation for creating payout
const createPayoutSchema = z.object({
  creatorId: z.string(),
  amount: z.number().positive(),
});

// GET /api/admin/payouts - Get all payouts
export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const creatorId = searchParams.get('creatorId');

    const payouts = await prisma.payout.findMany({
      where: {
        ...(status && status !== 'all' && { status: status as any }),
        ...(creatorId && creatorId !== 'all' && { creatorId }),
      },
      include: {
        creator: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(payouts);
  } catch (error) {
    console.error('Error fetching payouts:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des payouts' },
      { status: 500 }
    );
  }
}

// POST /api/admin/payouts - Create a payout
export async function POST(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createPayoutSchema.parse(body);

    // Check if creator exists
    const creator = await prisma.creator.findUnique({
      where: { id: validatedData.creatorId },
      include: {
        user: true,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: 'Créateur introuvable' }, { status: 404 });
    }

    // Create payout record
    const payout = await prisma.payout.create({
      data: {
        creatorId: validatedData.creatorId,
        amount: validatedData.amount,
        status: 'PENDING',
      },
      include: {
        creator: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // TODO: Integrate with Stripe Connect to actually send the payout
    // For now, we'll just mark it as PAID for demo purposes
    // In production, you would use Stripe API: stripe.payouts.create()

    // Update payout status to PAID (in production, this would be done via webhook)
    const updatedPayout = await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'PAID',
      },
    });

    // Send email notification to creator
    try {
      await sendEmail({
        to: creator.user.email,
        subject: 'Paiement reçu !',
        html: `
          <h1>Paiement reçu</h1>
          <p>Bonjour ${creator.user.name},</p>
          <p>Vous avez reçu un paiement de <strong>${validatedData.amount}€</strong> sur votre compte Call a Star.</p>
          <p>Merci de faire partie de notre plateforme !</p>
        `,
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
    }

    return NextResponse.json(updatedPayout, { status: 201 });
  } catch (error) {
    console.error('Error creating payout:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur lors de la création du payout' },
      { status: 500 }
    );
  }
}

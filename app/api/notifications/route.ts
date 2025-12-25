import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

// GET - Fetch user's notifications
export async function GET(req: NextRequest) {
  try {
    const tokenValue = req.cookies.get('auth-token')?.value;
    if (!tokenValue) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const token = await verifyToken(tokenValue);
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: token.userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to last 50 notifications
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des notifications' },
      { status: 500 }
    );
  }
}

// POST - Create a notification (internal use)
export async function POST(req: NextRequest) {
  try {
    const tokenValue = req.cookies.get('auth-token')?.value;
    if (!tokenValue) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const token = await verifyToken(tokenValue);
    if (!token || token.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, type, title, message, link } = body;

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
      },
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la notification' },
      { status: 500 }
    );
  }
}

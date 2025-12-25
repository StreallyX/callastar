import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

// POST - Mark all notifications as read
export async function POST(req: NextRequest) {
  try {
    const tokenValue = req.cookies.get('auth-token')?.value;
    if (!tokenValue) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const token = await verifyToken(tokenValue);
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    await prisma.notification.updateMany({
      where: {
        userId: token.userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des notifications' },
      { status: 500 }
    );
  }
}

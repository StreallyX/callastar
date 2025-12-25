import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

// PATCH - Mark notification as read
export async function PATCH(
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

    // Verify notification belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== token.userId) {
      return NextResponse.json({ error: 'Notification introuvable' }, { status: 404 });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la notification' },
      { status: 500 }
    );
  }
}

// DELETE - Delete notification
export async function DELETE(
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

    // Verify notification belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== token.userId) {
      return NextResponse.json({ error: 'Notification introuvable' }, { status: 404 });
    }

    await prisma.notification.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la notification' },
      { status: 500 }
    );
  }
}

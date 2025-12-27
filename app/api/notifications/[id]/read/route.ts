/**
 * PATCH /api/notifications/[id]/read
 * Marquer une notification comme lue
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { markNotificationAsRead } from "@/lib/notifications";
import prisma from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notificationId = params.id;

    // Verify the notification belongs to the user
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true },
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    if (notification.userId !== jwtUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Mark as read
    const updatedNotification = await markNotificationAsRead(notificationId);

    return NextResponse.json(updatedNotification, { status: 200 });
  } catch (error) {
    console.error("[PATCH /api/notifications/[id]/read] Error:", error);
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
      { status: 500 }
    );
  }
}

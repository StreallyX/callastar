/**
 * DELETE /api/notifications/[id]
 * Supprimer une notification
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { deleteNotification } from "@/lib/notifications";

export async function DELETE(
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

    // Delete notification (function checks ownership)
    await deleteNotification(notificationId, jwtUser.userId);

    return NextResponse.json(
      { message: "Notification deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE /api/notifications/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    );
  }
}

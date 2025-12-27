/**
 * PATCH /api/notifications/mark-all-read
 * Marquer toutes les notifications comme lues
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { markAllNotificationsAsRead } from "@/lib/notifications";

export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Mark all notifications as read
    const result = await markAllNotificationsAsRead(jwtUser.userId);

    return NextResponse.json(
      { message: "All notifications marked as read", count: result.count },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PATCH /api/notifications/mark-all-read] Error:", error);
    return NextResponse.json(
      { error: "Failed to mark all notifications as read" },
      { status: 500 }
    );
  }
}

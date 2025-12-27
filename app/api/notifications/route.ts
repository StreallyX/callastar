/**
 * GET /api/notifications
 * Récupérer les notifications de l'utilisateur connecté
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getUserNotifications } from "@/lib/notifications";
import { NotificationType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const read = searchParams.get("read");
    const type = searchParams.get("type");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Build options
    const options: any = {};
    
    if (read !== null) {
      options.read = read === "true";
    }
    
    if (type && Object.values(NotificationType).includes(type as NotificationType)) {
      options.type = type as NotificationType;
    }
    
    if (limit) {
      options.limit = parseInt(limit, 10);
    }
    
    if (offset) {
      options.offset = parseInt(offset, 10);
    }

    // Get notifications
    const result = await getUserNotifications(jwtUser.userId, options);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[GET /api/notifications] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

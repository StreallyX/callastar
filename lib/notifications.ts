/**
 * Notification System
 * Helper functions for creating and managing in-app notifications
 */

import prisma from "@/lib/db";
import { NotificationType } from "@prisma/client";

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: any;
}

/**
 * Create a notification for a specific user
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
  metadata,
}: CreateNotificationParams) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      },
    });
  } catch (error) {
    console.error("[createNotification] Error:", error);
    // Non-blocking: notifications should not break workflows
    return null;
  }
}

/**
 * Notify all admins
 */
export async function notifyAdmins({
  type,
  title,
  message,
  link,
  metadata,
}: Omit<CreateNotificationParams, "userId">) {
  try {
    // Get all admin users
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (admins.length === 0) {
      console.warn("[notifyAdmins] No admin users found");
      return [];
    }

    // Create notifications for all admins
    const notifications = await Promise.all(
      admins.map((admin: { id: string }) =>
        createNotification({
          userId: admin.id,
          type,
          title,
          message,
          link,
          metadata,
        })
      )
    );

    return notifications.filter((n: any) => n !== null);
  } catch (error) {
    console.error("[notifyAdmins] Error:", error);
    return [];
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[markNotificationAsRead] Error:", error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  try {
    return await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[markAllNotificationsAsRead] Error:", error);
    throw error;
  }
}

/**
 * Get unread count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    return await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  } catch (error) {
    console.error("[getUnreadCount] Error:", error);
    return 0;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, userId: string) {
  try {
    return await prisma.notification.delete({
      where: {
        id: notificationId,
        userId, // Ensure user owns the notification
      },
    });
  } catch (error) {
    console.error("[deleteNotification] Error:", error);
    throw error;
  }
}

/**
 * Get notifications for a user with filters
 */
export async function getUserNotifications(
  userId: string,
  options: {
    read?: boolean;
    type?: NotificationType;
    limit?: number;
    offset?: number;
  } = {}
) {
  try {
    const where: any = { userId };

    if (options.read !== undefined) {
      where.read = options.read;
    }

    if (options.type) {
      where.type = options.type;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    const unreadCount = await getUnreadCount(userId);

    return {
      notifications,
      unreadCount,
    };
  } catch (error) {
    console.error("[getUserNotifications] Error:", error);
    throw error;
  }
}

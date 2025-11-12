import { prisma } from "../../infra/db/prisma";
import { ConflictError, NotFoundError } from "../../core/errors";

export class NotificationRepository {
  async createNotification(params: {
    requestId: string;
    userId: string;
    notificationType: string;
    priority: number;
    metadata?: Record<string, unknown>;
  }) {
    try {
      return await prisma.notification.create({
        data: {
          request_id: params.requestId,
          user_id: params.userId,
          notification_type: params.notificationType,
          status: "pending",
          priority: params.priority,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        throw new ConflictError("Notification with this request_id exists");
      }
      throw err;
    }
  }

  async findByRequestId(requestId: string) {
    return prisma.notification.findUnique({ where: { request_id: requestId } });
  }

  async findById(id: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundError("Notification not found");
    }
    return notification;
  }

  async updateStatus(params: {
    id: string;
    status: string;
    error?: string;
  }) {
    return prisma.notification.update({
      where: { id: params.id },
      data: {
        status: params.status,
        error: params.error ?? null,
      },
    });
  }
}

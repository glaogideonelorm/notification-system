import { NotificationRepository } from "./notification.repository";

import {
  NotificationRequest,
  NotificationStatusUpdate,
} from "./notification.types";

import { QueuePublisher } from "../../infra/queue/rabbitmq";

import { UserServiceClient } from "../../infra/http/user-service.client";

import { TemplateServiceClient } from "../../infra/http/template-service.client";

import {
  AppError,
  ServiceUnavailableError,
  NotFoundError,
} from "../../core/errors";

import { logger } from "../../config/logger";

export class NotificationService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly queue: QueuePublisher,
    private readonly userClient: UserServiceClient,
    private readonly templateClient: TemplateServiceClient
  ) {}

  async createNotification(req: NotificationRequest) {
    
    const existing = await this.repo.findByRequestId(req.request_id);
    if (existing) return existing;

    
    const user = await this.userClient.getUserById(req.user_id);

    if (!user.preferences[req.notification_type]) {
      throw new AppError(
        `User has disabled ${req.notification_type} notifications`,
        400,
        "PREFERENCE_DISABLED"
      );
    }

    
    await this.templateClient.ensureTemplateExists(req.template_code);

    
    const notification = await this.repo.createNotification({
      requestId: req.request_id,
      userId: req.user_id,
      notificationType: req.notification_type,
      priority: req.priority,
      metadata: req.metadata,
    });

    
    const message = {
      notification_id: notification.id,
      request_id: notification.request_id,
      notification_type: notification.notification_type,
      user_id: notification.user_id,
      email: user.email,
      push_token: user.push_token ?? null,
      template_code: req.template_code,
      variables: req.variables,
      priority: notification.priority,
      metadata: notification.metadata,
      created_at: notification.created_at.toISOString(),
    };

    
    try {
      if (req.notification_type === "email") {
        await this.queue.publishEmail(message);
      } else {
        await this.queue.publishPush(message);
      }
    } catch (err) {
      
      await this.repo.updateStatus({
        id: notification.id,
        status: "failed",
        error: "Failed to enqueue notification",
      });
      throw new ServiceUnavailableError("Failed to enqueue notification");
    }

    return notification;
  }

  async updateStatus(channel: string, payload: NotificationStatusUpdate) {
    const notification = await this.repo.findById(payload.notification_id);

    
    return this.repo.updateStatus({
      id: notification.id,
      status: payload.status,
      error: payload.error,
    });
  }

  async getNotification(id: string) {
    return this.repo.findById(id);
  }
}

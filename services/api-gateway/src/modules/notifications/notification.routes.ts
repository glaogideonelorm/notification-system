import { FastifyInstance } from "fastify";

import {
  notificationRequestSchema,
  notificationStatusUpdateSchema,
  notificationApiResponseSchema,
  apiResponseBaseSchema,
  notificationResponseSchema,
} from "./notification.schemas";

import { z } from "zod";

export function registerNotificationRoutes(app: FastifyInstance) {
  
  app.post(
    "/api/v1/notifications/",
    {
      schema: {
        body: notificationRequestSchema,
        response: {
          201: notificationApiResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const notification = await app.notificationService.createNotification(
        req.body,
      );
      const data = {
        notification_id: notification.id,
        request_id: notification.request_id,
        user_id: notification.user_id,
        notification_type: notification.notification_type,
        status: notification.status,
        priority: notification.priority,
        error: notification.error,
        metadata: notification.metadata ? JSON.parse(notification.metadata) : null,
        created_at: notification.created_at.toISOString(),
        updated_at: notification.updated_at.toISOString(),
      };
      reply.code(201).send({
        success: true,
        data,
        message: "Notification accepted",
        meta: null,
      });
    },
  );

  
  const channelParamSchema = z.object({
    notification_preference: z.enum(["email", "push"]),
  });

  app.post(
    "/api/v1/:notification_preference/status/",
    {
      schema: {
        params: channelParamSchema,
        body: notificationStatusUpdateSchema,
        response: {
          200: apiResponseBaseSchema(notificationResponseSchema),
        },
      },
    },
    async (req, reply) => {
      const channel = (req.params as { notification_preference: string }).notification_preference;
      const updated = await app.notificationService.updateStatus(
        channel,
        req.body,
      );
      const data = {
        notification_id: updated.id,
        request_id: updated.request_id,
        user_id: updated.user_id,
        notification_type: updated.notification_type,
        status: updated.status,
        priority: updated.priority,
        error: updated.error,
        metadata: updated.metadata ? JSON.parse(updated.metadata) : null,
        created_at: updated.created_at.toISOString(),
        updated_at: updated.updated_at.toISOString(),
      };
      reply.send({
        success: true,
        data,
        message: "Status updated",
        meta: null,
      });
    },
  );

  
  const idParamSchema = z.object({
    id: z.string(),
  });

  app.get(
    "/api/v1/notifications/:id",
    {
      schema: {
        params: idParamSchema,
        response: {
          200: apiResponseBaseSchema(notificationResponseSchema),
        },
      },
    },
    async (req, reply) => {
      const notification = await app.notificationService.getNotification(
        (req.params as { id: string }).id,
      );
      const data = {
        notification_id: notification.id,
        request_id: notification.request_id,
        user_id: notification.user_id,
        notification_type: notification.notification_type,
        status: notification.status,
        priority: notification.priority,
        error: notification.error,
        metadata: notification.metadata ? JSON.parse(notification.metadata) : null,
        created_at: notification.created_at.toISOString(),
        updated_at: notification.updated_at.toISOString(),
      };
      reply.send({
        success: true,
        data,
        message: "Notification found",
        meta: null,
      });
    },
  );
}

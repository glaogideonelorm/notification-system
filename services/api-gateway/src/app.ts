import Fastify from "fastify";

import {
  ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import { logger } from "./config/logger";

import { registerNotificationRoutes } from "./modules/notifications/notification.routes";

import { registerHealthRoutes } from "./core/health.routes";

import { RabbitMQPublisher } from "./infra/queue/rabbitmq";

import { HttpUserServiceClient } from "./infra/http/user-service.client";

import { HttpTemplateServiceClient } from "./infra/http/template-service.client";

import { NotificationRepository } from "./modules/notifications/notification.repository";

import { NotificationService } from "./modules/notifications/notification.service";

import { AppError } from "./core/errors";

export async function buildApp() {
  const fastify = Fastify({
    logger,
  }).withTypeProvider<ZodTypeProvider>();

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  // Init infra
  const queuePublisher = new RabbitMQPublisher();
  await queuePublisher.init();

  const userClient = new HttpUserServiceClient();
  const templateClient = new HttpTemplateServiceClient();

  const repo = new NotificationRepository();

  const notificationService = new NotificationService(
    repo,
    queuePublisher,
    userClient,
    templateClient
  );

  
  fastify.decorate("notificationService", notificationService);

 
  fastify.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      reply.status(err.statusCode).send({
        success: false,
        message: err.message,
        error: err.code,
        meta: null,
      });
      return;
    }

    
    if (err.name === "ZodError") {
      reply.status(400).send({
        success: false,
        message: "Validation error",
        error: "VALIDATION_ERROR",
        meta: { details: (err as any).issues },
      });
      return;
    }

    req.log.error(err);
    reply.status(500).send({
      success: false,
      message: "Internal server error",
      error: "INTERNAL_SERVER_ERROR",
      meta: null,
    });
  });

  
  registerNotificationRoutes(fastify);
  registerHealthRoutes(fastify);

  return fastify;
}


declare module "fastify" {
  interface FastifyInstance {
    notificationService: NotificationService;
  }
}

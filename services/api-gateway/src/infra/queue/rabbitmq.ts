import * as amqp from "amqplib";

import { env } from "../../config/env";

import { logger } from "../../config/logger";

export interface QueuePublisher {
  publishEmail(message: object): Promise<void>;
  publishPush(message: object): Promise<void>;
}

const EXCHANGE = "notifications.direct";

export class RabbitMQPublisher implements QueuePublisher {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  async init() {
    try {
      logger.info("Connecting to RabbitMQ...");
      
      // Connect with SSL/TLS support for CloudAMQP
      this.connection = await amqp.connect(env.RABBITMQ_URL, {
        // CloudAMQP uses SSL, so we need proper options
        heartbeat: 60,
      });

      this.connection.on("error", (err) => {
        logger.error("RabbitMQ connection error:", err);
      });

      this.connection.on("close", () => {
        logger.warn("RabbitMQ connection closed");
      });

      this.channel = await this.connection.createChannel();

      // Declare exchange
      await this.channel.assertExchange(EXCHANGE, "direct", { durable: true });

      // Declare queues with dead letter exchange support
      await this.channel.assertQueue("email.queue", { 
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "failed",
          "x-dead-letter-routing-key": "failed",
        },
      });

      await this.channel.assertQueue("push.queue", { 
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "failed",
          "x-dead-letter-routing-key": "failed",
        },
      });

      // Bind queues to exchange
      await this.channel.bindQueue("email.queue", EXCHANGE, "email");
      await this.channel.bindQueue("push.queue", EXCHANGE, "push");

      logger.info("RabbitMQ connected and queues bound");
    } catch (error) {
      logger.error("Failed to initialize RabbitMQ:", error);
      throw error;
    }
  }


  private getChannel(): amqp.Channel {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not initialized");
    }
    return this.channel;
  }

  async publishEmail(message: object) {
    const channel = this.getChannel();
    const payload = Buffer.from(JSON.stringify(message));

    const ok = channel.publish(EXCHANGE, "email", payload, {
      contentType: "application/json",
      persistent: true,
    });

    if (!ok) {
      logger.warn("RabbitMQ publishEmail returned false");
    }
  }

  async publishPush(message: object) {
    const channel = this.getChannel();
    const payload = Buffer.from(JSON.stringify(message));

    const ok = channel.publish(EXCHANGE, "push", payload, {
      contentType: "application/json",
      persistent: true,
    });

    if (!ok) {
      logger.warn("RabbitMQ publishPush returned false");
    }
  }
}

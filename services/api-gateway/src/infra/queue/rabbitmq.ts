import * as amqp from "amqplib";

import { env } from "../../config/env";

import { logger } from "../../config/logger";

export interface QueuePublisher {
  publishEmail(message: object): Promise<void>;
  publishPush(message: object): Promise<void>;
}

const EXCHANGE = "notifications.direct";

export class RabbitMQPublisher implements QueuePublisher {
  private connection: any;
  private channel: any;

  async init() {
    this.connection = await amqp.connect(env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(EXCHANGE, "direct", { durable: true });

    await this.channel.assertQueue("email.queue", { durable: true });
    await this.channel.assertQueue("push.queue", { durable: true });

    await this.channel.bindQueue("email.queue", EXCHANGE, "email");
    await this.channel.bindQueue("push.queue", EXCHANGE, "push");

    logger.info("RabbitMQ connected and queues bound");
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

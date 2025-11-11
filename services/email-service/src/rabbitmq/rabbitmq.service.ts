import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { EmailService } from '../email/email.service';
import { QueueMessage } from '../types';
import { RetryHelper } from '../common/utils/retry.helper';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    private configService: ConfigService,
    private emailService: EmailService,
  ) {
    this.maxRetries = this.configService.get<number>('email.maxRetries', 5);
    this.retryDelay = this.configService.get<number>('email.retryDelay', 1000);
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    const config = this.configService.get('rabbitmq');
    const url = `amqp://${config.username}:${config.password}@${config.host}:${config.port}`;

    this.logger.log('Connecting to RabbitMQ...');

    this.connection = amqp.connect([url], {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 5,
    });

    this.connection.on('connect', () => {
      this.logger.log('Connected to RabbitMQ');
    });

    this.connection.on('disconnect', (err) => {
      this.logger.error('Disconnected from RabbitMQ', err);
    });

    this.channelWrapper = this.connection.createChannel({
      json: false,
      setup: async (channel: ConfirmChannel) => {
        await this.setupQueues(channel);
      },
    });

    await this.startConsuming();
  }

  private async setupQueues(channel: ConfirmChannel) {
    const config = this.configService.get('rabbitmq');

    // Declare dead letter exchange
    await channel.assertExchange('failed', 'direct', { durable: true });

    // Declare dead letter queue
    await channel.assertQueue(config.failedQueue, { durable: true });
    await channel.bindQueue(config.failedQueue, 'failed', 'failed');

    // Declare email queue with DLQ configuration
    await channel.assertQueue(config.emailQueue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'failed',
        'x-dead-letter-routing-key': 'failed',
      },
    });

    this.logger.log('Queues and exchanges set up successfully');
  }

  private async startConsuming() {
    const config = this.configService.get('rabbitmq');

    await this.channelWrapper.addSetup((channel: ConfirmChannel) => {
      return channel.consume(
        config.emailQueue,
        async (msg: ConsumeMessage) => {
          if (msg) {
            await this.handleMessage(msg, channel);
          }
        },
        { noAck: false },
      );
    });

    this.logger.log(`Started consuming from ${config.emailQueue}`);
  }

  private async handleMessage(msg: ConsumeMessage, channel: ConfirmChannel) {
    const messageId = msg.properties.messageId || 'unknown';
    const retryCount = msg.properties.headers['x-retry-count'] || 0;

    try {
      const message: QueueMessage = JSON.parse(msg.content.toString());

      this.logger.log(
        `Processing message ${messageId} (attempt ${retryCount + 1}/${this.maxRetries})`,
      );

      // Process email with retry logic
      await RetryHelper.exponentialBackoff(
        () => this.emailService.processEmailNotification(message),
        this.maxRetries,
        this.retryDelay,
      );

      // Success - acknowledge message
      channel.ack(msg);
      this.logger.log(`Message ${messageId} processed successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to process message ${messageId}: ${error.message}`,
      );

      if (retryCount < this.maxRetries - 1) {
        // Retry - republish with incremented counter
        const delay = RetryHelper.calculateBackoff(retryCount, this.retryDelay);

        setTimeout(() => {
          channel.publish(
            '',
            this.configService.get('rabbitmq.emailQueue'),
            msg.content,
            {
              ...msg.properties,
              headers: {
                ...msg?.properties?.headers,
                'x-retry-count': retryCount + 1,
              },
            },
          );
          channel.ack(msg);

          this.logger.log(
            `Message ${messageId} requeued for retry ${retryCount + 1}`,
          );
        }, delay);
      } else {
        // Max retries exceeded - send to DLQ
        this.logger.error(
          `Message ${messageId} exceeded max retries, sending to DLQ`,
        );
        channel.nack(msg, false, false);
      }
    }
  }

  async publishToFailedQueue(message: any, reason: string) {
    try {
      await this.channelWrapper.publish(
        'failed',
        'failed',
        Buffer.from(
          JSON.stringify({
            ...message,
            failed_reason: reason,
            failed_at: new Date().toISOString(),
          }),
        ),
        {
          persistent: true,
        },
      );

      this.logger.log(
        `Message published to failed queue: ${message.message_id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to publish to DLQ: ${error.message}`);
    }
  }

  isConnected(): boolean {
    return this.connection?.isConnected() || false;
  }

  private async disconnect() {
    try {
      await this.channelWrapper.close();
      await this.connection.close();
      this.logger.log('Disconnected from RabbitMQ');
    } catch (error) {
      this.logger.error(`Error disconnecting from RabbitMQ: ${error.message}`);
    }
  }
}

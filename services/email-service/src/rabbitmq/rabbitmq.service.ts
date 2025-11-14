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
import { QueueMessage, RabbitMQConfig } from '../types';
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

  onModuleInit() {
    this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private connect() {
    const config = this.configService.get<RabbitMQConfig>('rabbitmq');

    if (!config) {
      throw new Error('Rabbit MQ configuration not found');
    }

    // const url = `amqp://${config.username}:${config.password}@${config.host}:${config.port}`;

    const url = config?.url;

    if (!url) {
      throw new Error('RABBITMQ_URL not provided');
    }

    this.logger.log('Connecting to RabbitMQ...');

    this.connection = amqp.connect([url], {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 5,
      connectionOptions: { rejectUnauthorized: true },
    });

    this.connection.on('connect', () => {
      this.logger.log('Connected to RabbitMQ');
    });

    this.connection.on('disconnect', (err) => {
      this.logger.error('Disconnected from RabbitMQ', err);
    });

    // Create the channel and do both: declare exchanges/queues and start consuming
    this.channelWrapper = this.connection.createChannel({
      json: false,
      setup: async (channel: ConfirmChannel) => {
        // 1) Setup exchanges and queues
        await this.setupQueues(channel);

        // 2) Start consuming AFTER queues/exchanges are guaranteed declared
        const cfg = this.configService.get<RabbitMQConfig>('rabbitmq');
        if (!cfg) {
          this.logger.error('Rabbit MQ configuration not found during setup');
          return;
        }

        await channel.consume(
          cfg.emailQueue,
          (msg: ConsumeMessage | null) => {
            if (msg) {
              // handleMessage returns a Promise; do not await here (consumer callback), handle errors explicitly
              this.handleMessage(msg, channel).catch((error: unknown) => {
                const errMsg =
                  error instanceof Error ? error.message : String(error);
                this.logger.error(`Error handling message: ${errMsg}`);
                // If handleMessage failed without ack/nack, nack to requeue or move to DLQ depending on policy
                try {
                  channel.nack(msg, false, false);
                } catch (e) {
                  this.logger.error(
                    'Failed to nack message after handler error',
                  );
                }
              });
            }
          },
          { noAck: false },
        );
      },
    });
  }

  // rabbitmq.service.ts (email-service)

  private async setupQueues(channel: ConfirmChannel) {
    const config = this.configService.get<RabbitMQConfig>('rabbitmq');

    if (!config) {
      throw new Error('Rabbit MQ configuration not found');
    }

    // Declare the exchange that api-gateway uses
    await channel.assertExchange('notifications.direct', 'direct', {
      durable: true,
    });

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

    // Bind email queue to the notifications exchange with 'email' routing key
    await channel.bindQueue(config.emailQueue, 'notifications.direct', 'email');

    this.logger.log('Queues and exchanges set up successfully');
  }

  private async handleMessage(msg: ConsumeMessage, channel: ConfirmChannel) {
    const messageId = (msg.properties.messageId as string) || 'unknown';

    const retryCount =
      (msg.properties.headers?.['x-retry-count'] as number) || 0;

    try {
      const parsed = JSON.parse(msg.content.toString()) as QueueMessage;

      const message = parsed;

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
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process message ${messageId}: ${errMsg}`);

      if (retryCount < this.maxRetries - 1) {
        // Retry - republish with incremented counter
        const delay = RetryHelper.calculateBackoff(retryCount, this.retryDelay);

        // Capture required values now. Avoid throwing from inside setTimeout.
        const emailQueue = this.configService.get<string>(
          'rabbitmq.emailQueue',
        );
        const props = { ...msg.properties };
        const headers = {
          ...(msg.properties.headers ?? {}),
          'x-retry-count': retryCount + 1,
        };

        setTimeout(() => {
          if (!emailQueue) {
            // Log and move to DLQ safely rather than throw
            this.logger.error(
              'Email queue configuration not found during retry; sending message to DLQ',
            );
            try {
              channel.nack(msg, false, false);
            } catch (e) {
              this.logger.error(
                'Failed to nack message when emailQueue missing',
              );
            }
            return;
          }

          try {
            channel.publish('', emailQueue, msg.content, {
              ...props,
              headers,
            });
            channel.ack(msg);
            this.logger.log(
              `Message ${messageId} requeued for retry ${retryCount + 1}`,
            );
          } catch (publishError: unknown) {
            const pubMsg =
              publishError instanceof Error
                ? publishError.message
                : String(publishError);
            this.logger.error(
              `Failed to republish message ${messageId}: ${pubMsg}`,
            );
            // If republish fails, nack so it can be retried or go to DLQ
            try {
              channel.nack(msg, false, false);
            } catch (e) {
              this.logger.error('Failed to nack message after publish failure');
            }
          }
        }, delay);
      } else {
        // Max retries exceeded - send to DLQ
        this.logger.error(
          `Message ${messageId} exceeded max retries, sending to DLQ`,
        );
        try {
          channel.nack(msg, false, false);
        } catch (e) {
          this.logger.error('Failed to nack message when moving to DLQ');
        }
      }
    }
  }

  async publishToFailedQueue(
    message: { message_id?: string; [key: string]: unknown },
    reason: string,
  ) {
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

      const messageId = message.message_id ?? '<unknown>';
      this.logger.log(`Message published to failed queue: ${messageId}`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to publish to DLQ: ${errMsg}`);
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
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error disconnecting from RabbitMQ: ${errMsg}`);
    }
  }
}

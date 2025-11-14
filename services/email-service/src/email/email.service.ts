import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CircuitBreaker from 'opossum';
import { IEmailProvider } from './providers/email-provider.interface';
import { SendGridProvider } from './providers/sendgrid.provider';
import { SMTPProvider } from './providers/smtp.provider';
import { TemplateService } from '../template/template.service';
import {
  QueueMessage,
  EmailPayload,
  EmailCircuitBreakerConfig,
} from '../types';
import { StatusReporterService } from '../common/services/status-reporter.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private emailProvider: IEmailProvider;
  private circuitBreaker: CircuitBreaker<[EmailPayload], unknown>;

  constructor(
    private configService: ConfigService,
    private sendGridProvider: SendGridProvider,
    private smtpProvider: SMTPProvider,
    private templateService: TemplateService,
    private statusReporter: StatusReporterService,
  ) {
    this.initializeProvider();
    this.initializeCircuitBreaker();
  }

  private initializeProvider() {
    const provider = this.configService.get<string>('email.provider');

    if (provider === 'sendgrid') {
      this.emailProvider = this.sendGridProvider;
      this.logger.log('Using SendGrid provider');
    } else {
      this.emailProvider = this.smtpProvider;
      this.logger.log('Using SMTP provider');
    }
  }

  private initializeCircuitBreaker() {
    const config = this.configService.get<EmailCircuitBreakerConfig>(
      'email.circuitBreaker',
    );

    this.circuitBreaker = new CircuitBreaker<[EmailPayload]>(
      async (payload) => {
        await this.emailProvider.sendEmail(payload);
      },
      {
        timeout: config?.timeout,
        errorThresholdPercentage: config?.errorThresholdPercentage,
        resetTimeout: config?.resetTimeout,
      },
    );

    // Circuit breaker events
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker opened - email service unavailable');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.log('Circuit breaker half-open - testing recovery');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.log('Circuit breaker closed - email service recovered');
    });

    this.logger.log('Circuit breaker initialized');
  }

  async processEmailNotification(message: QueueMessage): Promise<void> {
    const startTime = Date.now();

    console.log({ message });

    this.logger.log(
      `Processing email notification ${message.notification_id} for user ${message.user_id}`,
    );

    // Report as pending
    await this.statusReporter.reportPending(message.notification_id);

    try {
      // 1. Fetch template using template_code
      const template = await this.templateService.getTemplate(
        message.template_code,
        message.language,
      );

      // 2. Substitute variables - now includes name, link, meta
      const subject = this.templateService.substituteVariables(
        template.subject,
        message.variables,
      );
      const body = this.templateService.substituteVariables(
        template.body,
        message.variables,
      );

      // 3. Prepare email payload
      const emailPayload: EmailPayload = {
        to: message.email,
        subject,
        html: body,
      };

      // 4. Send email through circuit breaker
      await this.circuitBreaker.fire(emailPayload);

      const duration = Date.now() - startTime;
      this.logger.log(
        `Email sent successfully to ${message.email} in ${duration}ms`,
      );

      // 5. Report success
      await this.statusReporter.reportDelivered(message.notification_id);
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process email notification ${message.notification_id} after ${duration}ms: ${errMsg}`,
      );

      await this.statusReporter.reportFailed(message.notification_id, errMsg);

      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      return await this.emailProvider.verifyConnection();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Health check failed: ${errMsg}`);
      return false;
    }
  }

  isCircuitOpen(): boolean {
    return this.circuitBreaker.opened;
  }
}

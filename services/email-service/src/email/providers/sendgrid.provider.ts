// src/email/providers/sendgrid.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import { IEmailProvider } from './email-provider.interface';
import { EmailPayload } from '../../types';

@Injectable()
export class SendGridProvider implements IEmailProvider {
  private readonly logger = new Logger(SendGridProvider.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('email.sendgrid.apiKey');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.log('SendGrid initialized');
    } else {
      this.logger.warn('SendGrid API key not found');
    }
  }

  async sendEmail(payload: EmailPayload): Promise<void> {
    const fromEmail =
      this.configService.get<string>('email.sendgrid.fromEmail') ??
      'no-reply@example.com';

    const fromName = this.configService.get<string>('email.sendgrid.fromName');

    const msg: sgMail.MailDataRequired = {
      to: payload.to,
      from: {
        email: payload.from?.email || fromEmail,
        name: payload.from?.name || fromName,
      },
      subject: payload.subject,
      html: payload.html,
      text: payload.text || this.stripHtml(payload.html),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Email sent successfully to ${payload.to}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(`Failed to send email: ${err.message}`);
      } else {
        this.logger.error(`Failed to send email: ${String(err)}`);
      }
      throw err;
    }
  }

  async verifyConnection(): Promise<boolean> {
    const apiKey = this.configService.get<string>('email.sendgrid.apiKey');
    return await Promise.resolve(!!apiKey);
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}

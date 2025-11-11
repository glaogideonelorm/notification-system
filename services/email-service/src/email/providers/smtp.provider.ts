import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter, SentMessageInfo } from 'nodemailer';
import { IEmailProvider } from './email-provider.interface';
import { EmailPayload, EmailSentInfo, SMTPConfig } from '../../types';

@Injectable()
export class SMTPProvider implements IEmailProvider {
  private readonly logger = new Logger(SMTPProvider.name);
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const smtpConfig = this.configService.get<SMTPConfig>('email.smtp');

    if (!smtpConfig) {
      throw new Error('SMTP configuration is missing');
    }

    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth,
    });

    this.logger.log('SMTP transporter initialized');
  }

  async sendEmail(payload: EmailPayload): Promise<void> {
    const smtpConfig = this.configService.get<SMTPConfig>('email.smtp');

    if (!smtpConfig) {
      throw new Error('SMTP configuration is missing');
    }

    const fromEmail = smtpConfig.fromEmail;
    const fromName = smtpConfig.fromName;

    const mailOptions = {
      from: `"${payload.from?.name || fromName}" <${payload.from?.email || fromEmail}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text || this.stripHtml(payload.html),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);

      const emailInfo = info as unknown as EmailSentInfo;

      this.logger.log(`Email sent: ${emailInfo.messageId} to ${payload.to}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send email: ${errorMessage}`);
      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified');
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`SMTP verification failed: ${errorMessage}`);
      return false;
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}

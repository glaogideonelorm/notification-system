import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { SendGridProvider } from './providers/sendgrid.provider';
import { SMTPProvider } from './providers/smtp.provider';
import { TemplateModule } from '../template/template.module';
import { StatusReporterService } from 'src/common/services/status-reporter.service';

@Module({
  imports: [TemplateModule],
  providers: [
    EmailService,
    SendGridProvider,
    SMTPProvider,
    StatusReporterService,
  ],
  controllers: [EmailController],
  exports: [EmailService],
})
export class EmailModule {}

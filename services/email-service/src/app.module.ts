import { Module } from '@nestjs/common';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { EmailModule } from './email/email.module';
import { TemplateModule } from './template/template.module';
import { ConfigModule } from '@nestjs/config';
import { configuration, validationSchema } from './config/configuration';
import emailConfig from './config/email.config';
import rabbitmqConfig from './config/rabbitmq.config';
import { HttpModule } from '@nestjs/axios';
import { TerminusModule } from '@nestjs/terminus';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, emailConfig, rabbitmqConfig],
      envFilePath: '.env',
      validationSchema,
    }),
    TerminusModule,
    HttpModule,
    RabbitMQModule,
    EmailModule,
    TemplateModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

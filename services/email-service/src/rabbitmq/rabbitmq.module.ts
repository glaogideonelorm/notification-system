import { Module } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}

// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from '@nestjs/terminus';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { EmailService } from '../email/email.service';
import { ResponseHelper } from '../common/utils/response.helper';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private rabbitMQService: RabbitMQService,
    private emailService: EmailService,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      // Check RabbitMQ connection
      async () => {
        const isConnected = this.rabbitMQService.isConnected();
        return {
          rabbitmq: {
            status: isConnected ? 'up' : 'down',
          },
        };
      },

      // Check Email provider
      async () => {
        const isHealthy = await this.emailService.checkHealth();
        return {
          email_provider: {
            status: isHealthy ? 'up' : 'down',
          },
        };
      },

      // Check Circuit Breaker
      async () => {
        const isOpen = this.emailService.isCircuitOpen();
        return {
          circuit_breaker: {
            status: isOpen ? 'open' : 'closed',
            healthy: !isOpen,
          },
        };
      },
    ]);
  }

  @Get('simple')
  simpleCheck() {
    return ResponseHelper.success({
      status: 'ok',
      service: 'email-service',
      timestamp: new Date().toISOString(),
    });
  }
}

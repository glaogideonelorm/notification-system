import { Controller, Get } from '@nestjs/common';
import { EmailService } from './email.service';
import { ResponseHelper } from '../common/utils/response.helper';

@Controller('api/email')
export class EmailController {
  constructor(private emailService: EmailService) {}

  @Get('status')
  async getStatus() {
    const isHealthy = await this.emailService.checkHealth();
    const isCircuitOpen = this.emailService.isCircuitOpen();

    return ResponseHelper.success({
      healthy: isHealthy,
      circuit_breaker: {
        open: isCircuitOpen,
        status: isCircuitOpen ? 'open' : 'closed',
      },
    });
  }
}

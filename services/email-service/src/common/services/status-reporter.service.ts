import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export enum NotificationStatus {
  DELIVERED = 'delivered',
  PENDING = 'pending',
  FAILED = 'failed',
}

interface StatusUpdate {
  notification_id: string;
  status: NotificationStatus;
  timestamp?: string;
  error?: string;
}

@Injectable()
export class StatusReporterService {
  private readonly logger = new Logger(StatusReporterService.name);
  private readonly apiGatewayUrl: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.apiGatewayUrl = this.configService.get<string>(
      'API_GATEWAY_URL',
      'http://localhost:3000',
    );
  }

  async reportStatus(update: StatusUpdate): Promise<void> {
    try {
      const url = `${this.apiGatewayUrl}/api/v1/email/status/`;

      const payload = {
        notification_id: update.notification_id,
        status: update.status,
        timestamp: update.timestamp || new Date().toISOString(),
        error: update.error || null,
      };

      await firstValueFrom(this.httpService.post(url, payload));

      this.logger.log(
        `Status reported: ${update.notification_id} - ${update.status}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to report status for ${update.notification_id}: ${error.message}`,
      );
      // Don't throw - status reporting failure shouldn't stop email processing
    }
  }

  async reportDelivered(notificationId: string): Promise<void> {
    await this.reportStatus({
      notification_id: notificationId,
      status: NotificationStatus.DELIVERED,
    });
  }

  async reportPending(notificationId: string): Promise<void> {
    await this.reportStatus({
      notification_id: notificationId,
      status: NotificationStatus.PENDING,
    });
  }

  async reportFailed(notificationId: string, error: string): Promise<void> {
    await this.reportStatus({
      notification_id: notificationId,
      status: NotificationStatus.FAILED,
      error,
    });
  }
}

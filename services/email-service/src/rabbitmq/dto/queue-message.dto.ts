import { IsString, IsObject, IsNumber, IsEnum } from 'class-validator';
import { NotificationType } from 'src/types';

export class QueueMessageDto {
  @IsString()
  message_id: string;

  @IsEnum(['email', 'push'])
  notification_type: NotificationType;

  @IsString()
  user_id: string;

  @IsString()
  template_id: string;

  @IsString()
  language: string;

  @IsObject()
  variables: Record<string, any>;

  @IsNumber()
  priority: number;

  @IsString()
  created_at: string;

  @IsNumber()
  retry_count: number;

  @IsString()
  user_email?: string;
}

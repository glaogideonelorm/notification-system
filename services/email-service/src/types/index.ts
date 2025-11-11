export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message: string;
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  page: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export enum NotificationType {
  EMAIL = 'email',
  PUSH = 'push',
}

export interface UserData {
  name: string;
  link: string;
  meta?: Record<string, any>;
}

export interface QueueMessage {
  notification_id: string;
  notification_type: NotificationType;
  user_id: string;
  user_email: string;
  template_code: string;
  language: string;
  variables: UserData;
  priority: number;
  request_id: string;
  metadata?: Record<string, any>;
  created_at: string;
  retry_count: number;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: {
    email: string;
    name: string;
  };
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  fromEmail: string;
  fromName: string;
}

export interface EmailSentInfo {
  messageId: string;
  response?: string;
  accepted?: string[];
  rejected?: string[];
}

export enum NotificationStatus {
  DELIVERED = 'delivered',
  PENDING = 'pending',
  FAILED = 'failed',
}

export interface User {
  id: string;
  name: string;
  email: string;
  push_token?: string;
  preferences: UserPreference;
  password?: string;
  created_at: string;
  updated_at: string;
}

export interface UserPreference {
  email: boolean;
  push: boolean;
}

export interface Template {
  id: string;
  code: string;
  name: string;
  templates: {
    [language: string]: {
      subject?: string;
      title?: string;
      body: string;
    };
  };
  variables: string[];
  created_at: string;
  updated_at: string;
}

import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  provider: process.env.EMAIL_PROVIDER,

  // SendGrid
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL,
    fromName: process.env.SENDGRID_FROM_NAME || 'Notification System',
  },

  // SMTP
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT!),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    fromEmail: process.env.SMTP_FROM_EMAIL,
    fromName: process.env.SMTP_FROM_NAME || 'Notification System',
  },

  // Retry config
  maxRetries: parseInt(process.env.MAX_RETRIES!),
  retryDelay: parseInt(process.env.RETRY_DELAY_MS!),

  // Circuit breaker
  circuitBreaker: {
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT!),

    errorThresholdPercentage: parseInt(
      process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD!,
    ),

    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT!),
  },
}));

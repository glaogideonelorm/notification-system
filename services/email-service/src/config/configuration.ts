import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Service
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  SERVICE_NAME: Joi.string().default('email-service'),

  // RabbitMQ
  RABBITMQ_HOST: Joi.string().default('localhost'),
  RABBITMQ_PORT: Joi.number().default(5672),
  RABBITMQ_USER: Joi.string().default('guest'),
  RABBITMQ_PASSWORD: Joi.string().default('guest'),
  RABBITMQ_EMAIL_QUEUE: Joi.string().default('email.queue'),
  RABBITMQ_FAILED_QUEUE: Joi.string().default('failed.queue'),

  // Email Provider
  EMAIL_PROVIDER: Joi.string().valid('sendgrid', 'smtp').default('sendgrid'),

  // SendGrid
  SENDGRID_API_KEY: Joi.string().allow('', null),
  SENDGRID_FROM_EMAIL: Joi.string().email().allow('', null),
  SENDGRID_FROM_NAME: Joi.string().allow('', null),

  // SMTP
  SMTP_HOST: Joi.string().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('', null),
  SMTP_PASSWORD: Joi.string().allow('', null),
  SMTP_FROM_EMAIL: Joi.string().allow('', null),
  SMTP_FROM_NAME: Joi.string().allow('', null),

  // Template Service
  TEMPLATE_SERVICE_URL: Joi.string().uri().default('http://localhost:3004'),

  // API Gateway Service
  API_GATEWAY_URL: Joi.string().uri().default('http://localhost:3000'),

  // Retry / Circuit Breaker
  MAX_RETRIES: Joi.number().default(5),
  RETRY_DELAY_MS: Joi.number().default(1000),
  CIRCUIT_BREAKER_TIMEOUT: Joi.number().default(3000),
  CIRCUIT_BREAKER_ERROR_THRESHOLD: Joi.number().default(50),
  CIRCUIT_BREAKER_RESET_TIMEOUT: Joi.number().default(30000),
});

export const configuration = () => ({
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  serviceName: process.env.SERVICE_NAME ?? 'email-service',
});

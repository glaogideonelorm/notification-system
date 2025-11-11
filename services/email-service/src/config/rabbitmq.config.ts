import { registerAs } from '@nestjs/config';

export default registerAs('rabbitmq', () => ({
  host: process.env.RABBITMQ_HOST || 'localhost',
  port: parseInt(process.env.RABBITMQ_PORT!),
  username: process.env.RABBITMQ_USER || 'guest',
  password: process.env.RABBITMQ_PASSWORD || 'guest',
  emailQueue: process.env.RABBITMQ_EMAIL_QUEUE || 'email.queue',
  failedQueue: process.env.RABBITMQ_FAILED_QUEUE || 'failed.queue',
}));

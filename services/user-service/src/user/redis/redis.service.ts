import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (redisUrl) {
      // Use the full Redis URL (Railway style)
      this.redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('Redis connection failed after 3 retries');
            return null; // Stop retrying
          }
          return Math.min(times * 50, 2000);
        },
      });
      this.logger.log('Redis connected via URL');
    } else {
      // Fallback to host/port (for local development)
      this.redisClient = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 50, 2000);
        },
      });
      this.logger.log('Redis connected via host/port');
    }

    this.redisClient.on('error', (err) => {
      this.logger.error('Redis Client Error', err);
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Redis Client Connected');
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redisClient.get(key);
    } catch (error) {
      this.logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttl: number): Promise<'OK' | null> {
    try {
      return await this.redisClient.set(key, value, 'EX', ttl);
    } catch (error) {
      this.logger.error(`Redis SET error for key ${key}:`, error);
      return null;
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.redisClient.del(key);
    } catch (error) {
      this.logger.error(`Redis DEL error for key ${key}:`, error);
      return 0;
    }
  }
}

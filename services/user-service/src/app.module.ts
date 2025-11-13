import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { URL } from 'url';
import { randomUUID } from 'crypto';
(global as any).crypto = { randomUUID };

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');

        console.log(
          `[DB Config Check] Value read for DATABASE_URL: ${databaseUrl}`,
        );

        if (!databaseUrl || databaseUrl === 'undefined') {
          throw new Error(
            'DATABASE_URL environment variable is missing or invalid.',
          );
        }
        const url = new URL(databaseUrl);

        const port = parseInt(url.port) || 5432;

        return {
          type: 'postgres',
          host: url.hostname,
          port: port,
          username: url.username,
          password: url.password,
          database: url.pathname.slice(1),
          autoLoadEntities: true,
          synchronize: true,
          // IMPORTANT: SSL required for cloud DBs like Render
          // ssl: {
          //   rejectUnauthorized: false,
          // },
        };
      },
    }),

    UserModule,
  ],
})
export class AppModule {}

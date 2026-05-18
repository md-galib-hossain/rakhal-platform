import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/user/user.module';
import { PrismaModule } from './core/database/prisma/prisma.module';
import { ConfigModule, ConfigType } from '@nestjs/config';
import {
  appConfig,
  authConfig,
  databaseConfig,
  redisConfig,
} from 'src/core/config/env';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { RedisModule } from 'src/core/redis/redis.module';
import { RequestContextMiddleware } from 'src/common/middleware/request-context.middleware';
import { LoggerMiddleware } from 'src/core/logger/logger/logger.middleware';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from 'src/common/filters/global-exception.filter';

type JwtDuration = `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, authConfig, databaseConfig, redisConfig],
      expandVariables: true,
      cache: true,
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule.forFeature(authConfig)],
      inject: [authConfig.KEY],
      useFactory: (config: ConfigType<typeof authConfig>) => ({
        secret: config.accessSecret,
        signOptions: {
          expiresIn: config.accessExpiresIn as JwtDuration,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule.forFeature(authConfig)],
      inject: [authConfig.KEY],
      useFactory: (config: ConfigType<typeof authConfig>) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.rateLimit.ttlSeconds * 1000,
            limit: config.rateLimit.maxRequests,
          },
          {
            name: 'login',
            ttl: config.rateLimit.login.ttlSeconds * 1000,
            limit: config.rateLimit.login.maxRequests,
          },
          {
            name: 'refresh',
            ttl: config.rateLimit.refresh.ttlSeconds * 1000,
            limit: config.rateLimit.refresh.maxRequests,
          },
        ],
      }),
    }),
    UsersModule,
    AuthModule,
    PrismaModule,
    LoggerModule,
    RedisModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        RequestContextMiddleware, // runs first: generates & stamps IDs
        LoggerMiddleware, // runs second: reads IDs, sets async context
      )
      // ✅ Correct wildcard for NestJS v10+
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

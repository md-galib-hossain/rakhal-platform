import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { PermissionModule } from './modules/permission/permission.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { TenantAccessModule } from './modules/tenant-access/tenant-access.module';
import { UsersModule } from './modules/user/user.module';
import { PrismaModule } from './core/database/prisma/prisma.module';
import { ConfigModule, ConfigType } from '@nestjs/config';
import {
  appConfig,
  authConfig,
  databaseConfig,
  emailConfig,
  redisConfig,
  sentryConfig,
} from 'src/core/config/env';
import { DomainEventsModule } from 'src/common/events/domain-events.module';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { RedisModule } from 'src/core/redis/redis.module';
import { CacheModule } from 'src/core/cache/cache.module';
import { RequestContextMiddleware } from 'src/common/middleware/request-context.middleware';
import { LoggerMiddleware } from 'src/core/logger/logger/logger.middleware';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from 'src/common/filters/global-exception.filter';
import { ResponseEnvelopeInterceptor } from 'src/common/interceptors/response-envelope.interceptor';
import { EmailModule } from './modules/email/email.module';
import { SentryModule } from './core/observability/sentry/sentry.module';
import { HealthController } from 'src/common/presentation/controllers/health.controller';
import { MetricsModule } from './core/observability/metrics/metrics.module';
import { CattleModule } from './modules/cattle/cattle.module';
import { ReproductionModule } from './modules/reproduction/reproduction.module';
import { HealthModule } from './modules/health/health.module';
import { CalfModule } from './modules/calf/calf.module';
import { MilkModule } from './modules/milk/milk.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { FarmModule } from './modules/farm/farm.module';
import { ActivityModule } from './modules/activity/activity.module';
import { TaskModule } from './modules/task/task.module';

type JwtDuration = `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        redisConfig,
        emailConfig,
        sentryConfig,
      ],
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
    ScheduleModule.forRoot(),
    UsersModule,
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    SubscriptionModule,
    AuditModule,
    PrismaModule,
    LoggerModule,
    RedisModule,
    CacheModule,
    DomainEventsModule,
    EmailModule,
    SentryModule,
    MetricsModule,
    CattleModule,
    ReproductionModule,
    HealthModule,
    CalfModule,
    MilkModule,
    InventoryModule,
    FarmModule,
    ActivityModule,
    TaskModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
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

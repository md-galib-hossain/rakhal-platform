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
  telegramConfig,
} from 'src/core/config/env';
import { DomainEventsModule } from 'src/common/events/domain-events.module';
import { I18nModule } from 'src/common/i18n/i18n.module';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { RedisModule } from 'src/core/redis/redis.module';
import { ThrottlerStorageModule } from 'src/core/throttler/throttler-storage.module';
import { RedisThrottlerStorage } from 'src/core/throttler/redis-throttler.storage';
import { RakhalThrottlerGuard } from 'src/core/throttler/rakhal-throttler.guard';
import { CacheModule } from 'src/core/cache/cache.module';
import { RequestContextMiddleware } from 'src/common/middleware/request-context.middleware';
import { LoggerMiddleware } from 'src/core/logger/logger/logger.middleware';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { BuyerModule } from './modules/buyer/buyer.module';
import { FinanceModule } from './modules/finance/finance.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FeedModule } from './modules/feed/feed.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { FarmModule } from './modules/farm/farm.module';
import { ActivityModule } from './modules/activity/activity.module';
import { TaskModule } from './modules/task/task.module';
import { SettingsModule } from './modules/settings/settings.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { ScoreboardModule } from './modules/scoreboard/scoreboard.module';
import { NotificationModule } from './modules/notification/notification.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { BillingModule } from './modules/billing/billing.module';
import { AdminModule } from './modules/admin/admin.module';
import { OtpModule } from './modules/otp/otp.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { MediaModule } from './modules/media/media.module';
import { SupportModule } from './modules/support/support.module';
import { SearchModule } from './modules/search/search.module';

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
        telegramConfig,
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
    // Every registered throttler runs on EVERY guarded request — a named
    // throttler is not *selected* by `@Throttle({ name: ... })`, that only
    // overrides its numbers for that handler. So the set below is deliberately
    // two entries that are both meant to apply everywhere. (The previous
    // `login`/`refresh` entries silently capped unrelated routes at 5/min.)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule.forFeature(authConfig), ThrottlerStorageModule],
      inject: [authConfig.KEY, RedisThrottlerStorage],
      useFactory: (
        config: ConfigType<typeof authConfig>,
        storage: RedisThrottlerStorage,
      ) => ({
        // Shared across processes — PM2 workers must not each keep their own
        // counter (that multiplies every limit by the worker count).
        storage,
        throttlers: [
          {
            // The aggregate DoS ceiling. `generateKey` drops the class/handler
            // so one identity gets ONE budget across the whole API, not a
            // fresh one per endpoint.
            name: 'global',
            ttl: config.rateLimit.ttlSeconds * 1000,
            limit: config.rateLimit.globalMaxRequests,
            generateKey: (_ctx, tracker) => `g:${tracker}`,
          },
          {
            // Per-endpoint fairness; per-route overrides live in
            // src/common/decorators/throttle-tiers.ts.
            name: 'default',
            ttl: config.rateLimit.ttlSeconds * 1000,
            limit: config.rateLimit.maxRequests,
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
    I18nModule,
    EmailModule,
    SentryModule,
    MetricsModule,
    CattleModule,
    ReproductionModule,
    HealthModule,
    CalfModule,
    MilkModule,
    BuyerModule,
    FinanceModule,
    DashboardModule,
    ReportsModule,
    FeedModule,
    InventoryModule,
    FarmModule,
    SettingsModule,
    OnboardingModule,
    ScoreboardModule,
    NotificationModule,
    SchedulerModule,
    BillingModule,
    AdminModule,
    OtpModule,
    ComplianceModule,
    MediaModule,
    SupportModule,
    SearchModule,
    ActivityModule,
    TaskModule,
  ],
  controllers: [HealthController],
  providers: [
    // Rate limiting for EVERY route. Runs ahead of the per-route guard chain
    // (JwtAuthGuard → SessionGuard → FarmContextGuard → PermissionGuard), which
    // is the point: SessionGuard hits Redis and FarmContextGuard hits Postgres,
    // so a flood has to be rejected before it reaches them.
    //
    // `useExisting`, not `useClass` — the guard must stay addressable under its
    // own token or `Test.overrideProvider(RakhalThrottlerGuard)` in the e2e
    // harness silently fails to intercept it.
    RakhalThrottlerGuard,
    {
      provide: APP_GUARD,
      useExisting: RakhalThrottlerGuard,
    },
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

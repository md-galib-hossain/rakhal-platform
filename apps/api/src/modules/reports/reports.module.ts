import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { redisConfig } from 'src/core/config/env';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MediaModule } from '../media/media.module';
import { FarmSettingsModule } from '../farm-settings/farm-settings.module';
import { ReportGeneratorsService } from './application/services/report-generators.service';
import { ReportsService } from './application/services/reports.service';
import { ReportScheduleService } from './application/services/report-schedule.service';
import { ReportsQueueService } from './infrastructure/queue/reports-queue.service';
import { ReportsProcessor } from './infrastructure/queue/reports.processor';
import { REPORTS_QUEUE } from './infrastructure/queue/reports.queue.constants';
import { ReportScheduleRunner } from './infrastructure/cron/report-schedule.runner';
import { ReportCleanupRunner } from './infrastructure/cron/report-cleanup.runner';
import { ReportsController } from './presentation/controllers/reports.controller';

/**
 * Reports module (PRD §22 / API §15). Report generation aggregates the
 * already-built modules' tables directly via Prisma (Dashboard pattern), so it
 * needs no cross-module service imports (and creates no cycles), except
 * `MediaModule` for the shared `OBJECT_STORAGE` (R2) seam (RD-013b) and
 * `FarmSettingsModule` (RAKHAL-288, same precedent `DashboardModule` already
 * set) for the Herd Lactation Dashboard's configurable stage thresholds.
 * Generation
 * itself runs off a BullMQ queue (RD-013a) via `ReportsProcessor`; scheduled
 * reports (RD-013c) fire from `ReportScheduleRunner`'s hourly cron, and expired
 * output is purged by `ReportCleanupRunner`'s hourly cron (RD-013b) onto/from
 * the same queue/store.
 */
@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    SubscriptionModule,
    MediaModule,
    FarmSettingsModule,
    ConfigModule.forFeature(redisConfig),
    BullModule.forRootAsync({
      imports: [ConfigModule.forFeature(redisConfig)],
      inject: [redisConfig.KEY],
      useFactory: (config: ConfigType<typeof redisConfig>) => ({
        // e2e runs share Redis with a developer's running backend; without a separate key prefix
        // that backend's worker steals the job and writes the file into *its* in-memory storage,
        // so the test process 500s on download ("Object not found").
        prefix: process.env.NODE_ENV === 'test' ? 'bull-test' : undefined,
        connection: {
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          db: config.database,
          tls: config.tlsEnabled ? {} : undefined,
          connectTimeout: config.connectTimeoutMs,
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({ name: REPORTS_QUEUE }),
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportGeneratorsService,
    ReportScheduleService,
    ReportsQueueService,
    ReportsProcessor,
    ReportScheduleRunner,
    ReportCleanupRunner,
  ],
  exports: [ReportsService, ReportScheduleService],
})
export class ReportsModule {}

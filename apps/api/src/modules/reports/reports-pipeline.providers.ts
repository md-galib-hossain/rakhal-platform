import { BullModule } from '@nestjs/bullmq';
import type { DynamicModule, Provider, Type } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { redisConfig } from 'src/core/config/env';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { FarmSettingsModule } from '../farm-settings/farm-settings.module';
import { MediaModule } from '../media/media.module';
import { ReportComputeService } from './application/pipeline/report-compute.service';
import { ReportGenerationService } from './application/pipeline/report-generation.service';
import { ReportLifecycleService } from './application/pipeline/report-lifecycle.service';
import { REPORTS_QUEUE } from './application/pipeline/report-pipeline.constants';
import {
  REPORT_JOB_ENSURER,
  ReportReconcileService,
} from './application/pipeline/report-reconcile.service';
import { REPORT_COMPUTE, REPORT_QUEUE } from './application/ports/report-ports';
import { REPORT_RENDERER_PROVIDERS } from './infrastructure/renderer';
import { REPORT_SCHEDULER_PROVIDERS } from './infrastructure/cron';
import { ReportQueueService } from './infrastructure/queue/report-queue.service';
import { ReportsProcessor } from './infrastructure/queue/reports.processor';

/**
 * Owned by RPT-09. RPT-08's ReportsModule spreads `REPORT_PIPELINE_IMPORTS` into `imports` and
 * `REPORT_PIPELINE_PROVIDERS` into `providers`, and re-exports whatever it needs.
 *
 * A second `BullModule.forRootAsync` root is the repo pattern (email + outbox each have one); same redis
 * config, and `bull-test` prefix under NODE_ENV=test so e2e never touches a developer's live queue.
 * `MediaModule` supplies `OBJECT_STORAGE`; `FarmSettingsModule` supplies the farm's real thresholds.
 * `REPORT_RENDERER` is bound by RPT-11's `REPORT_RENDERER_PROVIDERS` (PDF); RPT-10's scheduler providers are spread here too.
 */
export const REPORT_PIPELINE_IMPORTS: Array<DynamicModule | Type<unknown>> = [
  ConfigModule.forFeature(redisConfig),
  BullModule.forRootAsync({
    imports: [ConfigModule.forFeature(redisConfig)],
    inject: [redisConfig.KEY],
    useFactory: (config: ConfigType<typeof redisConfig>) => ({
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
  LoggerModule,
  FarmSettingsModule,
  MediaModule,
];

export const REPORT_PIPELINE_PROVIDERS: Provider[] = [
  ReportComputeService,
  ReportLifecycleService,
  ReportGenerationService,
  ReportReconcileService,
  ReportQueueService,
  ReportsProcessor,
  { provide: REPORT_COMPUTE, useExisting: ReportComputeService },
  { provide: REPORT_QUEUE, useExisting: ReportQueueService },
  { provide: REPORT_JOB_ENSURER, useExisting: ReportQueueService },
  ...REPORT_RENDERER_PROVIDERS,
  ...REPORT_SCHEDULER_PROVIDERS,
];

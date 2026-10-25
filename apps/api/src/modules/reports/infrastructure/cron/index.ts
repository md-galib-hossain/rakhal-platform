import type { DynamicModule, Provider, Type } from '@nestjs/common';
import { ReportRetentionService } from '../../application/scheduling/report-retention.service';
import { ReportScheduleService } from '../../application/scheduling/report-schedule.service';
import { PgAdvisoryJobLock, REPORT_JOB_LOCK } from './report-job-lock';
import { ReportSchedulerCron } from './report-scheduler.cron';

export * from './report-job-lock';
export * from './report-scheduler.cron';

/**
 * RPT-10 wiring, spread into ReportsModule by the orchestrator. Needs from the host module: PrismaService and
 * FarmTime (global), LoggerModule, SubscriptionModule (SubscriptionAccessService), MediaModule (OBJECT_STORAGE)
 * and the pipeline providers (REPORT_QUEUE, ReportReconcileService). All already imported by ReportsModule.
 */
export const REPORT_SCHEDULER_IMPORTS: Array<DynamicModule | Type<unknown>> =
  [];

export const REPORT_SCHEDULER_PROVIDERS: Provider[] = [
  ReportScheduleService,
  ReportRetentionService,
  PgAdvisoryJobLock,
  { provide: REPORT_JOB_LOCK, useExisting: PgAdvisoryJobLock },
  ReportSchedulerCron,
];

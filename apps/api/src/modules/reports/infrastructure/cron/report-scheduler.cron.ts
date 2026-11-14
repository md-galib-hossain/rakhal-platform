import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ReportReconcileService } from '../../application/pipeline/report-reconcile.service';
import { REPORT_CRON } from '../../application/scheduling/scheduling.constants';
import { ReportRetentionService } from '../../application/scheduling/report-retention.service';
import { ReportScheduleService } from '../../application/scheduling/report-schedule.service';
import { REPORT_JOB_LOCK, type ReportJobLock } from './report-job-lock';

/**
 * Named crons for Reports v2 (RPT-10). Bodies live in services; this class only adds the schedule, the
 * cross-instance lock, and the "never throw out of a cron" guarantee. Disabled under NODE_ENV=test so an e2e
 * run never sweeps the shared dev DB on its own; tests call the services (or `run`) directly.
 *
 * Runtime assumptions (see report-job-lock.ts): Postgres `idle_in_transaction_session_timeout` must exempt
 * the app role or be 0 (each job parks a lock transaction for up to 30 min); pool max defaults to 10 and
 * three parked lock connections is the worst case.
 */
@Injectable()
export class ReportSchedulerCron implements OnModuleInit {
  private readonly log: LoggerService;

  constructor(
    private readonly schedule: ReportScheduleService,
    private readonly reconcileService: ReportReconcileService,
    private readonly retention: ReportRetentionService,
    @Inject(REPORT_JOB_LOCK) private readonly lock: ReportJobLock,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReportSchedulerCron.name);
  }

  onModuleInit(): void {
    // NODE_ENV=test without a jest worker means the real app was started in test mode: crons are silent no-ops.
    if (process.env.NODE_ENV === 'test' && !process.env.JEST_WORKER_ID) {
      this.log.warn(
        'Report crons are DISABLED: NODE_ENV=test (scheduled sweep, reconcile and retention will not run)',
        {},
      );
    }
  }

  @Cron('5 * * * *', { name: REPORT_CRON.SCHEDULE_SWEEP })
  async scheduleSweep(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    await this.run(REPORT_CRON.SCHEDULE_SWEEP, () =>
      this.schedule.sweep(new Date()),
    );
  }

  @Cron('*/5 * * * *', { name: REPORT_CRON.RECONCILE })
  async reconcile(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    await this.run(REPORT_CRON.RECONCILE, () =>
      this.reconcileService.reconcile(new Date()),
    );
  }

  @Cron('35 * * * *', { name: REPORT_CRON.RETENTION })
  async retentionCleanup(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    await this.run(REPORT_CRON.RETENTION, () =>
      this.retention.cleanup(new Date()),
    );
  }

  /**
   * Runs `fn` under the job's advisory lock. Never throws. Returns true when this instance ran the job
   * (even if it failed), false when another instance held the lock.
   */
  async run(jobName: string, fn: () => Promise<object>): Promise<boolean> {
    try {
      const outcome = await this.lock.runExclusive(jobName, async () => {
        try {
          return { ok: true as const, counts: await fn() };
        } catch (err) {
          this.log.error('Report cron job failed', err, { job: jobName });
          return { ok: false as const };
        }
      });
      if (!outcome.acquired) {
        this.log.info('Report cron skipped: lock held elsewhere', {
          job: jobName,
        });
        return false;
      }
      return true;
    } catch (err) {
      this.log.error('Report cron lock failure', err, { job: jobName });
      return false;
    }
  }
}

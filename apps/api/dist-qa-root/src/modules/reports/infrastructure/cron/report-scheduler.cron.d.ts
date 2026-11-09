import { type OnModuleInit } from '@nestjs/common';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ReportReconcileService } from '../../application/pipeline/report-reconcile.service';
import { ReportRetentionService } from '../../application/scheduling/report-retention.service';
import { ReportScheduleService } from '../../application/scheduling/report-schedule.service';
import { type ReportJobLock } from './report-job-lock';
export declare class ReportSchedulerCron implements OnModuleInit {
    private readonly schedule;
    private readonly reconcileService;
    private readonly retention;
    private readonly lock;
    private readonly log;
    constructor(schedule: ReportScheduleService, reconcileService: ReportReconcileService, retention: ReportRetentionService, lock: ReportJobLock, logger: LoggerService);
    onModuleInit(): void;
    scheduleSweep(): Promise<void>;
    reconcile(): Promise<void>;
    retentionCleanup(): Promise<void>;
    run(jobName: string, fn: () => Promise<object>): Promise<boolean>;
}

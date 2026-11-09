import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { SubscriptionAccessService } from '../../../subscription/application/services/subscription-access.service';
import { ReportLifecycleService } from '../pipeline/report-lifecycle.service';
import { type ReportQueue } from '../ports/report-ports';
export declare const SCHEDULED_MAX_AUTO_RETRIES = 2;
export interface ScheduleSweepResult {
    farms: number;
    created: number;
    alreadyExists: number;
    deferred: number;
    skippedNotEntitled: number;
    missed: number;
    retriedFailed: number;
    failedExhausted: number;
    errors: number;
}
export interface ScheduleSweepOptions {
    farmIds?: string[];
}
export declare class ReportScheduleService {
    private readonly prisma;
    private readonly access;
    private readonly queue;
    private readonly lifecycle;
    private readonly log;
    constructor(prisma: PrismaService, access: SubscriptionAccessService, queue: ReportQueue, lifecycle: ReportLifecycleService, logger: LoggerService);
    sweep(now: Date, options?: ScheduleSweepOptions): Promise<ScheduleSweepResult>;
    private sweepFarm;
    private hasUnsubmittedMilk;
    private createRow;
    private loadTemplates;
}

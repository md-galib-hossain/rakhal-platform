import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
export declare const REPORT_JOB_ENSURER: unique symbol;
export interface ReportJobEnsurer {
    ensureJob(reportId: string): Promise<boolean>;
}
export declare class ReportReconcileService {
    private readonly prisma;
    private readonly jobs;
    private readonly log;
    constructor(prisma: PrismaService, jobs: ReportJobEnsurer, logger: LoggerService);
    reconcile(now: Date): Promise<{
        requeued: number;
        failed: number;
    }>;
}

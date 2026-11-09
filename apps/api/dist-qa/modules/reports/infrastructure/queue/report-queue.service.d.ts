import { Queue } from 'bullmq';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import type { ReportQueue } from '../../application/ports/report-ports';
import type { ReportJobEnsurer } from '../../application/pipeline/report-reconcile.service';
export interface ReportJobData {
    reportId: string;
}
export declare class ReportQueueService implements ReportQueue, ReportJobEnsurer {
    private readonly queue;
    private readonly prisma;
    private readonly log;
    constructor(queue: Queue<ReportJobData>, prisma: PrismaService, logger: LoggerService);
    static jobIdFor(reportId: string, manualRetries: number): string;
    enqueue(reportId: string): Promise<void>;
    ensureJob(reportId: string): Promise<boolean>;
}

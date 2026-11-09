import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { ObjectStoragePort } from 'src/modules/media/application/ports/object-storage.port';
import type { ReportErrorCategory } from '../../domain/contracts/enums';
import type { ReportPeriod } from '../../domain/contracts/period';
import { type ReportComputeService, type ReportRenderer } from '../ports/report-ports';
import { ReportLifecycleService } from './report-lifecycle.service';
export type ProcessOutcome = {
    status: 'skipped';
} | {
    status: 'completed';
} | {
    status: 'delayed';
    delayMs: number;
} | {
    status: 'retry';
    category: ReportErrorCategory;
} | {
    status: 'failed';
    category: ReportErrorCategory;
};
export interface AttemptInfo {
    attemptsMade: number;
    maxAttempts: number;
}
export declare function periodFromRow(row: {
    periodStart: Date;
    periodEnd: Date;
    periodStartDate: string;
    periodEndDate: string;
    timezone: string;
}): ReportPeriod;
export declare class ReportGenerationService {
    private readonly prisma;
    private readonly lifecycle;
    private readonly compute;
    private readonly renderer;
    private readonly storage;
    private readonly log;
    constructor(prisma: PrismaService, lifecycle: ReportLifecycleService, compute: ReportComputeService, renderer: ReportRenderer, storage: ObjectStoragePort, logger: LoggerService);
    process(reportId: string, attempt: AttemptInfo): Promise<ProcessOutcome>;
    private isDeleted;
    private run;
    private discardArtifact;
    private persistSnapshot;
    private metricIds;
    private handleFailure;
}

import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { ReportErrorCategory } from '../../domain/contracts/enums';
export type ClaimResult = {
    claimed: true;
    token: Date;
} | {
    claimed: false;
    retryAfterMs: number | null;
};
export interface ArtifactInfo {
    key: string;
    bytes: number;
    contentType: string;
}
export declare class ReportLifecycleService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    claim(reportId: string, now: Date): Promise<ClaimResult>;
    markCompleted(reportId: string, token: Date, completedAt: Date, expiresAt: Date, artifact: ArtifactInfo | null): Promise<boolean>;
    markRetryable(reportId: string, token: Date, category: ReportErrorCategory): Promise<boolean>;
    markFailed(reportId: string, token: Date, category: ReportErrorCategory, now: Date): Promise<boolean>;
    resetForRetry(reportId: string, farmId: string, maxManualRetries?: number): Promise<boolean>;
    retentionDays(farmId: string): Promise<number>;
}

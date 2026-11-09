import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { type ObjectStoragePort } from '../../../media/application/ports/object-storage.port';
export interface RetentionCleanupResult {
    considered: number;
    deleted: number;
    tombstoned: number;
    storageFailures: number;
    rowFailures: number;
}
export declare class ReportRetentionService {
    private readonly prisma;
    private readonly storage;
    private readonly log;
    constructor(prisma: PrismaService, storage: ObjectStoragePort, logger: LoggerService);
    cleanup(now: Date, options?: {
        batchSize?: number;
        maxBatches?: number;
        farmIds?: string[];
    }): Promise<RetentionCleanupResult>;
}

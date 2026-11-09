import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { OutboxDrainResult } from '../domain/outbox-types';
import { OutboxHandlerRegistryService } from './outbox-handler-registry.service';
export declare const OUTBOX_DEFAULT_BATCH_SIZE = 25;
export declare const OUTBOX_MAX_ATTEMPTS = 5;
export declare class OutboxDrainService {
    private readonly prisma;
    private readonly handlers;
    private readonly log;
    constructor(prisma: PrismaService, handlers: OutboxHandlerRegistryService, logger: LoggerService);
    drainBatch(batchSize?: number, maxAttempts?: number): Promise<OutboxDrainResult>;
}

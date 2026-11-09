import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { OutboxDrainService } from '../../application/outbox-drain.service';
export declare class OutboxProcessor extends WorkerHost {
    private readonly drainService;
    private readonly log;
    constructor(drainService: OutboxDrainService, logger: LoggerService);
    process(job: Job): Promise<void>;
}

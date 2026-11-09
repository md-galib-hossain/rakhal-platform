import { OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export declare class OutboxQueueService implements OnModuleInit {
    private readonly queue;
    private readonly log;
    constructor(queue: Queue, logger: LoggerService);
    onModuleInit(): Promise<void>;
    triggerNow(): Promise<void>;
}

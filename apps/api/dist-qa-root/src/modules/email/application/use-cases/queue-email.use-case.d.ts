import { Queue } from 'bullmq';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { QueueEmailDto } from '../dto/queue-email.dto';
import type { EmailRepository } from 'src/modules/email/domain/repositories/email.repository';
export declare class QueueEmailUseCase {
    private readonly queue;
    private readonly repository;
    private readonly log;
    constructor(queue: Queue, repository: EmailRepository, logger: LoggerService);
    execute(input: QueueEmailDto): Promise<void>;
}

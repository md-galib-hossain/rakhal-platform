import { QueueEmailDto } from '../dto/queue-email.dto';
import { QueueEmailUseCase } from '../use-cases/queue-email.use-case';
export declare class EmailService {
    private readonly queueEmailUseCase;
    constructor(queueEmailUseCase: QueueEmailUseCase);
    queue(input: Omit<QueueEmailDto, 'emailId'>): Promise<string>;
}

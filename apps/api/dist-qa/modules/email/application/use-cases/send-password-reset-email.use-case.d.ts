import type { ConfigType } from '@nestjs/config';
import { emailConfig } from 'src/core/config/env';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { QueueEmailUseCase } from './queue-email.use-case';
export declare class SendPasswordResetEmailUseCase {
    private readonly config;
    private readonly queueEmailUseCase;
    private readonly log;
    constructor(config: ConfigType<typeof emailConfig>, queueEmailUseCase: QueueEmailUseCase, logger: LoggerService);
    execute(input: {
        userId: string;
        email: string;
        name: string;
        token: string;
        tenantId: string;
        farmId: string | null;
        correlationId?: string;
    }): Promise<void>;
}

import type { ConfigType } from '@nestjs/config';
import { emailConfig } from 'src/core/config/env';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import type { EmailVerificationTokenPort } from 'src/modules/auth/application/ports/email-verification-token.port';
import { QueueEmailUseCase } from './queue-email.use-case';
export declare class SendVerificationEmailUseCase {
    private readonly config;
    private readonly emailVerificationTokenPort;
    private readonly queueEmailUseCase;
    private readonly log;
    constructor(config: ConfigType<typeof emailConfig>, emailVerificationTokenPort: EmailVerificationTokenPort, queueEmailUseCase: QueueEmailUseCase, logger: LoggerService);
    execute(input: {
        userId: string;
        email: string;
        name: string;
        tenantId: string;
        farmId: string | null;
        correlationId?: string;
    }): Promise<void>;
}

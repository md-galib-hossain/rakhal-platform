import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { emailConfig } from 'src/core/config/env';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { EmailTemplate } from '../../domain/enums/email-template.enum';
import { QueueEmailUseCase } from './queue-email.use-case';

@Injectable()
export class SendPasswordResetEmailUseCase {
  private readonly log: LoggerService;

  constructor(
    @Inject(emailConfig.KEY)
    private readonly config: ConfigType<typeof emailConfig>,
    private readonly queueEmailUseCase: QueueEmailUseCase,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(SendPasswordResetEmailUseCase.name);
  }

  async execute(input: {
    userId: string;
    email: string;
    name: string;
    token: string;
    tenantId: string;
    farmId: string | null;
    correlationId?: string;
  }): Promise<void> {
    const emailId = randomUUID();
    const resetLink = `${this.config.passwordResetBaseUrl}?token=${input.token}`;

    await this.queueEmailUseCase.execute({
      emailId,
      to: input.email,
      subject: 'Reset your password',
      template: EmailTemplate.PASSWORD_RESET,
      templateData: {
        name: input.name,
        resetLink,
      },
      tenantId: input.tenantId,
      farmId: input.farmId,
      userId: input.userId,
      correlationId: input.correlationId,
    });

    this.log.audit('email.password_reset.sent', {
      emailId,
      userId: input.userId,
      tenantId: input.tenantId,
      farmId: input.farmId,
      correlationId: input.correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}

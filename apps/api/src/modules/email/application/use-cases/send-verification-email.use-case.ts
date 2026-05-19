import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { TokenType } from '@prisma/client';
import { emailConfig } from 'src/core/config/env';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AuthRepository } from 'src/modules/auth/repositories/auth.repository';
import { EmailTemplate } from '../../domain/enums/email-template.enum';
import { QueueEmailUseCase } from './queue-email.use-case';

@Injectable()
export class SendVerificationEmailUseCase {
  private readonly log: LoggerService;

  constructor(
    @Inject(emailConfig.KEY)
    private readonly config: ConfigType<typeof emailConfig>,
    private readonly authRepository: AuthRepository,
    private readonly queueEmailUseCase: QueueEmailUseCase,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(SendVerificationEmailUseCase.name);
  }

  async execute(input: {
    userId: string;
    email: string;
    name: string;
    tenantId: string;
    farmId: string | null;
    correlationId?: string;
  }): Promise<void> {
    const verificationToken =
      randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    await this.authRepository.createEmailVerificationToken({
      userId: input.userId,
      token: verificationToken,
      expiresAt: new Date(
        Date.now() + this.config.verificationTokenTtlMinutes * 60 * 1000,
      ),
    });

    const verificationLink = `${this.config.verificationBaseUrl}?token=${verificationToken}`;
    const emailId = randomUUID();

    await this.queueEmailUseCase.execute({
      emailId,
      to: input.email,
      subject: 'Verify your email address',
      template: EmailTemplate.EMAIL_VERIFICATION,
      templateData: {
        name: input.name,
        verificationLink,
      },
      tenantId: input.tenantId,
      farmId: input.farmId,
      userId: input.userId,
      correlationId: input.correlationId,
    });

    this.log.audit('email.verification.sent', {
      emailId,
      userId: input.userId,
      tenantId: input.tenantId,
      farmId: input.farmId,
      correlationId: input.correlationId,
      timestamp: new Date().toISOString(),
      tokenType: TokenType.EMAIL_VERIFICATION,
    });
  }
}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DomainEventBusService } from 'src/common/events/domain-event-bus.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import {
  PASSWORD_RESET_REQUESTED_EVENT,
  PasswordResetRequestedEvent,
} from 'src/modules/auth/domain/events/password-reset-requested.event';
import { SendPasswordResetEmailUseCase } from '../../application/use-cases/send-password-reset-email.use-case';

@Injectable()
export class PasswordResetRequestedListener
  implements OnModuleInit, OnModuleDestroy
{
  private readonly log: LoggerService;

  constructor(
    private readonly eventBus: DomainEventBusService,
    private readonly sendPasswordResetEmail: SendPasswordResetEmailUseCase,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(PasswordResetRequestedListener.name);
  }

  onModuleInit(): void {
    this.eventBus.on<PasswordResetRequestedEvent>(
      PASSWORD_RESET_REQUESTED_EVENT,
      this.handlePasswordResetRequested,
    );
  }

  onModuleDestroy(): void {
    this.eventBus.off<PasswordResetRequestedEvent>(
      PASSWORD_RESET_REQUESTED_EVENT,
      this.handlePasswordResetRequested,
    );
  }

  private handlePasswordResetRequested = async (
    event: PasswordResetRequestedEvent,
  ): Promise<void> => {
    await this.sendPasswordResetEmail.execute({
      userId: event.userId,
      email: event.email,
      name: event.name,
      token: event.token,
      tenantId: event.tenantId,
      farmId: event.farmId,
      correlationId: event.correlationId,
    });

    this.log.info('Password reset email queued', {
      userId: event.userId,
      tenantId: event.tenantId,
      farmId: event.farmId,
      correlationId: event.correlationId,
      timestamp: new Date().toISOString(),
    });
  };
}

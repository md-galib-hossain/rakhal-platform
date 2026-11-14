import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DomainEventBusService } from 'src/common/events/domain-event-bus.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import {
  USER_REGISTERED_EVENT,
  UserRegisteredEvent,
} from 'src/modules/auth/domain/events/user-registered.event';
import { SendVerificationEmailUseCase } from '../../application/use-cases/send-verification-email.use-case';

@Injectable()
export class UserRegisteredListener implements OnModuleInit, OnModuleDestroy {
  private readonly log: LoggerService;

  constructor(
    private readonly eventBus: DomainEventBusService,
    private readonly sendVerificationEmail: SendVerificationEmailUseCase,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(UserRegisteredListener.name);
  }

  onModuleInit(): void {
    this.eventBus.on<UserRegisteredEvent>(
      USER_REGISTERED_EVENT,
      this.handleUserRegistered,
    );
  }

  onModuleDestroy(): void {
    this.eventBus.off<UserRegisteredEvent>(
      USER_REGISTERED_EVENT,
      this.handleUserRegistered,
    );
  }

  private handleUserRegistered = async (
    event: UserRegisteredEvent,
  ): Promise<void> => {
    await this.sendVerificationEmail.execute({
      userId: event.userId,
      email: event.email,
      name: event.name,
      tenantId: event.tenantId,
      farmId: event.farmId,
      correlationId: event.correlationId,
    });

    this.log.info('Verification email sent', {
      emailId: null,
      userId: event.userId,
      tenantId: event.tenantId,
      farmId: event.farmId,
      correlationId: event.correlationId,
      timestamp: new Date().toISOString(),
    });
  };
}

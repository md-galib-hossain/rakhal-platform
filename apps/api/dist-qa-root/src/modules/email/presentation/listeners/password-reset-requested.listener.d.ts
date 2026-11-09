import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DomainEventBusService } from 'src/common/events/domain-event-bus.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { SendPasswordResetEmailUseCase } from '../../application/use-cases/send-password-reset-email.use-case';
export declare class PasswordResetRequestedListener implements OnModuleInit, OnModuleDestroy {
    private readonly eventBus;
    private readonly sendPasswordResetEmail;
    private readonly log;
    constructor(eventBus: DomainEventBusService, sendPasswordResetEmail: SendPasswordResetEmailUseCase, logger: LoggerService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private handlePasswordResetRequested;
}

import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DomainEventBusService } from 'src/common/events/domain-event-bus.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { SendVerificationEmailUseCase } from '../../application/use-cases/send-verification-email.use-case';
export declare class UserRegisteredListener implements OnModuleInit, OnModuleDestroy {
    private readonly eventBus;
    private readonly sendVerificationEmail;
    private readonly log;
    constructor(eventBus: DomainEventBusService, sendVerificationEmail: SendVerificationEmailUseCase, logger: LoggerService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private handleUserRegistered;
}

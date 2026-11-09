import { OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from 'src/core/logger/logger/logger.service';
type EventListener<TPayload> = (payload: TPayload) => Promise<void> | void;
export declare class DomainEventBusService implements OnModuleDestroy {
    private readonly emitter;
    private readonly log;
    private readonly safeListeners;
    constructor(logger: LoggerService);
    emit<TPayload>(event: string, payload: TPayload): void;
    on<TPayload>(event: string, listener: EventListener<TPayload>): void;
    off<TPayload>(event: string, listener: EventListener<TPayload>): void;
    onModuleDestroy(): void;
}
export {};

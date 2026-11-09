import { LoggerService } from 'src/core/logger/logger/logger.service';
import { DomainEventBusService } from 'src/common/events/domain-event-bus.service';
import { OutboxEventHandler } from '../domain/outbox-types';
export declare class OutboxHandlerRegistryService {
    private readonly eventBus;
    private readonly handlers;
    private readonly log;
    constructor(eventBus: DomainEventBusService, logger: LoggerService);
    register(eventType: string, handler: OutboxEventHandler): void;
    dispatch(eventType: string, payload: Record<string, unknown>): Promise<void>;
}

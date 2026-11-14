import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { DomainEventBusService } from 'src/common/events/domain-event-bus.service';
import { OutboxEventHandler } from '../domain/outbox-types';

/**
 * Where the outbox drainer sends a claimed event. Deliberately minimal per
 * RAKHAL-332's own scope note ("this ticket is about the durability
 * primitive, not about wiring every consumer"): a module can `register()` a
 * real handler for its `eventType`; anything without one falls back to the
 * existing in-memory `DomainEventBusService`, kept for non-critical fan-out
 * only (`FINANCE_V2_DESIGN.md` §5.1).
 *
 * The distinction that matters: `DomainEventBus.emit` deliberately never
 * throws back to its caller (a listener failure must not crash the process).
 * A registered outbox handler is the opposite on purpose — the drainer
 * *needs* the throw, to know a delivery attempt failed and retry/dead-letter
 * it. Never route a registered handler's error into `DomainEventBus`.
 */
@Injectable()
export class OutboxHandlerRegistryService {
  private readonly handlers = new Map<string, OutboxEventHandler>();
  private readonly log: LoggerService;

  constructor(
    private readonly eventBus: DomainEventBusService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(OutboxHandlerRegistryService.name);
  }

  /** Register the handler for one `eventType`. Last registration wins (surfaced via a warn log, not silently). */
  register(eventType: string, handler: OutboxEventHandler): void {
    if (this.handlers.has(eventType)) {
      this.log.warn('Overwriting existing outbox handler', { eventType });
    }
    this.handlers.set(eventType, handler);
  }

  /**
   * Dispatch one claimed event. Throws on failure — the drainer is
   * responsible for catching, recording `lastError`, and deciding
   * retry vs. dead-letter.
   */
  async dispatch(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const handler = this.handlers.get(eventType);
    if (handler) {
      await handler(payload);
      return;
    }
    // No registered consumer yet — best-effort notify via the non-throwing
    // bus rather than fail the whole event (nothing depends on this path yet).
    this.eventBus.emit(eventType, payload);
  }
}

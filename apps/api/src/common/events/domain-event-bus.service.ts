import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import { LoggerService } from 'src/core/logger/logger/logger.service';

type EventListener<TPayload> = (payload: TPayload) => Promise<void> | void;

/**
 * A listener that throws (sync or via a rejected promise) must never reach the
 * shared EventEmitter — Node treats both an uncaught exception from a sync emit
 * and an unhandled rejection from a fire-and-forget async handler as fatal,
 * killing the whole process for every in-flight request, not just the emitter's.
 * Mirrors SmsProvider's "a send must never throw into the caller" rule (RD-034).
 */
@Injectable()
export class DomainEventBusService implements OnModuleDestroy {
  private readonly emitter = new EventEmitter();
  private readonly log: LoggerService;
  private readonly safeListeners = new WeakMap<
    EventListener<unknown>,
    (payload: unknown) => void
  >();

  constructor(logger: LoggerService) {
    this.log = logger.setContext(DomainEventBusService.name);
  }

  emit<TPayload>(event: string, payload: TPayload): void {
    this.emitter.emit(event, payload);
  }

  on<TPayload>(event: string, listener: EventListener<TPayload>): void {
    const safeListener = (payload: TPayload): void => {
      try {
        const result = listener(payload);
        if (result && typeof result.then === 'function') {
          result.catch((error: unknown) => {
            this.log.error(`Listener for "${event}" rejected`, error);
          });
        }
      } catch (error) {
        this.log.error(`Listener for "${event}" threw`, error);
      }
    };

    this.safeListeners.set(
      listener as EventListener<unknown>,
      safeListener as (payload: unknown) => void,
    );
    this.emitter.on(event, safeListener);
  }

  off<TPayload>(event: string, listener: EventListener<TPayload>): void {
    const safeListener = this.safeListeners.get(
      listener as EventListener<unknown>,
    );
    if (!safeListener) return;

    this.emitter.off(event, safeListener);
    this.safeListeners.delete(listener as EventListener<unknown>);
  }

  onModuleDestroy(): void {
    this.emitter.removeAllListeners();
  }
}

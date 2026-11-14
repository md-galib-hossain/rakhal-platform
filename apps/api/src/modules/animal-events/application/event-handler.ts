import { Injectable } from '@nestjs/common';
import { AnimalEventTypeKey } from '../domain/catalogue';

export interface HandlerInput {
  farmId: string;
  userId: string;
  cattleId: string;
  eventAt: Date;
  notes?: string;
  provenance: 'RECORDED' | 'HISTORICAL';
  /** Type-specific fields, validated by the handler against its own DTO. */
  payload: Record<string, unknown>;
}

export interface HandlerResult {
  /** The `AnimalEvent` header the detail write produced (set by the DB trigger). */
  animalEventId?: string | null;
  /** The detail row, returned to the client as `detail`. */
  detail: unknown;
  /** Extra info stored on the header's `data` (e.g. a history AI's cost). */
  headerData?: Record<string, unknown>;
}

export interface VoidInput {
  farmId: string;
  userId: string;
  cattleId: string;
  /** The AnimalEvent header id (also the detail row's `animalEventId`). */
  animalEventId: string;
  reason: string;
}

/** One per domain; delegates to the EXISTING domain services (RAKHAL-481). */
export interface EventHandler {
  handle(type: AnimalEventTypeKey, input: HandlerInput): Promise<HandlerResult>;
  /**
   * RAKHAL-488: reverse the detail row's side effects (finance, stock, linked
   * records) with the domain's own void. Returns false when the domain has no
   * void for this type (the header is still voided).
   */
  voidEvent?(type: AnimalEventTypeKey, input: VoidInput): Promise<boolean>;
  /** Extra WARN finding codes to add before saving (dry run and real run). */
  findingsFor?(
    type: AnimalEventTypeKey,
    input: Pick<HandlerInput, 'cattleId' | 'payload'>,
  ): Promise<string[]>;
}

/**
 * Holds the handler for each event type. Domain modules register their
 * handlers on init, so `animal-events` never imports a domain module.
 */
@Injectable()
export class EventHandlerRegistry {
  private readonly handlers = new Map<string, EventHandler>();

  private readonly recompute: Array<
    (farmId: string, cattleId: string) => Promise<void>
  > = [];

  /** RAKHAL-488: domains register how to re-derive their stored state after an edit or void. */
  onChange(fn: (farmId: string, cattleId: string) => Promise<void>): void {
    this.recompute.push(fn);
  }

  async recomputeAll(farmId: string, cattleId: string): Promise<void> {
    for (const fn of this.recompute) await fn(farmId, cattleId);
  }

  register(types: AnimalEventTypeKey[], handler: EventHandler): void {
    for (const type of types) {
      if (this.handlers.has(type)) {
        throw new Error(`Event handler already registered: ${type}`);
      }
      this.handlers.set(type, handler);
    }
  }

  get(type: string): EventHandler | undefined {
    return this.handlers.get(type);
  }
}

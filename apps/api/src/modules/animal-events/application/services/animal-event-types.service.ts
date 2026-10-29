import { Inject, Injectable } from '@nestjs/common';
import { EventTypeDefinition } from '../../domain/catalogue';
import { EventRegistry } from '../../domain/event-registry';

export const EVENT_REGISTRY = Symbol('EVENT_REGISTRY');

/**
 * Serves the event-type catalogue (RAKHAL-478). Today this is the code
 * catalogue as-is; farm custom types (RAKHAL-486) and follow-up rule toggles
 * (RAKHAL-484) will be merged in here later.
 */
@Injectable()
export class AnimalEventTypesService {
  constructor(
    @Inject(EVENT_REGISTRY) private readonly registry: EventRegistry,
  ) {}

  list(): EventTypeDefinition[] {
    return this.registry.all();
  }
}

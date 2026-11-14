import { EVENT_CATALOGUE, EventTypeDefinition } from './catalogue';

/**
 * RAKHAL-478: registry of event type definitions. Pure and framework-free.
 * Later tickets (RAKHAL-481 dispatcher) attach handlers; this core only holds
 * definitions and refuses duplicate types, so two modules cannot silently
 * claim the same type.
 */
export class EventRegistry {
  private readonly defs = new Map<string, EventTypeDefinition>();

  register(def: EventTypeDefinition): void {
    if (this.defs.has(def.type)) {
      throw new Error(`Event type already registered: ${def.type}`);
    }
    this.defs.set(def.type, def);
  }

  get(type: string): EventTypeDefinition | undefined {
    return this.defs.get(type);
  }

  all(): EventTypeDefinition[] {
    return [...this.defs.values()];
  }

  /** A registry pre-loaded with the code catalogue. */
  static withCatalogue(): EventRegistry {
    const registry = new EventRegistry();
    for (const def of EVENT_CATALOGUE) registry.register(def);
    return registry;
  }
}

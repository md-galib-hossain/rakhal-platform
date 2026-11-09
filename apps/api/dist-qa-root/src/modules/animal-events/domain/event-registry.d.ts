import { EventTypeDefinition } from './catalogue';
export declare class EventRegistry {
    private readonly defs;
    register(def: EventTypeDefinition): void;
    get(type: string): EventTypeDefinition | undefined;
    all(): EventTypeDefinition[];
    static withCatalogue(): EventRegistry;
}

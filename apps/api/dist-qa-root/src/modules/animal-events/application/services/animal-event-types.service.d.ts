import { EventTypeDefinition } from '../../domain/catalogue';
import { EventRegistry } from '../../domain/event-registry';
import { CustomEventTypeService } from './custom-event-type.service';
export declare const EVENT_REGISTRY: unique symbol;
export declare class AnimalEventTypesService {
    private readonly registry;
    private readonly customTypes;
    constructor(registry: EventRegistry, customTypes: CustomEventTypeService);
    list(farmId: string): Promise<EventTypeDefinition[]>;
}

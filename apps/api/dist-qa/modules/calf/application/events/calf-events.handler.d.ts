import { OnModuleInit } from '@nestjs/common';
import { EventHandler, EventHandlerRegistry, HandlerInput, HandlerResult } from 'src/modules/animal-events/application/event-handler';
import { AnimalEventTypeKey } from 'src/modules/animal-events/domain/catalogue';
import { CalfService } from '../services/calf.service';
export declare class CalfEventHandler implements EventHandler, OnModuleInit {
    private readonly calves;
    private readonly registry;
    constructor(calves: CalfService, registry: EventHandlerRegistry);
    onModuleInit(): void;
    handle(_type: AnimalEventTypeKey, i: HandlerInput): Promise<HandlerResult>;
}

import { OnModuleInit } from '@nestjs/common';
import { EventHandler, EventHandlerRegistry, HandlerInput, HandlerResult } from 'src/modules/animal-events/application/event-handler';
import { AnimalEventTypeKey } from 'src/modules/animal-events/domain/catalogue';
import { BcsService } from '../services/bcs.service';
import { WeightService } from '../services/weight.service';
export declare class CattleEventHandler implements EventHandler, OnModuleInit {
    private readonly weights;
    private readonly bcs;
    private readonly registry;
    constructor(weights: WeightService, bcs: BcsService, registry: EventHandlerRegistry);
    onModuleInit(): void;
    handle(type: AnimalEventTypeKey, i: HandlerInput): Promise<HandlerResult>;
}

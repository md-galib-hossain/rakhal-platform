import { OnModuleInit } from '@nestjs/common';
import { EventHandler, EventHandlerRegistry, HandlerInput, HandlerResult, VoidInput } from 'src/modules/animal-events/application/event-handler';
import { AnimalEventTypeKey } from 'src/modules/animal-events/domain/catalogue';
import { ReproductionService } from '../services/reproduction.service';
import { ReproductionEditService } from '../services/reproduction-edit.service';
import { ReproductionDerivationService } from '../services/reproduction-derivation.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
export declare class ReproductionEventHandler implements EventHandler, OnModuleInit {
    private readonly repro;
    private readonly registry;
    private readonly edits;
    private readonly derivation;
    private readonly prisma;
    constructor(repro: ReproductionService, registry: EventHandlerRegistry, edits: ReproductionEditService, derivation: ReproductionDerivationService, prisma: PrismaService);
    onModuleInit(): void;
    voidEvent(type: AnimalEventTypeKey, i: VoidInput): Promise<boolean>;
    handle(type: AnimalEventTypeKey, i: HandlerInput): Promise<HandlerResult>;
}

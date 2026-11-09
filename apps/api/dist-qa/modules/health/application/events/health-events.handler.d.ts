import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { EventHandler, EventHandlerRegistry, HandlerInput, HandlerResult, VoidInput } from 'src/modules/animal-events/application/event-handler';
import { AnimalEventTypeKey } from 'src/modules/animal-events/domain/catalogue';
import { HealthService } from '../services/health.service';
export declare class HealthEventHandler implements EventHandler, OnModuleInit {
    private readonly health;
    private readonly prisma;
    private readonly registry;
    constructor(health: HealthService, prisma: PrismaService, registry: EventHandlerRegistry);
    onModuleInit(): void;
    private openCase;
    voidEvent(type: AnimalEventTypeKey, i: VoidInput): Promise<boolean>;
    findingsFor(type: AnimalEventTypeKey, i: Pick<HandlerInput, 'cattleId' | 'payload'>): Promise<string[]>;
    handle(type: AnimalEventTypeKey, i: HandlerInput): Promise<HandlerResult>;
}

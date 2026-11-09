import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { EventRegistry } from '../../domain/event-registry';
import { RecordEventDto } from '../../presentation/dto/record-event.dto';
import { EventHandlerRegistry } from '../event-handler';
import { FollowUpService } from './follow-up.service';
import { CustomEventTypeService } from './custom-event-type.service';
import { EligibilityService } from './eligibility.service';
export interface RecordEventOptions {
    dryRun?: boolean;
    idempotencyKey?: string;
    batchId?: string;
    taskSink?: string[];
}
export declare class AnimalEventWriteService {
    private readonly prisma;
    private readonly eligibility;
    private readonly handlers;
    private readonly registry;
    private readonly followUps;
    private readonly customTypes;
    constructor(prisma: PrismaService, eligibility: EligibilityService, handlers: EventHandlerRegistry, registry: EventRegistry, followUps: FollowUpService, customTypes: CustomEventTypeService);
    record(farmId: string, userId: string, cattleId: string, dto: RecordEventDto, opts?: RecordEventOptions): Promise<Record<string, unknown>>;
    private save;
    private ruleEvent;
    private genericData;
    private meta;
    private withIdempotency;
}

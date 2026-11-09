import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { EventRegistry } from '../../domain/event-registry';
import { ListCattleEventsDto } from '../../presentation/dto/list-cattle-events.dto';
export declare class TimelineService {
    private readonly prisma;
    private readonly registry;
    constructor(prisma: PrismaService, registry: EventRegistry);
    list(farmId: string, cattleId: string, query: ListCattleEventsDto): Promise<{
        items: {
            detail: {} | null;
            type: import("@prisma/client").$Enums.AnimalEventType;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            data: Prisma.JsonValue | null;
            status: import("@prisma/client").$Enums.EventStatus;
            cattleId: string;
            notes: string | null;
            voidedAt: Date | null;
            customTypeId: string | null;
            eventAt: Date;
            dateApprox: boolean;
            provenance: import("@prisma/client").$Enums.EventProvenance;
            voidedById: string | null;
            voidReason: string | null;
            findings: Prisma.JsonValue | null;
            batchId: string | null;
            sourceEventId: string | null;
            recordedById: string;
        }[];
        meta: {
            count: number;
            limit: number;
            hasNextPage: boolean;
            endCursor: string | null;
        };
    }>;
    private page;
    private loadDetails;
}

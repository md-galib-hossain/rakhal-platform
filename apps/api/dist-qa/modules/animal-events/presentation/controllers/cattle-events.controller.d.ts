import type { Request } from 'express';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { EventRegistry } from '../../domain/event-registry';
import { AnimalEventWriteService } from '../../application/services/animal-event-write.service';
import { TimelineService } from '../../application/services/timeline.service';
import { EligibilityService } from '../../application/services/eligibility.service';
import { AnimalEventEditService } from '../../application/services/animal-event-edit.service';
import { EditEventDto, VoidEventDto } from '../dto/edit-event.dto';
import { RecordEventDto } from '../dto/record-event.dto';
import { EligibleEventsDto, ListCattleEventsDto } from '../dto/list-cattle-events.dto';
export declare class CattleEventsController {
    private readonly timeline;
    private readonly eligibility;
    private readonly writer;
    private readonly permissions;
    private readonly edits;
    private readonly registry;
    constructor(timeline: TimelineService, eligibility: EligibilityService, writer: AnimalEventWriteService, permissions: PermissionService, edits: AnimalEventEditService, registry: EventRegistry);
    record(req: Request & {
        auth: {
            user: {
                permissionsVersion: number;
            };
        };
    }, farmId: string, userId: string, id: string, dryRun: string | undefined, idempotencyKey: string | undefined, dto: RecordEventDto): Promise<Record<string, unknown>>;
    editEvent(req: Request & {
        auth: {
            user: {
                permissionsVersion: number;
            };
        };
    }, farmId: string, userId: string, id: string, eventId: string, dto: EditEventDto): Promise<{
        event: {
            type: import("@prisma/client").$Enums.AnimalEventType;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            data: import("@prisma/client/runtime/client").JsonValue | null;
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
            findings: import("@prisma/client/runtime/client").JsonValue | null;
            batchId: string | null;
            sourceEventId: string | null;
            recordedById: string;
        };
    }>;
    voidEvent(req: Request & {
        auth: {
            user: {
                permissionsVersion: number;
            };
        };
    }, farmId: string, userId: string, id: string, eventId: string, dto: VoidEventDto): Promise<{
        event: {
            type: import("@prisma/client").$Enums.AnimalEventType;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            data: import("@prisma/client/runtime/client").JsonValue | null;
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
            findings: import("@prisma/client/runtime/client").JsonValue | null;
            batchId: string | null;
            sourceEventId: string | null;
            recordedById: string;
        };
        detailReversed: boolean;
    }>;
    eligible(farmId: string, id: string, query: EligibleEventsDto): Promise<{
        categories: ("CALF" | "MALE" | "FEMALE" | "MILKING" | "DRY" | "HEIFER" | "COW" | "PREGNANT" | "OPEN" | "FATTENING" | "ALL" | "WEANED" | "FRESH")[];
        types: import("../../domain/eligibility/evaluate").EligibilityResult[];
    }>;
    list(farmId: string, id: string, query: ListCattleEventsDto): Promise<{
        items: {
            detail: {} | null;
            type: import("@prisma/client").$Enums.AnimalEventType;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            data: import("@prisma/client/runtime/client").JsonValue | null;
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
            findings: import("@prisma/client/runtime/client").JsonValue | null;
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
}

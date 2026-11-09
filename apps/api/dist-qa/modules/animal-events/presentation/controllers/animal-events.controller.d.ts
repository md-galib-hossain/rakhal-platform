import type { Request } from 'express';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { EventRegistry } from '../../domain/event-registry';
import { BulkEventService } from '../../application/services/bulk-event.service';
import { BulkEventDto } from '../dto/bulk-event.dto';
import { AnimalEventTypesService } from '../../application/services/animal-event-types.service';
export declare class AnimalEventsController {
    private readonly types;
    private readonly bulkEvents;
    private readonly permissions;
    private readonly registry;
    constructor(types: AnimalEventTypesService, bulkEvents: BulkEventService, permissions: PermissionService, registry: EventRegistry);
    bulk(req: Request & {
        auth: {
            user: {
                permissionsVersion: number;
            };
        };
    }, farmId: string, userId: string, dryRun: string | undefined, dto: BulkEventDto): Promise<{
        dryRun: boolean;
        batchId: null;
        type: "MOVE" | "SOLD" | "CULLED" | "BREEDING" | "HEAT" | "PREG_CHECK" | "CALVING" | "ABORTION" | "DRY_OFF" | "ILLNESS" | "TREATMENT" | "VACCINATION" | "DEWORMING" | "WEIGHT" | "BCS" | "WEANING" | "CASTRATION" | "ENTER_FATTENING" | "LEAVE_FATTENING" | "DIED" | "NOTE" | "HOOF_TRIM" | "DEHORN" | "CUSTOM";
        eventAt: Date;
        mode: "skipIneligible" | "allOrNothing";
        requested: number;
        saved: number;
        skipped: number;
        results: import("../../application/services/bulk-event.service").BulkRow[];
    } | {
        dryRun: boolean;
        batchId: string;
        type: "MOVE" | "SOLD" | "CULLED" | "BREEDING" | "HEAT" | "PREG_CHECK" | "CALVING" | "ABORTION" | "DRY_OFF" | "ILLNESS" | "TREATMENT" | "VACCINATION" | "DEWORMING" | "WEIGHT" | "BCS" | "WEANING" | "CASTRATION" | "ENTER_FATTENING" | "LEAVE_FATTENING" | "DIED" | "NOTE" | "HOOF_TRIM" | "DEHORN" | "CUSTOM";
        eventAt: Date;
        mode: "skipIneligible" | "allOrNothing";
        requested: number;
        saved: number;
        skipped: number;
        results: import("../../application/services/bulk-event.service").BulkRow[];
    }>;
    listTypes(farmId: string): Promise<import("../../domain/catalogue").EventTypeDefinition[]>;
}

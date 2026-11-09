import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { NotificationScheduler } from 'src/modules/notification/application/services/notification-scheduler.service';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { EventRegistry } from '../../domain/event-registry';
import { EventHandlerRegistry } from '../event-handler';
import { FollowUpService } from './follow-up.service';
export declare const AUTHOR_WINDOW_MS: number;
export interface EditEventInput {
    eventAt?: string;
    notes?: string | null;
    reason?: string;
}
export interface Actor {
    userId: string;
    permissionsVersion: number;
}
export declare class AnimalEventEditService {
    private readonly prisma;
    private readonly handlers;
    private readonly followUps;
    private readonly permissions;
    private readonly activity;
    private readonly registry;
    private readonly scheduler;
    constructor(prisma: PrismaService, handlers: EventHandlerRegistry, followUps: FollowUpService, permissions: PermissionService, activity: ActivityLogService, registry: EventRegistry, scheduler: NotificationScheduler, logger: LoggerService);
    private readonly log;
    private reanchor;
    private load;
    private authorize;
    void(farmId: string, actor: Actor, cattleId: string, eventId: string, reason: string): Promise<{
        event: {
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
        };
        detailReversed: boolean;
    }>;
    edit(farmId: string, actor: Actor, cattleId: string, eventId: string, input: EditEventInput): Promise<{
        event: {
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
        };
    }>;
    private ruleEventFor;
    private audit;
}

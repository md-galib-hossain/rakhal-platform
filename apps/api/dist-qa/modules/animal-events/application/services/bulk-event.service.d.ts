import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import { EventRegistry } from '../../domain/event-registry';
import type { EventFinding } from '../../domain/findings';
import { BulkEventDto } from '../../presentation/dto/bulk-event.dto';
import { TaskNotificationProducer } from 'src/modules/task/application/resolvers/task-notification.producer';
import { AnimalEventWriteService } from './animal-event-write.service';
export type BulkRowStatus = 'CREATED' | 'ELIGIBLE' | 'SKIPPED' | 'BLOCKED';
export interface BulkRow {
    cattleId: string;
    tagNumber: string;
    status: BulkRowStatus;
    eventId?: string;
    reason?: string;
    findings: EventFinding[];
}
export declare class BulkEventService {
    private readonly prisma;
    private readonly writer;
    private readonly activity;
    private readonly notifications;
    private readonly taskNotifier;
    private readonly registry;
    private readonly log;
    constructor(prisma: PrismaService, writer: AnimalEventWriteService, activity: ActivityLogService, notifications: NotificationService, taskNotifier: TaskNotificationProducer, registry: EventRegistry, logger: LoggerService);
    bulk(farmId: string, userId: string, dto: BulkEventDto, opts?: {
        dryRun?: boolean;
    }): Promise<{
        dryRun: boolean;
        batchId: null;
        type: "MOVE" | "SOLD" | "CULLED" | "BREEDING" | "HEAT" | "PREG_CHECK" | "CALVING" | "ABORTION" | "DRY_OFF" | "ILLNESS" | "TREATMENT" | "VACCINATION" | "DEWORMING" | "WEIGHT" | "BCS" | "WEANING" | "CASTRATION" | "ENTER_FATTENING" | "LEAVE_FATTENING" | "DIED" | "NOTE" | "HOOF_TRIM" | "DEHORN" | "CUSTOM";
        eventAt: Date;
        mode: "skipIneligible" | "allOrNothing";
        requested: number;
        saved: number;
        skipped: number;
        results: BulkRow[];
    } | {
        dryRun: boolean;
        batchId: string;
        type: "MOVE" | "SOLD" | "CULLED" | "BREEDING" | "HEAT" | "PREG_CHECK" | "CALVING" | "ABORTION" | "DRY_OFF" | "ILLNESS" | "TREATMENT" | "VACCINATION" | "DEWORMING" | "WEIGHT" | "BCS" | "WEANING" | "CASTRATION" | "ENTER_FATTENING" | "LEAVE_FATTENING" | "DIED" | "NOTE" | "HOOF_TRIM" | "DEHORN" | "CUSTOM";
        eventAt: Date;
        mode: "skipIneligible" | "allOrNothing";
        requested: number;
        saved: number;
        skipped: number;
        results: BulkRow[];
    }>;
    private blockFindings;
    private afterCommit;
}

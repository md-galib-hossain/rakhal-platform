import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { TaskNotificationProducer } from 'src/modules/task/application/resolvers/task-notification.producer';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { FollowUpOverride, FollowUpPlanItem, RuleDefaults, RuleEvent } from '../../domain/follow-up-rules';
import type { AnimalEventTypeKey } from '../../domain/catalogue';
export interface FollowUpPreviewItem {
    ruleKey: string;
    title: string;
    dueDate: string;
    defaultOn: boolean;
    enabled: boolean;
    kind: 'TASK' | 'SUGGESTION';
}
export declare class FollowUpService {
    private readonly prisma;
    private readonly settings;
    private readonly tasks;
    private readonly notifier;
    constructor(prisma: PrismaService, settings: FarmSettingsService, tasks: TaskService, notifier: TaskNotificationProducer);
    defaults(farmId: string): Promise<RuleDefaults>;
    overrides(farmId: string): Promise<Record<string, FollowUpOverride | undefined>>;
    plan(farmId: string, event: RuleEvent, toggles?: {
        ruleKey: string;
        enabled: boolean;
    }[], now?: Date): Promise<{
        item: FollowUpPlanItem;
        enabled: boolean;
    }[]>;
    preview(farmId: string, event: RuleEvent, toggles?: {
        ruleKey: string;
        enabled: boolean;
    }[]): Promise<FollowUpPreviewItem[]>;
    onEventSaved(args: {
        farmId: string;
        userId: string;
        cattleId: string;
        eventId: string;
        event: RuleEvent;
        toggles?: {
            ruleKey: string;
            enabled: boolean;
        }[];
        taskSink?: string[];
    }): Promise<{
        created: string[];
        completed: number;
    }>;
    completeFor(cattleId: string, type: AnimalEventTypeKey, exceptEventId: string): Promise<number>;
    cancelForEvent(eventId: string, opts?: {
        keepReminders?: boolean;
    }): Promise<number>;
    moveReminders(eventId: string, newEventAt: Date): Promise<number>;
    listRules(farmId: string): Promise<{
        ruleKey: import("../../domain/follow-up-rules").FollowUpRuleKey;
        title: string;
        kind: "TASK" | "SUGGESTION";
        trigger: "MOVE" | "SOLD" | "CULLED" | "BREEDING" | "HEAT" | "PREG_CHECK" | "CALVING" | "ABORTION" | "DRY_OFF" | "ILLNESS" | "TREATMENT" | "VACCINATION" | "DEWORMING" | "WEIGHT" | "BCS" | "WEANING" | "CASTRATION" | "ENTER_FATTENING" | "LEAVE_FATTENING" | "DIED" | "NOTE" | "HOOF_TRIM" | "DEHORN" | "CUSTOM";
        enabled: boolean;
        defaultOn: boolean;
        offsetDays: number | null;
        defaultOffsetDays: number | null;
        completesOn: ("MOVE" | "SOLD" | "CULLED" | "BREEDING" | "HEAT" | "PREG_CHECK" | "CALVING" | "ABORTION" | "DRY_OFF" | "ILLNESS" | "TREATMENT" | "VACCINATION" | "DEWORMING" | "WEIGHT" | "BCS" | "WEANING" | "CASTRATION" | "ENTER_FATTENING" | "LEAVE_FATTENING" | "DIED" | "NOTE" | "HOOF_TRIM" | "DEHORN" | "CUSTOM")[];
    }[]>;
    updateRules(farmId: string, items: {
        ruleKey: string;
        enabled?: boolean;
        offsetDays?: number | null;
    }[]): Promise<{
        ruleKey: import("../../domain/follow-up-rules").FollowUpRuleKey;
        title: string;
        kind: "TASK" | "SUGGESTION";
        trigger: "MOVE" | "SOLD" | "CULLED" | "BREEDING" | "HEAT" | "PREG_CHECK" | "CALVING" | "ABORTION" | "DRY_OFF" | "ILLNESS" | "TREATMENT" | "VACCINATION" | "DEWORMING" | "WEIGHT" | "BCS" | "WEANING" | "CASTRATION" | "ENTER_FATTENING" | "LEAVE_FATTENING" | "DIED" | "NOTE" | "HOOF_TRIM" | "DEHORN" | "CUSTOM";
        enabled: boolean;
        defaultOn: boolean;
        offsetDays: number | null;
        defaultOffsetDays: number | null;
        completesOn: ("MOVE" | "SOLD" | "CULLED" | "BREEDING" | "HEAT" | "PREG_CHECK" | "CALVING" | "ABORTION" | "DRY_OFF" | "ILLNESS" | "TREATMENT" | "VACCINATION" | "DEWORMING" | "WEIGHT" | "BCS" | "WEANING" | "CASTRATION" | "ENTER_FATTENING" | "LEAVE_FATTENING" | "DIED" | "NOTE" | "HOOF_TRIM" | "DEHORN" | "CUSTOM")[];
    }[]>;
}

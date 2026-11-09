import { OnApplicationBootstrap } from '@nestjs/common';
import { NotificationSchedule } from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { MetricsService } from 'src/core/observability/metrics/metrics.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ScheduleRepeatType } from '../../domain/schedule-math';
import type { NotificationClock, Nv2Flag } from '../queue/notification-clock';
import type { ScheduleQueuePort } from '../queue/schedule-queue.port';
import { ResolverSourceType } from '../resolvers/source-resolver.port';
import { SourceResolverRegistry } from '../resolvers/source-resolver.registry';
export interface UpsertForSourceInput {
    farmId: string;
    sourceType: ResolverSourceType;
    sourceKey: string;
    anchorAt: Date;
    allDay: boolean;
    sendTime?: string;
    leadMinutes: number[];
    eventKey: string;
    category: string;
    priority: string;
    audienceHint?: {
        userIds?: string[];
        roles?: string[];
    };
}
export interface ScheduleWriteResult {
    scheduleId: string;
    toEnqueue: string[];
}
export interface ManualScheduleInput {
    title: string;
    body?: string | null;
    category?: string;
    priority?: string;
    trigger: 'DATE' | 'BEFORE_EVENT' | 'AFTER_EVENT';
    baseAnchorAt: Date;
    allDay: boolean;
    sendTime?: string;
    leadMinutes: number[];
    offsetDays?: number | null;
    anchorType?: 'ANIMAL_EVENT' | 'TASK' | 'HEALTH_STEP' | null;
    anchorId?: string | null;
    repeat?: ScheduleRepeatType;
    repeatInterval?: number | null;
    repeatEndDate?: Date | null;
    audienceMode: 'USER' | 'ROLES' | 'USERS';
    audienceUserIds?: string[];
    audienceRoles?: string[];
    animalIds?: string[];
}
export declare class NotificationScheduler implements OnApplicationBootstrap {
    private readonly prisma;
    private readonly farmClock;
    private readonly registry;
    private readonly metrics;
    private readonly queue;
    private readonly clock;
    private readonly flag;
    private readonly log;
    constructor(prisma: PrismaService, farmClock: FarmClockService, registry: SourceResolverRegistry, metrics: MetricsService, queue: ScheduleQueuePort, clock: NotificationClock, flag: Nv2Flag, logger: LoggerService);
    get enabled(): boolean;
    onApplicationBootstrap(): void;
    upsertForSource(input: UpsertForSourceInput): Promise<ScheduleWriteResult | null>;
    refreshSource(farmId: string, sourceType: ResolverSourceType, sourceKeys: string[]): Promise<void>;
    cancelForSource(farmId: string, sourceType: ResolverSourceType, sourceKey: string): Promise<void>;
    reanchor(anchorType: 'ANIMAL_EVENT' | 'TASK' | 'HEALTH_STEP', anchorId: string, newAnchorAt: Date | null): Promise<string[]>;
    createManual(farmId: string, userId: string, input: ManualScheduleInput): Promise<NotificationSchedule>;
    updateManual(farmId: string, scheduleId: string, patch: Partial<ManualScheduleInput>): Promise<NotificationSchedule>;
    pause(farmId: string, scheduleId: string): Promise<void>;
    resume(farmId: string, scheduleId: string): Promise<void>;
    cancel(farmId: string, scheduleId: string): Promise<void>;
    enqueueAfterCommit(occurrenceIds: string[]): Promise<void>;
    private addJob;
    advance(scheduleId: string): Promise<boolean>;
    reconcile(now?: Date, opts?: {
        purge?: boolean;
    }): Promise<{
        enqueued: number;
        removed: number;
        advanced: number;
        purged: number;
    }>;
    private purge;
    private seriesOf;
    private applyPlan;
    private ensureOccurrence;
    private cancelPending;
    private cancelOccurrences;
    private safeRemove;
    private getManual;
    private tzFor;
}

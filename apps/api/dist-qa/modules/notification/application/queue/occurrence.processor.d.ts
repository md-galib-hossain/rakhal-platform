import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { MetricsService } from 'src/core/observability/metrics/metrics.service';
import { SourceResolverRegistry } from '../resolvers/source-resolver.registry';
import { NotificationScheduler } from '../services/notification-scheduler.service';
import { NotificationService } from '../services/notification.service';
import type { NotificationClock } from './notification-clock';
type SkipReason = 'LATE' | 'NO_RECIPIENTS';
type CancelReason = 'PAUSED' | 'EDITED' | 'SOURCE_GONE' | 'ANIMALS_GONE';
export type FireOutcome = {
    outcome: 'ignored';
} | {
    outcome: 'fired';
    recipientCount: number;
} | {
    outcome: 'skipped';
    reason: SkipReason;
} | {
    outcome: 'cancelled';
    reason: CancelReason;
};
export declare class OccurrenceProcessor {
    private readonly prisma;
    private readonly farmClock;
    private readonly registry;
    private readonly notifications;
    private readonly scheduler;
    private readonly metrics;
    private readonly clock;
    private readonly log;
    constructor(prisma: PrismaService, farmClock: FarmClockService, registry: SourceResolverRegistry, notifications: NotificationService, scheduler: NotificationScheduler, metrics: MetricsService, clock: NotificationClock, logger: LoggerService);
    process(occurrenceId: string): Promise<FireOutcome>;
    private finishSkipped;
    private finishCancelled;
    private mark;
    private loadMembers;
}
export declare class OccurrenceWorker extends WorkerHost {
    private readonly processor;
    constructor(processor: OccurrenceProcessor);
    process(job: Job<{
        occurrenceId: string;
    }>): Promise<void>;
}
export {};

import { TaskKind } from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationScheduler } from 'src/modules/notification/application/services/notification-scheduler.service';
export interface TaskNotifyRow {
    id: string;
    kind: TaskKind;
    status: string;
    priority: string;
    safetyCritical: boolean;
    ruleKey: string | null;
    dueAt: Date;
    assignedToId: string | null;
}
export declare class TaskNotificationProducer {
    private readonly scheduler;
    private readonly prisma;
    private readonly farmClock;
    private readonly log;
    constructor(scheduler: NotificationScheduler, prisma: PrismaService, farmClock: FarmClockService, logger: LoggerService);
    get enabled(): boolean;
    keyOf(farmId: string, task: TaskNotifyRow): Promise<string | null>;
    sync(farmId: string, tasks: TaskNotifyRow[], staleKeys?: (string | null)[]): Promise<void>;
    cancelKeys(farmId: string, keys: (string | null)[]): Promise<void>;
    syncByIds(farmId: string, taskIds: string[]): Promise<void>;
    private keyWith;
    private inputFor;
    private enqueue;
    private warn;
}

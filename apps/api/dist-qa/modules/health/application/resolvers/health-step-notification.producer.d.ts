import { Prisma } from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { NotificationScheduler } from 'src/modules/notification/application/services/notification-scheduler.service';
import { HealthStepSourceResolver } from './health-step-source.resolver';
type Tx = Prisma.TransactionClient | null;
export declare class HealthStepNotificationProducer {
    private readonly prisma;
    private readonly scheduler;
    private readonly resolver;
    private readonly farmClock;
    constructor(prisma: PrismaService, scheduler: NotificationScheduler, resolver: HealthStepSourceResolver, farmClock: FarmClockService);
    get enabled(): boolean;
    syncTasks(tx: Tx, farmId: string, taskIds: string[], extraKeys?: string[]): Promise<string[] | null>;
    syncCases(tx: Tx, farmId: string, caseIds: string[], extraKeys?: string[]): Promise<string[] | null>;
    syncRound(tx: Tx, farmId: string, planApplicationId: string): Promise<string[] | null>;
    keysOfTasks(tx: Tx, farmId: string, taskIds: string[]): Promise<string[]>;
    keysOfCase(tx: Tx, farmId: string, caseId: string): Promise<string[]>;
    enqueueAfterCommit(ids: string[] | null | undefined): Promise<void>;
    private run;
    private keysForTasks;
    private keysForCase;
    private syncKeys;
}
export {};

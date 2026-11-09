import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationScheduler } from 'src/modules/notification/application/services/notification-scheduler.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
export declare const OVERDUE_MAX_DAYS = 30;
export declare class OverdueNagService {
    private readonly prisma;
    private readonly notifications;
    private readonly farmClock;
    private readonly scheduler;
    private readonly log;
    constructor(prisma: PrismaService, notifications: NotificationService, farmClock: FarmClockService, scheduler: NotificationScheduler, logger: LoggerService);
    sweepAll(now?: Date): Promise<number>;
    private notify;
    private daysOverdue;
    private group;
    private collectRuleTasks;
    private collectHealthSteps;
}

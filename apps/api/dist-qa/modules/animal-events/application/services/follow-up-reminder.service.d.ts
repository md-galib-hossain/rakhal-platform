import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import { TaskService } from 'src/modules/task/application/services/task.service';
export declare class FollowUpReminderService {
    private readonly prisma;
    private readonly notifications;
    private readonly clock;
    private readonly tasks;
    private readonly log;
    constructor(prisma: PrismaService, notifications: NotificationService, clock: FarmClockService, tasks: TaskService, logger: LoggerService);
    sweepAll(now?: Date): Promise<number>;
    private daysUntil;
    private sweepFarm;
    private cattleIdsOf;
    private recipientsOf;
    private action;
    private animalsText;
    private notify;
}

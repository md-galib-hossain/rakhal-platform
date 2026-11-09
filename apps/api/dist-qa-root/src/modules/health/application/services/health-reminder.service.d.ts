import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
export declare class HealthReminderService {
    private readonly prisma;
    private readonly notifications;
    private readonly clock;
    private readonly log;
    constructor(prisma: PrismaService, notifications: NotificationService, clock: FarmClockService, logger: LoggerService);
    sweepAll(now?: Date): Promise<number>;
    sweepFarm(farmId: string, now?: Date): Promise<number>;
    private notify;
    private planNameOf;
    private liveWhere;
}

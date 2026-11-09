import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import { HealthService } from './health.service';
export declare class HealthCycleService {
    private readonly prisma;
    private readonly health;
    private readonly farmClock;
    private readonly notifications;
    private readonly log;
    constructor(prisma: PrismaService, health: HealthService, farmClock: FarmClockService, notifications: NotificationService, logger: LoggerService);
    sweepAll(): Promise<number>;
    sweepFarm(farmId: string): Promise<number>;
    private notifyBlocked;
}

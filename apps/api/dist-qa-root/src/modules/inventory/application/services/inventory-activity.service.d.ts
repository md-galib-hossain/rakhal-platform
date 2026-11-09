import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
export declare class InventoryActivityService {
    private readonly activityLog;
    private readonly log;
    constructor(activityLog: ActivityLogService, logger: LoggerService);
    record(farmId: string, actorId: string | undefined, eventTitle: string, actionDetails: string): Promise<void>;
}

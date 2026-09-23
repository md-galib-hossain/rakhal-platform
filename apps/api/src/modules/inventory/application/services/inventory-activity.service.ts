import { Injectable } from '@nestjs/common';
import { ActivityLogModule } from '@prisma/client';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';

/**
 * Fail-safe Activity Log writer for the Inventory tabs (PRD §19). An audit-log
 * hiccup must never roll back or fail the user's already-committed inventory
 * change, so errors are logged and swallowed.
 */
@Injectable()
export class InventoryActivityService {
  private readonly log: LoggerService;

  constructor(
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(InventoryActivityService.name);
  }

  async record(
    farmId: string,
    actorId: string | undefined,
    eventTitle: string,
    actionDetails: string,
  ): Promise<void> {
    try {
      await this.activityLog.record({
        farmId,
        module: ActivityLogModule.INVENTORY,
        eventTitle,
        actionDetails,
        actorId,
      });
    } catch (err) {
      this.log.error('Inventory activity log failed', {
        farmId,
        eventTitle,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

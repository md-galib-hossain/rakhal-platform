import { ActivityLogService } from '../../application/services/activity-log.service';
import { AqrService } from '../../application/services/aqr.service';
import { ListActivityQueryDto } from '../dto/list-activity-query.dto';
export declare class ActivityController {
    private readonly activityLog;
    private readonly aqr;
    constructor(activityLog: ActivityLogService, aqr: AqrService);
    list(farmId: string, query: ListActivityQueryDto): Promise<import("../../../../common/pagination").CursorPage<unknown>>;
    herdAqr(farmId: string): Promise<{
        herdAqr: number;
    }>;
    verifyChain(farmId: string): Promise<{
        valid: boolean;
        entries: number;
        brokenAt: string | null;
    }>;
}

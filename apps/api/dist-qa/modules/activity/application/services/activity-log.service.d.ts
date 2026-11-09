import { ActivityLog, ActivityLogModule } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage } from 'src/common/pagination';
import { ListActivityQueryDto } from '../../presentation/dto/list-activity-query.dto';
export interface ActivityTaggedValue {
    key: string;
    value: string;
}
export interface RecordActivityInput {
    farmId: string;
    module: ActivityLogModule;
    eventTitle: string;
    actionDetails: string;
    actorId?: string | null;
    relatedCattleId?: string | null;
    aqrImpact?: number | null;
    financialImpact?: number | null;
    previousAqrScore?: number | null;
    taggedValues?: ActivityTaggedValue[] | null;
}
export declare class ActivityLogService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    record(input: RecordActivityInput): Promise<ActivityLog>;
    list(farmId: string, query: ListActivityQueryDto): Promise<CursorPage<unknown>>;
    verifyChain(farmId: string): Promise<{
        valid: boolean;
        entries: number;
        brokenAt: string | null;
    }>;
    private computeHash;
    private present;
}

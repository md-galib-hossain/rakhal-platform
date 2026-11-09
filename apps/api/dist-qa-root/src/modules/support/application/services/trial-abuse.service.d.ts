import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import { SubscriptionLifecycleService } from 'src/modules/subscription/application/services/subscription-lifecycle.service';
export declare class TrialAbuseService {
    private readonly prisma;
    private readonly lifecycle;
    private readonly audit;
    private readonly log;
    constructor(prisma: PrismaService, lifecycle: SubscriptionLifecycleService, audit: AuditService, logger: LoggerService);
    grantTrialIfEligible(farmId: string, ownerUserId: string): Promise<{
        granted: boolean;
    }>;
}

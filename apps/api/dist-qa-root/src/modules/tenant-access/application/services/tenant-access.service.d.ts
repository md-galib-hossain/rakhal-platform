import { CacheService } from 'src/core/cache/cache.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { VerifiedFarmContext } from 'src/modules/tenant-access/domain/verified-farm-context.type';
export declare class TenantAccessService {
    private readonly prisma;
    private readonly logger;
    private readonly cache;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, cache: CacheService);
    resolveFarmContext(userId: string, farmId: string): Promise<VerifiedFarmContext>;
}

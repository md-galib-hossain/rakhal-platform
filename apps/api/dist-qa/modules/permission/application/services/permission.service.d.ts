import { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { RedisClient } from 'src/core/redis/redis.module';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export declare class PermissionService {
    private readonly prisma;
    private readonly redis;
    private readonly logger;
    private readonly log;
    constructor(prisma: PrismaService, redis: RedisClient, logger: LoggerService);
    resolvePermissions(userId: string, farmId: string, permissionsVersion: number): Promise<string[]>;
    hasPermission(userId: string, farmId: string, permissionsVersion: number, requiredPermissions: string[]): Promise<boolean>;
    assertPermissions(userId: string, farmId: string, permissionsVersion: number, requiredPermissions: string[]): Promise<void>;
    invalidateForFarm(userId: string, farmId: string): Promise<void>;
    invalidateForUser(userId: string): Promise<void>;
    private cacheKey;
    private matchesPermission;
}

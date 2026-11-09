import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { RedisClient } from 'src/core/redis/redis.module';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export type EffectiveStatus = SubscriptionStatus | 'NONE';
export interface Entitlement {
    status: EffectiveStatus;
    planId: string | null;
    planName: string | null;
    expiresAt: string | null;
    features: string[];
    limits: {
        maxCattle: number | null;
        maxFarmMembers: number | null;
    };
}
export declare class SubscriptionAccessService {
    private readonly prisma;
    private readonly redis;
    private readonly logger;
    private readonly log;
    constructor(prisma: PrismaService, redis: RedisClient, logger: LoggerService);
    private cacheKey;
    resolveEntitlement(farmId: string): Promise<Entitlement>;
    resolveActivePlanFeatures(farmId: string): Promise<string[]>;
    assertFeatureEnabled(farmId: string, featureKey: string): Promise<void>;
    assertMemberLimit(farmId: string, limit: number | null | undefined, currentUsage: number): void;
    assertCattleLimit(farmId: string, currentActiveCount: number): Promise<void>;
    assertMemberSeatAvailable(farmId: string, currentMemberCount: number): Promise<void>;
    invalidateFarm(farmId: string): Promise<void>;
}

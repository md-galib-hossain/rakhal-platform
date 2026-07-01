import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { REDIS_CLIENT } from 'src/core/redis/redis.constants';
import type { RedisClient } from 'src/core/redis/redis.module';
import { LoggerService } from 'src/core/logger/logger/logger.service';

export type EffectiveStatus = SubscriptionStatus | 'NONE';

/**
 * The resolved entitlement blob for a farm — the single cached object that both
 * the baseline `SubscriptionGuard` (status) and the `SubscriptionFeatureGuard`
 * (features) read, so a gated request costs **one** Redis GET, not a DB join
 * (RAKHAL-218, PRD §31.3).
 */
export interface Entitlement {
  status: EffectiveStatus;
  planId: string | null;
  planName: string | null;
  /** ISO string, or null for open-ended / no subscription. */
  expiresAt: string | null;
  /** Resolved feature keys — empty unless the subscription is usable. */
  features: string[];
  limits: { maxCattle: number | null; maxFarmMembers: number | null };
}

const ENTITLEMENT_TTL_SECONDS = 300;

/** Statuses that still grant feature access (grace keeps reads working). */
const USABLE_STATUSES = new Set<SubscriptionStatus>([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
]);

const NONE_ENTITLEMENT: Entitlement = {
  status: 'NONE',
  planId: null,
  planName: null,
  expiresAt: null,
  features: [],
  limits: { maxCattle: null, maxFarmMembers: null },
};

@Injectable()
export class SubscriptionAccessService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(SubscriptionAccessService.name);
  }

  private cacheKey(farmId: string): string {
    return `auth:entitlement:${farmId}`;
  }

  /**
   * Resolve (and cache) the farm's current entitlement. O(1) on the hot path: a
   * Redis GET; only a cache miss touches Postgres. Bust with `invalidateFarm` on
   * every subscription state change (SUB-06) — stale entitlement is a defect.
   */
  async resolveEntitlement(farmId: string): Promise<Entitlement> {
    const key = this.cacheKey(farmId);

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached) as Entitlement;
      }
    } catch {
      // best effort — fall through to DB
    }

    // The current subscription is the most recently created one (renewals and
    // upgrades create new rows; expiry/cancel mutate status in place).
    const sub = await this.prisma.farmSubscription.findFirst({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
      include: {
        subscriptionPlan: {
          include: {
            features: {
              where: { enabled: true },
              include: { feature: { select: { key: true } } },
            },
          },
        },
      },
    });

    let entitlement: Entitlement;
    if (!sub) {
      entitlement = NONE_ENTITLEMENT;
    } else {
      const usable = USABLE_STATUSES.has(sub.status);
      entitlement = {
        status: sub.status,
        planId: sub.subscriptionPlanId,
        planName: sub.subscriptionPlan.name,
        expiresAt: sub.expiresAt ? sub.expiresAt.toISOString() : null,
        features: usable
          ? sub.subscriptionPlan.features.map((pf) => pf.feature.key)
          : [],
        limits: {
          maxCattle: sub.subscriptionPlan.maxCattle,
          maxFarmMembers: sub.subscriptionPlan.maxFarmMembers,
        },
      };
    }

    try {
      await this.redis.set(key, JSON.stringify(entitlement), {
        EX: ENTITLEMENT_TTL_SECONDS,
      });
    } catch {
      // best effort
    }

    return entitlement;
  }

  /** Feature keys of the farm's active plan (used by `SubscriptionFeatureGuard`). */
  async resolveActivePlanFeatures(farmId: string): Promise<string[]> {
    return (await this.resolveEntitlement(farmId)).features;
  }

  async assertFeatureEnabled(
    farmId: string,
    featureKey: string,
  ): Promise<void> {
    const features = await this.resolveActivePlanFeatures(farmId);

    if (!features.includes(featureKey)) {
      this.log.warn('Subscription feature denied', { farmId, featureKey });
      throw new ForbiddenException('Feature is not enabled');
    }
  }

  assertMemberLimit(
    farmId: string,
    limit: number | null | undefined,
    currentUsage: number,
  ): void {
    if (limit === null || limit === undefined) {
      return;
    }

    if (currentUsage > limit) {
      this.log.warn('Subscription limit exceeded', {
        farmId,
        limit,
        currentUsage,
      });
      throw new ForbiddenException('Plan limit exceeded');
    }
  }

  /**
   * Enforce the plan's herd ceiling before adding cattle (RAKHAL-219). Pass the
   * farm's current **active** cattle count; blocks when it would exceed the
   * plan's `maxCattle` (`null` = unlimited).
   */
  async assertCattleLimit(
    farmId: string,
    currentActiveCount: number,
  ): Promise<void> {
    const { limits } = await this.resolveEntitlement(farmId);
    if (limits.maxCattle !== null && currentActiveCount >= limits.maxCattle) {
      this.log.warn('Cattle limit reached', {
        farmId,
        limit: limits.maxCattle,
        current: currentActiveCount,
      });
      throw new ForbiddenException(
        `Plan limit reached: up to ${limits.maxCattle} cattle. Upgrade to add more.`,
      );
    }
  }

  /**
   * Enforce the plan's team-seat ceiling before adding a member (RAKHAL-219).
   * Pass the farm's current member count; blocks when it would exceed
   * `maxFarmMembers` (`null` = unlimited).
   */
  async assertMemberSeatAvailable(
    farmId: string,
    currentMemberCount: number,
  ): Promise<void> {
    const { limits } = await this.resolveEntitlement(farmId);
    if (
      limits.maxFarmMembers !== null &&
      currentMemberCount >= limits.maxFarmMembers
    ) {
      this.log.warn('Member seat limit reached', {
        farmId,
        limit: limits.maxFarmMembers,
        current: currentMemberCount,
      });
      throw new ForbiddenException(
        `Plan limit reached: up to ${limits.maxFarmMembers} team members. Upgrade to add more.`,
      );
    }
  }

  /** Drop the cached entitlement so the next request re-resolves from Postgres. */
  async invalidateFarm(farmId: string): Promise<void> {
    try {
      await this.redis.del(this.cacheKey(farmId));
    } catch {
      // best effort
    }
  }
}

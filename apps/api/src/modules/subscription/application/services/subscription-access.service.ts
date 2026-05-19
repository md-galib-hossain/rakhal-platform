import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { REDIS_CLIENT } from 'src/core/redis/redis.constants';
import type { RedisClient } from 'src/core/redis/redis.module';
import { LoggerService } from 'src/core/logger/logger/logger.service';

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

  async resolveActivePlanFeatures(farmId: string): Promise<string[]> {
    const cacheKey = `auth:subscription-features:${farmId}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as string[];
      }
    } catch {
      // best effort
    }

    const subscription = await this.prisma.farmSubscription.findFirst({
      where: {
        farmId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        subscriptionPlanId: true,
      },
    });

    if (!subscription) {
      return [];
    }

    const subscriptionFeatures = await this.prisma.subscriptionFeature.findMany(
      {
        where: {
          subscriptionPlanId: subscription.subscriptionPlanId,
          enabled: true,
        },
        select: {
          feature: {
            select: {
              key: true,
            },
          },
        },
      },
    );

    const features = subscriptionFeatures.map(
      (planFeature) => planFeature.feature.key,
    );

    try {
      await this.redis.set(cacheKey, JSON.stringify(features), { EX: 300 });
    } catch {
      // best effort
    }

    return features;
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

  async invalidateFarm(farmId: string): Promise<void> {
    try {
      const keys = await this.redis.keys(
        `auth:subscription-features:${farmId}`,
      );
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch {
      // best effort
    }
  }
}

import { ForbiddenException } from '@nestjs/common';
import { SubscriptionAccessService } from './subscription-access.service';

describe('SubscriptionAccessService', () => {
  let prisma: {
    farmSubscription: { findFirst: jest.Mock };
    subscriptionFeature: { findMany: jest.Mock };
  };
  let redis: {
    get: jest.Mock;
    set: jest.Mock;
    keys: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      farmSubscription: { findFirst: jest.fn() },
      subscriptionFeature: { findMany: jest.fn() },
    };
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
    };
  });

  it('resolves enabled feature keys for the active plan', async () => {
    redis.get.mockResolvedValue(null);
    prisma.farmSubscription.findFirst.mockResolvedValue({
      subscriptionPlanId: 'plan-1',
    });
    prisma.subscriptionFeature.findMany.mockResolvedValue([
      { feature: { key: 'analytics.view' } },
      { feature: { key: 'analytics.export' } },
    ]);

    const service = new SubscriptionAccessService(
      prisma as never,
      redis as never,
      { setContext: jest.fn().mockReturnThis(), warn: jest.fn() } as never,
    );

    await expect(service.resolveActivePlanFeatures('farm-1')).resolves.toEqual([
      'analytics.view',
      'analytics.export',
    ]);
    expect(redis.set).toHaveBeenCalled();
  });

  it('rejects when a feature is disabled', async () => {
    redis.get.mockResolvedValue(null);
    prisma.farmSubscription.findFirst.mockResolvedValue(null);

    const service = new SubscriptionAccessService(
      prisma as never,
      redis as never,
      { setContext: jest.fn().mockReturnThis(), warn: jest.fn() } as never,
    );

    await expect(
      service.assertFeatureEnabled('farm-1', 'analytics.view'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

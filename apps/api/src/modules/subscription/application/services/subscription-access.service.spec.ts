import { ForbiddenException } from '@nestjs/common';
import { SubscriptionAccessService } from './subscription-access.service';

describe('SubscriptionAccessService', () => {
  let prisma: { farmSubscription: { findFirst: jest.Mock } };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(() => {
    prisma = { farmSubscription: { findFirst: jest.fn() } };
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  });

  const make = () =>
    new SubscriptionAccessService(
      prisma as never,
      redis as never,
      {
        setContext: jest.fn().mockReturnThis(),
        warn: jest.fn(),
      } as never,
    );

  const planWith = (keys: string[]) => ({
    name: 'Pro',
    maxCattle: null,
    maxFarmMembers: null,
    features: keys.map((key) => ({ feature: { key } })),
  });

  it('resolves the active plan feature keys + limits and caches them', async () => {
    redis.get.mockResolvedValue(null);
    prisma.farmSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      subscriptionPlanId: 'plan-1',
      expiresAt: null,
      subscriptionPlan: planWith(['analytics.view', 'analytics.export']),
    });

    const service = make();
    const ent = await service.resolveEntitlement('farm-1');

    expect(ent.status).toBe('ACTIVE');
    expect(ent.features).toEqual(['analytics.view', 'analytics.export']);
    expect(ent.limits.maxCattle).toBeNull();
    expect(redis.set).toHaveBeenCalled();
  });

  it('serves a cached entitlement without hitting the DB', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({
        status: 'TRIALING',
        planId: 'p',
        planName: 'Starter',
        expiresAt: null,
        features: ['milk.module'],
        limits: { maxCattle: 100, maxFarmMembers: 5 },
      }),
    );

    const service = make();
    await expect(service.resolveActivePlanFeatures('farm-1')).resolves.toEqual([
      'milk.module',
    ]);
    expect(prisma.farmSubscription.findFirst).not.toHaveBeenCalled();
  });

  it('returns NONE (no features) when the farm has no subscription', async () => {
    redis.get.mockResolvedValue(null);
    prisma.farmSubscription.findFirst.mockResolvedValue(null);

    const service = make();
    const ent = await service.resolveEntitlement('farm-1');
    expect(ent.status).toBe('NONE');
    expect(ent.features).toEqual([]);
  });

  it('grants NO features once EXPIRED (even though the plan still lists them)', async () => {
    redis.get.mockResolvedValue(null);
    prisma.farmSubscription.findFirst.mockResolvedValue({
      status: 'EXPIRED',
      subscriptionPlanId: 'plan-1',
      expiresAt: new Date(),
      subscriptionPlan: planWith(['analytics.view']),
    });

    const service = make();
    await expect(service.resolveActivePlanFeatures('farm-1')).resolves.toEqual(
      [],
    );
  });

  it('assertFeatureEnabled rejects a feature the plan lacks', async () => {
    redis.get.mockResolvedValue(null);
    prisma.farmSubscription.findFirst.mockResolvedValue(null);

    const service = make();
    await expect(
      service.assertFeatureEnabled('farm-1', 'analytics.view'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  const withLimits = (maxCattle: number | null, maxMembers: number | null) => {
    redis.get.mockResolvedValue(null);
    prisma.farmSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      subscriptionPlanId: 'plan-1',
      expiresAt: null,
      subscriptionPlan: {
        name: 'Starter',
        maxCattle,
        maxFarmMembers: maxMembers,
        features: [],
      },
    });
  };

  it('assertCattleLimit blocks at/over the ceiling, allows below, skips when unlimited', async () => {
    withLimits(100, 5);
    const service = make();
    await expect(service.assertCattleLimit('f', 99)).resolves.toBeUndefined();
    await expect(service.assertCattleLimit('f', 100)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    withLimits(null, null);
    await expect(
      service.assertCattleLimit('f', 100_000),
    ).resolves.toBeUndefined();
  });

  it('assertMemberSeatAvailable blocks at/over the seat ceiling', async () => {
    withLimits(100, 5);
    const service = make();
    await expect(
      service.assertMemberSeatAvailable('f', 4),
    ).resolves.toBeUndefined();
    await expect(
      service.assertMemberSeatAvailable('f', 5),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

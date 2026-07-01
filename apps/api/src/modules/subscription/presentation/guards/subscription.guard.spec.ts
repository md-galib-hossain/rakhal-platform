import { ForbiddenException } from '@nestjs/common';
import { SubscriptionGuard } from './subscription.guard';
import type { Entitlement } from '../../application/services/subscription-access.service';

type Req = {
  method: string;
  farm?: { farmId: string };
  entitlement?: Entitlement;
};

function contextFor(req: Req) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as never;
}

function entitlement(status: Entitlement['status']): Entitlement {
  return {
    status,
    planId: null,
    planName: null,
    expiresAt: null,
    features: [],
    limits: { maxCattle: null, maxFarmMembers: null },
  };
}

function guardWith(status: Entitlement['status'], skip = false) {
  const resolveEntitlement = jest.fn().mockResolvedValue(entitlement(status));
  const reflector = { getAllAndOverride: () => skip } as never;
  const access = { resolveEntitlement } as never;
  return {
    guard: new SubscriptionGuard(reflector, access),
    resolveEntitlement,
  };
}

const farm = { farmId: 'f1' };

describe('SubscriptionGuard', () => {
  it('allows every method when ACTIVE / TRIALING', async () => {
    await expect(
      guardWith('ACTIVE').guard.canActivate(
        contextFor({ method: 'POST', farm }),
      ),
    ).resolves.toBe(true);
    await expect(
      guardWith('TRIALING').guard.canActivate(
        contextFor({ method: 'DELETE', farm }),
      ),
    ).resolves.toBe(true);
  });

  it('is read-only when PAST_DUE (GET ok, POST blocked)', async () => {
    const { guard } = guardWith('PAST_DUE');
    await expect(
      guard.canActivate(contextFor({ method: 'GET', farm })),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor({ method: 'POST', farm })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks mutations but allows reads when EXPIRED', async () => {
    const { guard } = guardWith('EXPIRED');
    await expect(
      guard.canActivate(contextFor({ method: 'PATCH', farm })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guard.canActivate(contextFor({ method: 'GET', farm })),
    ).resolves.toBe(true);
  });

  it('blocks mutations when there is no subscription', async () => {
    await expect(
      guardWith('NONE').guard.canActivate(contextFor({ method: 'POST', farm })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('bypasses the check for @SkipSubscription routes', async () => {
    const { guard, resolveEntitlement } = guardWith('EXPIRED', true);
    await expect(
      guard.canActivate(contextFor({ method: 'POST', farm })),
    ).resolves.toBe(true);
    expect(resolveEntitlement).not.toHaveBeenCalled();
  });

  it('does nothing for non-farm-scoped requests', async () => {
    const { guard, resolveEntitlement } = guardWith('EXPIRED');
    await expect(
      guard.canActivate(contextFor({ method: 'POST' })),
    ).resolves.toBe(true);
    expect(resolveEntitlement).not.toHaveBeenCalled();
  });

  it('memoizes the entitlement on the request (resolves once)', async () => {
    const { guard, resolveEntitlement } = guardWith('ACTIVE');
    const req: Req = { method: 'POST', farm };
    await guard.canActivate(contextFor(req));
    await guard.canActivate(contextFor(req));
    expect(resolveEntitlement).toHaveBeenCalledTimes(1);
    expect(req.entitlement?.status).toBe('ACTIVE');
  });
});

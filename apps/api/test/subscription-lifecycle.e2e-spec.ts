import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { SubscriptionAccessService } from '../src/modules/subscription/application/services/subscription-access.service';
import { SubscriptionLifecycleService } from '../src/modules/subscription/application/services/subscription-lifecycle.service';

/**
 * RAKHAL-218 — subscription lifecycle (`customer-api`, PRD §31.2/§31.3).
 * Proves the self-serve `GET /subscription` entitlement + trial provisioning +
 * the expiry sweep transitions (TRIALING → PAST_DUE grace → EXPIRED) with the
 * entitlement cache reflecting each change.
 */
interface SubResponse {
  status: string;
  plan_name: string | null;
  features: string[];
  limits: { max_cattle: number | null; max_farm_members: number | null };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Subscription lifecycle (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let lifecycle: SubscriptionLifecycleService;
  let access: SubscriptionAccessService;
  let tempFarmId: string | undefined;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    lifecycle = ctx.app.get(SubscriptionLifecycleService);
    access = ctx.app.get(SubscriptionAccessService);
  }, 30_000);

  afterAll(async () => {
    if (tempFarmId) {
      await prisma.farmSubscription.deleteMany({
        where: { farmId: tempFarmId },
      });
      await prisma.farm
        .delete({ where: { id: tempFarmId } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('GET /subscription returns the demo farm ACTIVE Pro entitlement', async () => {
    const owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/subscription`)
      .set(...bearer(owner))
      .expect(200);

    const data = (res.body as { data: SubResponse }).data;
    expect(data.status).toBe('ACTIVE');
    expect(data.plan_name).toBe('Pro');
    expect(data.features).toContain('reports.generate');
    expect(data.limits.max_cattle).toBeNull();
  });

  it('provisions a 14-day Starter trial, then the sweep moves it PAST_DUE → EXPIRED', async () => {
    const ownerUser = await prisma.user.findUnique({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    if (!ownerUser) throw new Error('demo owner missing — run `pnpm seed`');

    const farm = await prisma.farm.create({
      data: {
        name: 'E2E Lifecycle Farm',
        slug: `e2e-lifecycle-${Date.now()}`,
        ownerId: ownerUser.id,
      },
      select: { id: true },
    });
    tempFarmId = farm.id;

    // Trial provisioning (SUB-01).
    const trial = await lifecycle.provisionTrial(farm.id);
    expect(trial).not.toBeNull();
    let ent = await access.resolveEntitlement(farm.id);
    expect(ent.status).toBe('TRIALING');
    expect(ent.planName).toBe('Starter');
    expect(ent.features.length).toBeGreaterThan(0);

    // Expire it in the past → sweep → PAST_DUE (grace keeps features readable).
    await prisma.farmSubscription.updateMany({
      where: { farmId: farm.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await access.invalidateFarm(farm.id);
    await lifecycle.runExpirySweep();
    ent = await access.resolveEntitlement(farm.id);
    expect(ent.status).toBe('PAST_DUE');
    expect(ent.features.length).toBeGreaterThan(0);

    // Push past the 3-day grace → sweep → EXPIRED (no features).
    await prisma.farmSubscription.updateMany({
      where: { farmId: farm.id },
      data: { expiresAt: new Date(Date.now() - 4 * DAY_MS) },
    });
    await access.invalidateFarm(farm.id);
    await lifecycle.runExpirySweep();
    ent = await access.resolveEntitlement(farm.id);
    expect(ent.status).toBe('EXPIRED');
    expect(ent.features).toEqual([]);
  });
});

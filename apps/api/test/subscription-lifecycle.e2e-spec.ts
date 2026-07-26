import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { SubscriptionAccessService } from '../src/modules/subscription/application/services/subscription-access.service';
import { SubscriptionLifecycleService } from '../src/modules/subscription/application/services/subscription-lifecycle.service';
import { BillingService } from '../src/modules/billing/application/services/billing.service';
import { PLAN_NAMES } from '../src/modules/subscription/domain/subscription-features';

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
  let billing: BillingService;
  let tempFarmId: string | undefined;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    lifecycle = ctx.app.get(SubscriptionLifecycleService);
    access = ctx.app.get(SubscriptionAccessService);
    billing = ctx.app.get(BillingService);
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

    // Push past the 3-day grace → sweep → EXPIRED, then auto-downgraded to
    // Free (PRD §31.1 "then auto-downgrade to Free" — B7: never a dead end).
    await prisma.farmSubscription.updateMany({
      where: { farmId: farm.id },
      data: { expiresAt: new Date(Date.now() - 4 * DAY_MS) },
    });
    await access.invalidateFarm(farm.id);
    await lifecycle.runExpirySweep();

    const expiredRow = await prisma.farmSubscription.findFirst({
      where: { farmId: farm.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(expiredRow?.status).toBe('EXPIRED');

    ent = await access.resolveEntitlement(farm.id);
    expect(ent.status).toBe('ACTIVE');
    expect(ent.planName).toBe(PLAN_NAMES.FREE);
    expect(ent.features.length).toBeGreaterThan(0);
    expect(ent.limits.maxCattle).toBe(20);
    expect(ent.limits.maxFarmMembers).toBe(2);
  });

  it('B6: a farm with no subscription at all lands on Free via ensureUsableSubscription', async () => {
    const ownerUser = await prisma.user.findUnique({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    if (!ownerUser) throw new Error('demo owner missing — run `pnpm seed`');

    const farm = await prisma.farm.create({
      data: {
        name: 'E2E Second Farm (no trial)',
        slug: `e2e-second-farm-${Date.now()}`,
        ownerId: ownerUser.id,
      },
      select: { id: true },
    });

    try {
      // Simulates a repeat-owner farm (TrialAbuseService blocks a 2nd trial) —
      // no FarmSubscription row exists yet, so entitlement is `NONE`.
      let ent = await access.resolveEntitlement(farm.id);
      expect(ent.status).toBe('NONE');

      await lifecycle.ensureUsableSubscription(farm.id);
      await access.invalidateFarm(farm.id);
      ent = await access.resolveEntitlement(farm.id);

      expect(ent.status).toBe('ACTIVE');
      expect(ent.planName).toBe(PLAN_NAMES.FREE);
      expect(ent.features.length).toBeGreaterThan(0);

      // Idempotent — calling it again on a farm that already has a
      // subscription must not create a second row.
      const before = await prisma.farmSubscription.count({
        where: { farmId: farm.id },
      });
      await lifecycle.ensureUsableSubscription(farm.id);
      const after = await prisma.farmSubscription.count({
        where: { farmId: farm.id },
      });
      expect(after).toBe(before);
    } finally {
      await prisma.farmSubscription.deleteMany({ where: { farmId: farm.id } });
      await prisma.farm.delete({ where: { id: farm.id } }).catch(() => undefined);
    }
  });

  describe('Scheduled downgrade (RFE-036 follow-up)', () => {
    let downgradeFarmId: string;
    let starterPlanId: string;
    let proPlanId: string;
    let ownerUserId: string;

    beforeAll(async () => {
      const ownerUser = await prisma.user.findUnique({
        where: { email: 'owner@demo.rakhal.test' },
        select: { id: true },
      });
      if (!ownerUser) throw new Error('demo owner missing — run `pnpm seed`');
      ownerUserId = ownerUser.id;

      const [starter, pro] = await Promise.all([
        prisma.subscriptionPlan.findUniqueOrThrow({
          where: { name: PLAN_NAMES.STARTER },
        }),
        prisma.subscriptionPlan.findUniqueOrThrow({
          where: { name: PLAN_NAMES.PRO },
        }),
      ]);
      starterPlanId = starter.id;
      proPlanId = pro.id;

      const farm = await prisma.farm.create({
        data: {
          name: 'E2E Downgrade Farm',
          slug: `e2e-downgrade-${Date.now()}`,
          ownerId: ownerUserId,
        },
        select: { id: true },
      });
      downgradeFarmId = farm.id;
      // Active Pro, 20 days remaining — the exact scenario the feature exists for.
      await prisma.farmSubscription.create({
        data: {
          farmId: downgradeFarmId,
          subscriptionPlanId: proPlanId,
          status: 'ACTIVE',
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 20 * DAY_MS),
        },
      });
    });

    afterAll(async () => {
      await prisma.farmSubscription.deleteMany({
        where: { farmId: downgradeFarmId },
      });
      await prisma.farm
        .delete({ where: { id: downgradeFarmId } })
        .catch(() => undefined);
    });

    it('(a) schedules a downgrade to Starter with no Invoice created', async () => {
      const before = await prisma.invoice.count({
        where: { farmId: downgradeFarmId },
      });
      const schedule = await billing.scheduleDowngrade(
        downgradeFarmId,
        ownerUserId,
        { planId: starterPlanId, billingPeriod: 'MONTHLY' },
      );
      expect(schedule.pending_plan_id).toBe(starterPlanId);

      const after = await prisma.invoice.count({
        where: { farmId: downgradeFarmId },
      });
      expect(after).toBe(before);

      const row = await prisma.farmSubscription.findFirst({
        where: { farmId: downgradeFarmId },
        orderBy: { createdAt: 'desc' },
      });
      expect(row?.pendingPlanId).toBe(starterPlanId);
      expect(row?.subscriptionPlanId).toBe(proPlanId); // still Pro until the switch lands
    });

    it('(b) rejects scheduling an equal-or-higher-priced plan', async () => {
      await expect(
        billing.scheduleDowngrade(downgradeFarmId, ownerUserId, {
          planId: proPlanId,
          billingPeriod: 'MONTHLY',
        }),
      ).rejects.toThrow();
    });

    it('(c) cancel clears the pending fields', async () => {
      await billing.cancelScheduledDowngrade(downgradeFarmId, ownerUserId);
      const row = await prisma.farmSubscription.findFirst({
        where: { farmId: downgradeFarmId },
        orderBy: { createdAt: 'desc' },
      });
      expect(row?.pendingPlanId).toBeNull();
    });

    it('(d) the sweep applies a pending switch instead of marking PAST_DUE, once expiry lands', async () => {
      await billing.scheduleDowngrade(downgradeFarmId, ownerUserId, {
        planId: starterPlanId,
        billingPeriod: 'MONTHLY',
      });
      // Backdate expiry into the past — as if the 20 days had elapsed.
      await prisma.farmSubscription.updateMany({
        where: { farmId: downgradeFarmId, status: 'ACTIVE' },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await lifecycle.runExpirySweep();

      const latest = await prisma.farmSubscription.findFirst({
        where: { farmId: downgradeFarmId },
        orderBy: { createdAt: 'desc' },
      });
      expect(latest?.subscriptionPlanId).toBe(starterPlanId);
      expect(latest?.status).toBe('ACTIVE'); // not PAST_DUE — the switch landed seamlessly
      expect(latest?.pendingPlanId).toBeNull(); // fresh row carries no pending fields
    });
  });
});

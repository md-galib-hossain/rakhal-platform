import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { SubscriptionAccessService } from '../src/modules/subscription/application/services/subscription-access.service';

/**
 * RAKHAL-219 — feature-gate enforcement (`customer-api`, PRD §31.3). The demo
 * farm is ACTIVE Pro (all features); downgrading its subscription to Free must
 * 403 the Pro-only modules (reports, scoreboard) while `GET /subscription` keeps
 * working. Restores Pro afterwards so other specs are unaffected.
 */
interface SubResponse {
  status: string;
  plan_name: string | null;
  features: string[];
  usage: { cattle: number; farm_members: number };
}

describe('Subscription enforcement (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let access: SubscriptionAccessService;
  let owner: AuthedUser;
  let proPlanId: string;
  let freePlanId: string;
  let subId: string;

  const setPlan = async (planId: string) => {
    await prisma.farmSubscription.update({
      where: { id: subId },
      data: { subscriptionPlanId: planId },
    });
    await access.invalidateFarm(owner.farmId);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    access = ctx.app.get(SubscriptionAccessService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const plans = await prisma.subscriptionPlan.findMany({
      where: { name: { in: ['Pro', 'Free'] } },
      select: { id: true, name: true },
    });
    const pro = plans.find((p) => p.name === 'Pro');
    const free = plans.find((p) => p.name === 'Free');
    if (!pro || !free)
      throw new Error('Pro/Free plans missing — run `pnpm seed`');
    proPlanId = pro.id;
    freePlanId = free.id;

    const sub = await prisma.farmSubscription.findFirst({
      where: { farmId: owner.farmId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!sub)
      throw new Error('demo farm has no subscription — run `pnpm seed`');
    subId = sub.id;
  }, 30_000);

  afterAll(async () => {
    // Always restore the demo farm to Pro so other specs keep full access.
    if (subId && proPlanId) await setPlan(proPlanId);
    await ctx.app.close();
  });

  it('GET /subscription returns Pro entitlement + usage vs limits', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/subscription`)
      .set(...bearer(owner))
      .expect(200);

    const data = (res.body as { data: SubResponse }).data;
    expect(data.status).toBe('ACTIVE');
    expect(data.plan_name).toBe('Pro');
    expect(data.features).toEqual(
      expect.arrayContaining([
        'reports.generate',
        'scoreboard.read',
        'feed.formulator',
      ]),
    );
    expect(typeof data.usage.cattle).toBe('number');
    expect(typeof data.usage.farm_members).toBe('number');
  });

  it('a Pro farm can reach the gated modules', async () => {
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/reports`)
      .set(...bearer(owner))
      .expect(200);
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/scoreboard/highlights`)
      .set(...bearer(owner))
      .expect(200);
  });

  it('downgrading to Free 403s the Pro modules but keeps /subscription readable', async () => {
    await setPlan(freePlanId);

    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/reports`)
      .set(...bearer(owner))
      .expect(403);
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/scoreboard/highlights`)
      .set(...bearer(owner))
      .expect(403);

    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/subscription`)
      .set(...bearer(owner))
      .expect(200);
    const data = (res.body as { data: SubResponse }).data;
    expect(data.plan_name).toBe('Free');
    expect(data.features).not.toContain('reports.generate');

    // Restore → Pro regains access.
    await setPlan(proPlanId);
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/reports`)
      .set(...bearer(owner))
      .expect(200);
  });
});

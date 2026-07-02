import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { BillingPeriod } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { BillingService } from '../src/modules/billing/application/services/billing.service';
import { SubscriptionAccessService } from '../src/modules/subscription/application/services/subscription-access.service';

/**
 * RAKHAL-220 — billing core (`customer-api`, PRD §32). Server-computed totals
 * (PAY-01), idempotent checkout (PAY-05), farm-scoped invoice reads, and the
 * ৳0 → PAID-without-gateway path that activates the subscription (PAY-07).
 */
interface CheckoutResponse {
  invoice: {
    id: string;
    total: number;
    status: string;
    billing_period: string;
  };
  checkout: { provider_configured?: boolean } | null;
  idempotent: boolean;
}

describe('Billing core (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let billing: BillingService;
  let access: SubscriptionAccessService;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let proPlanId: string;
  let starterPlanId: string;
  let freePlanId: string;
  let ownerUserId: string;
  let tempFarmId: string | undefined;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    billing = ctx.app.get(BillingService);
    access = ctx.app.get(SubscriptionAccessService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');

    const plans = await prisma.subscriptionPlan.findMany({
      where: { name: { in: ['Pro', 'Starter', 'Free'] } },
      select: { id: true, name: true },
    });
    const byName = (n: string) => plans.find((p) => p.name === n);
    const pro = byName('Pro');
    const starter = byName('Starter');
    const free = byName('Free');
    if (!pro || !starter || !free)
      throw new Error('plans missing — run `pnpm seed`');
    proPlanId = pro.id;
    starterPlanId = starter.id;
    freePlanId = free.id;

    const user = await prisma.user.findUnique({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    if (!user) throw new Error('demo owner missing — run `pnpm seed`');
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    if (tempFarmId) {
      await prisma.payment.deleteMany({ where: { farmId: tempFarmId } });
      await prisma.invoice.deleteMany({ where: { farmId: tempFarmId } });
      await prisma.farmSubscription.deleteMany({
        where: { farmId: tempFarmId },
      });
      await prisma.farm
        .delete({ where: { id: tempFarmId } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('checkout computes the total server-side and is idempotent on the key', async () => {
    const key = `e2e-billing-${Date.now()}`;

    const first = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/billing/checkout`)
      .set(...bearer(owner))
      .set('Idempotency-Key', key)
      .send({ planId: proPlanId, billingPeriod: 'MONTHLY' })
      .expect(201);
    const a = (first.body as { data: CheckoutResponse }).data;
    expect(a.invoice.total).toBe(2500); // Pro monthly ৳
    expect(a.invoice.status).toBe('PENDING'); // no gateway configured yet
    expect(a.checkout?.provider_configured).toBe(false);
    expect(a.idempotent).toBe(false);

    const second = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/billing/checkout`)
      .set(...bearer(owner))
      .set('Idempotency-Key', key)
      .send({ planId: proPlanId, billingPeriod: 'MONTHLY' })
      .expect(201);
    const b = (second.body as { data: CheckoutResponse }).data;
    expect(b.idempotent).toBe(true);
    expect(b.invoice.id).toBe(a.invoice.id); // same invoice, no duplicate charge
  });

  it('lists + reads the farm own invoices; unknown id 404s (farm-scoped)', async () => {
    const list = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/billing/invoices`)
      .set(...bearer(owner))
      .expect(200);
    const items = (list.body as { data: { id: string }[] }).data;
    expect(items.length).toBeGreaterThan(0);

    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/billing/invoices/${items[0].id}`)
      .set(...bearer(owner))
      .expect(200);

    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/billing/invoices/does-not-exist`)
      .set(...bearer(owner))
      .expect(404);
  });

  it('rejects checkout for a non-owner (Manager lacks subscription.manage)', async () => {
    await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/billing/checkout`)
      .set(...bearer(manager))
      .send({ planId: proPlanId, billingPeriod: 'MONTHLY' })
      .expect(403);
  });

  it('a ৳0 (Free) invoice is PAID without a gateway and activates the subscription', async () => {
    const farm = await prisma.farm.create({
      data: {
        name: 'E2E Billing Farm',
        slug: `e2e-billing-${Date.now()}`,
        ownerId: ownerUserId,
      },
      select: { id: true },
    });
    tempFarmId = farm.id;

    const free = await billing.checkout(farm.id, ownerUserId, {
      planId: freePlanId,
      billingPeriod: BillingPeriod.MONTHLY,
    });
    expect(free.invoice.total).toBe(0);
    expect(free.invoice.status).toBe('PAID');

    const ent = await access.resolveEntitlement(farm.id);
    expect(ent.status).toBe('ACTIVE');
    expect(ent.planName).toBe('Free');

    // A paid plan stays PENDING (no gateway) and does NOT activate.
    const starter = await billing.checkout(farm.id, ownerUserId, {
      planId: starterPlanId,
      billingPeriod: BillingPeriod.MONTHLY,
    });
    expect(starter.invoice.total).toBe(1000);
    expect(starter.invoice.status).toBe('PENDING');

    // Cross-tenant: the demo farm cannot read the temp farm's invoice.
    await expect(
      billing.getInvoice(owner.farmId, starter.invoice.id),
    ).rejects.toThrow();
  });
});

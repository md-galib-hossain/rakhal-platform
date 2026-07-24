import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { BillingPeriod, CouponType } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { BillingService } from '../src/modules/billing/application/services/billing.service';
import { CouponService } from '../src/modules/billing/application/services/coupon.service';
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
  const extraFarmIds: string[] = [];

  const makeFarm = async (name: string) => {
    const farm = await prisma.farm.create({
      data: {
        name,
        slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ownerId: ownerUserId,
      },
      select: { id: true },
    });
    extraFarmIds.push(farm.id);
    return farm.id;
  };

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
    // The PATCH /billing/profile HTTP test below sets phone/address on the
    // shared demo owner's real farm — reset so other suites/agents sharing
    // this dev DB see the original (null) state.
    await prisma.farm
      .update({
        where: { id: owner.farmId },
        data: { phone: null, address: null },
      })
      .catch(() => undefined);
    for (const farmId of [tempFarmId, ...extraFarmIds].filter(
      (id): id is string => !!id,
    )) {
      await prisma.couponRedemption.deleteMany({ where: { farmId } });
      await prisma.payment.deleteMany({ where: { farmId } });
      await prisma.invoice.deleteMany({ where: { farmId } });
      await prisma.farmSubscription.deleteMany({ where: { farmId } });
      await prisma.farm
        .delete({ where: { id: farmId } })
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
    expect(a.invoice.status).toBe('PENDING'); // paid plan → awaits gateway
    // (checkout shape depends on whether a gateway is configured in this env)
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

    // Free-plan checkout is gated on a complete profile (phone + address) —
    // set directly via Prisma here since this test is about the ৳0/PAID/
    // activation path, not the profile gate itself (covered below).
    await prisma.farm.update({
      where: { id: farm.id },
      data: { phone: '01700000000', address: '123 Test Road, Dhaka' },
    });

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

  it('Free-plan checkout is rejected until the farm profile (phone+address) is complete', async () => {
    const farmId = await makeFarm('Free Gate No Profile');

    await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/billing/checkout`)
      .set(...bearer(owner))
      .send({ planId: freePlanId, billingPeriod: 'MONTHLY' })
      .expect(403);

    await expect(
      billing.checkout(farmId, ownerUserId, {
        planId: freePlanId,
        billingPeriod: BillingPeriod.MONTHLY,
      }),
    ).rejects.toThrow(/complete your farm profile/i);
  });

  it('PATCH /billing/profile completes the profile, then Free-plan activates and marks the farm — a second attempt 409s', async () => {
    const farmId = await makeFarm('Free Gate Once Only');

    // Direct service call scoped to this temp farm (the HTTP route always acts
    // on the caller's own active JWT farm, which is the demo owner's farm —
    // exercised separately by the HTTP 403 case above).
    await prisma.farm.update({
      where: { id: farmId },
      data: { phone: null, address: null },
    });
    await expect(
      billing.checkout(farmId, ownerUserId, {
        planId: freePlanId,
        billingPeriod: BillingPeriod.MONTHLY,
      }),
    ).rejects.toThrow(/complete your farm profile/i);

    await prisma.farm.update({
      where: { id: farmId },
      data: { phone: '01711111111', address: '456 Farm Lane, Chattogram' },
    });

    const first = await billing.checkout(farmId, ownerUserId, {
      planId: freePlanId,
      billingPeriod: BillingPeriod.MONTHLY,
    });
    expect(first.invoice.total).toBe(0);
    expect(first.invoice.status).toBe('PAID');

    const farmAfter = await prisma.farm.findUniqueOrThrow({
      where: { id: farmId },
      select: { freePlanActivatedAt: true },
    });
    expect(farmAfter.freePlanActivatedAt).not.toBeNull();

    // Second Free-plan attempt on the same farm — already activated once.
    await expect(
      billing.checkout(farmId, ownerUserId, {
        planId: freePlanId,
        billingPeriod: BillingPeriod.MONTHLY,
      }),
    ).rejects.toThrow(/already been activated/i);
  });

  it('PATCH /billing/profile over HTTP updates phone/address (and optional farm_name)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .patch(`${ctx.prefix}/billing/profile`)
      .set(...bearer(owner))
      .send({ phone: '01799999999', address: '789 Owner Street' })
      .expect(200);
    const body = (
      res.body as {
        data: { phone: string; address: string; farm_id: string };
      }
    ).data;
    expect(body.phone).toBe('01799999999');
    expect(body.address).toBe('789 Owner Street');
  });

  it('rejects an invalid phone shape on PATCH /billing/profile', async () => {
    await request(ctx.app.getHttpServer())
      .patch(`${ctx.prefix}/billing/profile`)
      .set(...bearer(owner))
      .send({ phone: '12345', address: 'Somewhere' })
      .expect(400);
  });

  describe('POST /billing/checkout/preview', () => {
    let coupons: CouponService;

    beforeAll(() => {
      coupons = ctx.app.get(CouponService);
    });

    it('previews a valid coupon without mutating redemption state', async () => {
      const code = `PREVIEW-${Date.now()}`.toUpperCase();
      await coupons.issue({
        code,
        type: CouponType.FIXED,
        value: 150,
        maxRedemptions: 5,
        validFrom: new Date(Date.now() - 86_400_000),
        validUntil: new Date(Date.now() + 30 * 86_400_000),
      });
      const coupon = await prisma.coupon.findUniqueOrThrow({
        where: { code },
      });

      const res = await request(ctx.app.getHttpServer())
        .post(`${ctx.prefix}/billing/checkout/preview`)
        .set(...bearer(owner))
        .send({
          planId: proPlanId,
          billingPeriod: 'MONTHLY',
          couponCode: code,
        })
        .expect(201);
      const body = (
        res.body as {
          data: { subtotal: number; discount_total: number; total: number };
        }
      ).data;
      expect(body.subtotal).toBe(2500);
      expect(body.discount_total).toBe(150);
      expect(body.total).toBe(2350);

      const redemptionCount = await prisma.couponRedemption.count({
        where: { couponId: coupon.id },
      });
      expect(redemptionCount).toBe(0);
      const unchanged = await prisma.coupon.findUniqueOrThrow({
        where: { code },
      });
      expect(unchanged.redeemedCount).toBe(0);
    });

    it('rejects preview of an unknown coupon code', async () => {
      await request(ctx.app.getHttpServer())
        .post(`${ctx.prefix}/billing/checkout/preview`)
        .set(...bearer(owner))
        .send({
          planId: proPlanId,
          billingPeriod: 'MONTHLY',
          couponCode: 'DOES-NOT-EXIST',
        })
        .expect(404);
    });
  });
});

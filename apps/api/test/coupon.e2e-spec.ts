import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { BillingPeriod, CouponType } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { BillingService } from '../src/modules/billing/application/services/billing.service';
import { CouponService } from '../src/modules/billing/application/services/coupon.service';

/**
 * RAKHAL-222 — coupon engine (`customer-api`, PRD §33.1). Atomic seat
 * decrement under concurrency (CPN-01), one-redemption-per-farm (CPN-02),
 * validity window (CPN-03), phone-verification gate on a 100%-off coupon
 * (CPN-04), and never-negative totals (CPN-05). Issuance/list/disable have no
 * HTTP surface yet (`PlatformAdminGuard` lands in RAKHAL-224/225), so this
 * suite drives `CouponService` directly for setup — same pattern the billing
 * suite already uses for its ৳0-invoice scenario.
 */
interface CheckoutResponse {
  invoice: {
    id: string;
    total: number;
    discount_total: number;
    status: string;
  };
  checkout: unknown;
  idempotent: boolean;
}

describe('Coupon engine (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let billing: BillingService;
  let coupons: CouponService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let starterPlanId: string;
  let proPlanId: string;
  const tempFarmIds: string[] = [];

  const uniqueCode = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();

  const makeFarm = async (name: string) => {
    const farm = await prisma.farm.create({
      data: {
        name,
        slug: `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ownerId: ownerUserId,
      },
      select: { id: true },
    });
    tempFarmIds.push(farm.id);
    return farm.id;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    billing = ctx.app.get(BillingService);
    coupons = ctx.app.get(CouponService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const plans = await prisma.subscriptionPlan.findMany({
      where: { name: { in: ['Starter', 'Pro'] } },
      select: { id: true, name: true },
    });
    const starter = plans.find((p) => p.name === 'Starter');
    const pro = plans.find((p) => p.name === 'Pro');
    if (!starter || !pro) throw new Error('plans missing — run `pnpm seed`');
    starterPlanId = starter.id;
    proPlanId = pro.id;

    const user = await prisma.user.findUnique({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    if (!user) throw new Error('demo owner missing — run `pnpm seed`');
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    // Never leave the shared demo user phone-verified for other suites/agents.
    await prisma.user
      .update({ where: { id: ownerUserId }, data: { phoneVerifiedAt: null } })
      .catch(() => undefined);
    for (const farmId of tempFarmIds) {
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

  it('GALIB100-style: 10 seats, 100% off — 10 redeem, the 11th is exhausted', async () => {
    await prisma.user.update({
      where: { id: ownerUserId },
      data: { phoneVerifiedAt: new Date() },
    });

    const code = uniqueCode('GALIB100');
    await coupons.issue(ownerUserId, {
      code,
      type: CouponType.PERCENT,
      value: 100,
      maxRedemptions: 10,
      validFrom: new Date(Date.now() - 86_400_000),
      validUntil: new Date(Date.now() + 30 * 86_400_000),
    });

    for (let i = 0; i < 10; i++) {
      const farmId = await makeFarm(`Coupon Seat ${i}`);
      const res = await billing.checkout(farmId, ownerUserId, {
        planId: starterPlanId,
        billingPeriod: BillingPeriod.MONTHLY,
        couponCode: code,
      });
      expect(res.invoice.total).toBe(0);
      expect(res.invoice.status).toBe('PAID');
    }

    const eleventhFarmId = await makeFarm('Coupon Seat 11');
    await expect(
      billing.checkout(eleventhFarmId, ownerUserId, {
        planId: starterPlanId,
        billingPeriod: BillingPeriod.MONTHLY,
        couponCode: code,
      }),
    ).rejects.toThrow(/exhausted/i);

    const finalCoupon = await prisma.coupon.findUnique({ where: { code } });
    expect(finalCoupon?.redeemedCount).toBe(10);

    await prisma.user.update({
      where: { id: ownerUserId },
      data: { phoneVerifiedAt: null },
    });
  }, 30_000);

  it('the same farm cannot redeem a coupon twice', async () => {
    const code = uniqueCode('ONCE');
    await coupons.issue(ownerUserId, {
      code,
      type: CouponType.FIXED,
      value: 100,
      maxRedemptions: 5,
      validFrom: new Date(Date.now() - 86_400_000),
      validUntil: new Date(Date.now() + 30 * 86_400_000),
    });
    const farmId = await makeFarm('Coupon Once');

    const first = await billing.checkout(farmId, ownerUserId, {
      planId: starterPlanId,
      billingPeriod: BillingPeriod.MONTHLY,
      couponCode: code,
    });
    expect(first.invoice.total).toBe(900); // 1000 - 100

    await expect(
      billing.checkout(farmId, ownerUserId, {
        planId: starterPlanId,
        billingPeriod: BillingPeriod.MONTHLY,
        couponCode: code,
      }),
    ).rejects.toThrow(/already redeemed/i);
  });

  it('an expired coupon is rejected', async () => {
    const code = uniqueCode('EXPIRED');
    await coupons.issue(ownerUserId, {
      code,
      type: CouponType.FIXED,
      value: 100,
      maxRedemptions: 5,
      validFrom: new Date(Date.now() - 30 * 86_400_000),
      validUntil: new Date(Date.now() - 86_400_000),
    });
    const farmId = await makeFarm('Coupon Expired');

    await expect(
      billing.checkout(farmId, ownerUserId, {
        planId: starterPlanId,
        billingPeriod: BillingPeriod.MONTHLY,
        couponCode: code,
      }),
    ).rejects.toThrow(/not valid/i);
  });

  it('a 100%-off coupon is rejected for an unverified phone (CPN-04)', async () => {
    await prisma.user.update({
      where: { id: ownerUserId },
      data: { phoneVerifiedAt: null },
    });
    const code = uniqueCode('FREE100');
    await coupons.issue(ownerUserId, {
      code,
      type: CouponType.PERCENT,
      value: 100,
      maxRedemptions: 5,
      validFrom: new Date(Date.now() - 86_400_000),
      validUntil: new Date(Date.now() + 30 * 86_400_000),
    });
    const farmId = await makeFarm('Coupon Unverified');

    await expect(
      billing.checkout(farmId, ownerUserId, {
        planId: starterPlanId,
        billingPeriod: BillingPeriod.MONTHLY,
        couponCode: code,
      }),
    ).rejects.toThrow(/phone-verified/i);
  });

  it('concurrent redemptions never exceed the seat count (CPN-01)', async () => {
    const code = uniqueCode('RACE');
    await coupons.issue(ownerUserId, {
      code,
      type: CouponType.FIXED,
      value: 50,
      maxRedemptions: 3,
      validFrom: new Date(Date.now() - 86_400_000),
      validUntil: new Date(Date.now() + 30 * 86_400_000),
    });
    const farmIds = await Promise.all(
      Array.from({ length: 6 }, (_, i) => makeFarm(`Coupon Race ${i}`)),
    );

    const results = await Promise.allSettled(
      farmIds.map((farmId) =>
        billing.checkout(farmId, ownerUserId, {
          planId: starterPlanId,
          billingPeriod: BillingPeriod.MONTHLY,
          couponCode: code,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(succeeded).toHaveLength(3);
    expect(failed).toHaveLength(3);

    const finalCoupon = await prisma.coupon.findUnique({ where: { code } });
    expect(finalCoupon?.redeemedCount).toBe(3);
    const redemptionCount = await prisma.couponRedemption.count({
      where: { couponId: finalCoupon!.id },
    });
    expect(redemptionCount).toBe(3);
  }, 30_000);

  it('applies a coupon at checkout over HTTP and reflects the discount', async () => {
    const code = uniqueCode('HTTPFIXED');
    await coupons.issue(ownerUserId, {
      code,
      type: CouponType.FIXED,
      value: 200,
      maxRedemptions: 1,
      validFrom: new Date(Date.now() - 86_400_000),
      validUntil: new Date(Date.now() + 30 * 86_400_000),
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/billing/checkout`)
      .set(...bearer(owner))
      .set('Idempotency-Key', `e2e-coupon-http-${Date.now()}`)
      .send({ planId: proPlanId, billingPeriod: 'MONTHLY', couponCode: code })
      .expect(201);
    const body = (res.body as { data: CheckoutResponse }).data;
    expect(body.invoice.discount_total).toBe(200);
    expect(body.invoice.total).toBe(2300); // Pro 2500 - 200
  });
});

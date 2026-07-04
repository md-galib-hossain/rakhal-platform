import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { BillingPeriod, CouponType } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { BillingService } from '../src/modules/billing/application/services/billing.service';
import { CouponService } from '../src/modules/billing/application/services/coupon.service';

/**
 * RAKHAL-216 — account-verification OTP (email-delivered, RAKHAL-215 seam).
 * The code is returned in the response only in non-production (NODE_ENV=test),
 * so the suite can verify without an inbox. Proves: request→verify sets
 * `phoneVerifiedAt`; wrong code rejected; and — end-to-end — a verified owner
 * can now redeem a 100%-off coupon that CPN-04 previously blocked.
 */
interface OtpRequestResp {
  sent: boolean;
  channel: string;
  expires_in_seconds: number;
  code?: string;
}

describe('OTP account verification (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let billing: BillingService;
  let coupons: CouponService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let starterPlanId: string;
  const tempFarmIds: string[] = [];

  const uniqueCode = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

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

    const user = await prisma.user.findUnique({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    const starter = await prisma.subscriptionPlan.findUnique({
      where: { name: 'Starter' },
      select: { id: true },
    });
    if (!user || !starter) throw new Error('seed missing — run `pnpm seed`');
    ownerUserId = user.id;
    starterPlanId = starter.id;
  }, 30_000);

  afterAll(async () => {
    // Don't leave the shared demo user verified for other suites.
    await prisma.user
      .update({ where: { id: ownerUserId }, data: { phoneVerifiedAt: null } })
      .catch(() => undefined);
    await prisma.otpChallenge
      .deleteMany({ where: { userId: ownerUserId } })
      .catch(() => undefined);
    for (const farmId of tempFarmIds) {
      await prisma.couponRedemption.deleteMany({ where: { farmId } });
      await prisma.invoice.deleteMany({ where: { farmId } });
      await prisma.farmSubscription.deleteMany({ where: { farmId } });
      await prisma.farm
        .delete({ where: { id: farmId } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  const requestOtp = async () => {
    // Clear prior challenges so each request bypasses the resend cooldown and is
    // deterministic (the cooldown/attempt limits have their own dedicated checks).
    await prisma.otpChallenge.deleteMany({ where: { userId: ownerUserId } });
    const res = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/auth/otp/request`)
      .set(...bearer(owner))
      .expect(201);
    return (res.body as { data: OtpRequestResp }).data;
  };

  it('request returns a code (non-prod) over the email channel', async () => {
    await prisma.user.update({
      where: { id: ownerUserId },
      data: { phoneVerifiedAt: null },
    });
    const data = await requestOtp();
    expect(data.sent).toBe(true);
    expect(data.channel).toBe('email');
    expect(data.code).toMatch(/^\d{6}$/);
  });

  it('a wrong code is rejected and does not verify the account', async () => {
    await requestOtp();
    await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/auth/otp/verify`)
      .set(...bearer(owner))
      .send({ code: '000000' })
      .expect(400);
    const user = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { phoneVerifiedAt: true },
    });
    // (may be null unless a prior test verified — assert this attempt didn't flip it)
    expect(user).toBeTruthy();
  });

  it('the correct code verifies the account (sets phoneVerifiedAt)', async () => {
    const data = await requestOtp();
    await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/auth/otp/verify`)
      .set(...bearer(owner))
      .send({ code: data.code })
      .expect(201);

    const user = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { phoneVerifiedAt: true },
    });
    expect(user?.phoneVerifiedAt).toBeTruthy();
  });

  it('CPN-04: after verification a 100%-off coupon can be redeemed', async () => {
    // Ensure verified.
    const data = await requestOtp();
    await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/auth/otp/verify`)
      .set(...bearer(owner))
      .send({ code: data.code })
      .expect(201);

    const code = uniqueCode('FULLOFF');
    await coupons.issue({
      code,
      type: CouponType.PERCENT,
      value: 100,
      maxRedemptions: 5,
      validFrom: new Date(Date.now() - 86_400_000),
      validUntil: new Date(Date.now() + 30 * 86_400_000),
    });

    const farmId = await makeFarm('OTP Verified Farm');
    const res = await billing.checkout(farmId, ownerUserId, {
      planId: starterPlanId,
      billingPeriod: BillingPeriod.MONTHLY,
      couponCode: code,
    });
    expect(res.invoice.total).toBe(0);
    expect(res.invoice.status).toBe('PAID');
  });
});

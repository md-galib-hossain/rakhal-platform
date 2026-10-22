import request from 'supertest';
import { purgeAdminAudit } from './utils/admin-audit';
import * as argon2 from 'argon2';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { BillingPeriod } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { BillingService } from '../src/modules/billing/application/services/billing.service';

/**
 * RAKHAL-224 — platform-admin surface + guard isolation (`admin-api`, PRD §32.5,
 * ADR-016/019). Proves the two identities are hermetic: a farm token can't reach
 * `/admin/*`, an admin token can't reach `/api/v1/billing/*`. Plus the admin
 * coupon lifecycle (CPN-06) and the disabled-coupon-can't-redeem loophole.
 */
interface LoginResp {
  twoFactorSetupRequired: boolean;
  accessToken: string;
  admin: { id: string; email: string; role: string };
}
interface Coupon {
  id: string;
  code: string;
  status: string;
}

describe('Platform admin (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let billing: BillingService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let starterPlanId: string;
  let adminToken: string;
  const tempFarmIds: string[] = [];

  const uniqueCode = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

  const adminAuth = (): [string, string] => [
    'Authorization',
    `Bearer ${adminToken}`,
  ];

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

    const login = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/auth/login`)
      .send({
        email: 'admin@rakhal.test',
        password: 'AdminPass123',
        code: currentTotpCode(),
      })
      .expect(201);
    adminToken = (login.body as { data: LoginResp }).data.accessToken;
  }, 30_000);

  afterAll(async () => {
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

  it('admin login issues a token; wrong password is 401', async () => {
    expect(adminToken).toBeTruthy();
    await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/auth/login`)
      .send({ email: 'admin@rakhal.test', password: 'wrong' })
      .expect(401);
  });

  it('a farm token cannot reach /admin/* (guard isolation)', async () => {
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/admin/coupons`)
      .set(...bearer(owner))
      .expect(401);
  });

  it('an admin without 2FA enabled is blocked from every /admin/* route (RAKHAL-225)', async () => {
    const email = `no2fa-${Date.now()}@rakhal.test`;
    const created = await prisma.platformAdmin.create({
      data: {
        email,
        name: 'No 2FA Admin',
        passwordHash: await argon2.hash('NoTwoFactor123', {
          type: argon2.argon2id,
        }),
        role: 'SUPER_ADMIN',
      },
    });

    const login = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/auth/login`)
      .send({ email, password: 'NoTwoFactor123' })
      .expect(201);
    const body = (login.body as { data: LoginResp }).data;
    expect(body.twoFactorSetupRequired).toBe(true);
    expect(body.accessToken).toBeUndefined();

    // The setup token cannot be used against a normal /admin/* route.
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/admin/coupons`)
      .set(
        'Authorization',
        `Bearer ${(login.body as { data: { setupToken: string } }).data.setupToken}`,
      )
      .expect(401);

    await prisma.platformAdmin.delete({ where: { id: created.id } });
  });

  it('least-privilege: a role without the permission gets 403 on a foreign action', async () => {
    const email = `support-${Date.now()}@rakhal.test`;
    const created = await prisma.platformAdmin.create({
      data: {
        email,
        name: 'Support Admin',
        passwordHash: await argon2.hash('SupportPass123', {
          type: argon2.argon2id,
        }),
        role: 'SUPPORT_ADMIN',
        totpEnabled: true,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      },
    });

    const login = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/auth/login`)
      .send({
        email,
        password: 'SupportPass123',
        code: currentTotpCode(),
      })
      .expect(201);
    const supportToken = (login.body as { data: LoginResp }).data.accessToken;

    // SUPPORT_ADMIN can read coupons...
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/admin/coupons`)
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(200);

    // ...but cannot issue one (coupon.manage is BILLING_ADMIN/SUPER_ADMIN only).
    await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/coupons`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({
        code: uniqueCode('DENIED'),
        type: 'FIXED',
        value: 100,
        maxRedemptions: 5,
        validFrom: new Date(Date.now() - 86_400_000).toISOString(),
        validUntil: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      })
      .expect(403);

    await purgeAdminAudit(prisma, created.id);
    await prisma.platformAdmin.delete({ where: { id: created.id } });
  });

  it('GET /admin/audit lists admin actions (ADM-03)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/admin/audit`)
      .set(...adminAuth())
      .expect(200);
    const items = (res.body as { data: unknown[] }).data;
    expect(Array.isArray(items)).toBe(true);
  });

  it('an admin token cannot reach a farm billing route (reverse isolation)', async () => {
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/billing/invoices`)
      .set(...adminAuth())
      .expect(401);
  });

  it('admin can read plans + the referral commission ledger', async () => {
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/admin/plans`)
      .set(...adminAuth())
      .expect(200);
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/admin/referrals/commissions`)
      .set(...adminAuth())
      .expect(200);
  });

  it('admin issues a coupon → it lists → disable flips status + writes an admin audit row', async () => {
    const code = uniqueCode('ADMIN');
    const issue = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/coupons`)
      .set(...adminAuth())
      .send({
        code,
        type: 'FIXED',
        value: 100,
        maxRedemptions: 5,
        validFrom: new Date(Date.now() - 86_400_000).toISOString(),
        validUntil: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      })
      .expect(201);
    const created = (issue.body as { data: Coupon }).data;
    expect(created.code).toBe(code);

    const list = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/admin/coupons`)
      .set(...adminAuth())
      .expect(200);
    const items = (list.body as { data: Coupon[] }).data;
    expect(items.some((c) => c.code === code)).toBe(true);

    const disable = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/coupons/${created.id}/disable`)
      .set(...adminAuth())
      .expect(201);
    expect((disable.body as { data: Coupon }).data.status).toBe('DISABLED');

    const auditRows = await prisma.platformAdminAuditLog.count({
      where: { entityId: created.id, action: 'COUPON_ISSUED' },
    });
    expect(auditRows).toBeGreaterThan(0);
  });

  it('a disabled coupon is rejected at redemption (no loophole)', async () => {
    const code = uniqueCode('DISABLED');
    const issue = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/coupons`)
      .set(...adminAuth())
      .send({
        code,
        type: 'FIXED',
        value: 100,
        maxRedemptions: 5,
        validFrom: new Date(Date.now() - 86_400_000).toISOString(),
        validUntil: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      })
      .expect(201);
    const created = (issue.body as { data: Coupon }).data;

    // Works before disable.
    const farmA = await makeFarm('Admin Coupon A');
    const ok = await billing.checkout(farmA, ownerUserId, {
      planId: starterPlanId,
      billingPeriod: BillingPeriod.MONTHLY,
      couponCode: code,
    });
    expect(ok.invoice.total).toBe(900);

    await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/coupons/${created.id}/disable`)
      .set(...adminAuth())
      .expect(201);

    // Rejected after disable.
    const farmB = await makeFarm('Admin Coupon B');
    await expect(
      billing.checkout(farmB, ownerUserId, {
        planId: starterPlanId,
        billingPeriod: BillingPeriod.MONTHLY,
        couponCode: code,
      }),
    ).rejects.toThrow(/disabled/i);
  });
});

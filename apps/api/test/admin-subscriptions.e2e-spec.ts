import request from 'supertest';
import { PlatformAdminRole } from '@prisma/client';
import { createTestApp, TestContext } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { purgeAdminAudit } from './utils/admin-audit';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import { LegalConsentService } from '../src/modules/compliance/application/services/legal-consent.service';

/**
 * Phase 6 commercial admin: plan/feature matrix editor + manual subscription operations. Every change targets
 * a throwaway plan and a throwaway farm this suite creates, so no real plan or tenant is modified.
 */
describe('Admin subscriptions + plan matrix (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  const TOTP = 'JBSWY3DPEHPK3PXP';
  const stamp = Date.now();
  const adminIds: string[] = [];
  const userIds: string[] = [];
  const farmIds: string[] = [];
  let billing: string;
  let support: string;
  let planId: string;
  let featureKey: string;
  const reason = 'Commercial agreement signed with the owner (ticket 5120)';

  const api = (p: string) => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const as = (t: string) => ({
    get: (p: string) =>
      request(server()).get(api(p)).set('Authorization', `Bearer ${t}`),
    post: (p: string, b?: object) =>
      request(server())
        .post(api(p))
        .set('Authorization', `Bearer ${t}`)
        .send(b),
    patch: (p: string, b?: object) =>
      request(server())
        .patch(api(p))
        .set('Authorization', `Bearer ${t}`)
        .send(b),
    put: (p: string, b?: object) =>
      request(server()).put(api(p)).set('Authorization', `Bearer ${t}`).send(b),
  });
  const dataOf = <T>(res: request.Response) => (res.body as { data: T }).data;

  async function makeAdmin(role: PlatformAdminRole): Promise<string> {
    const email = `p6-sub-${role.toLowerCase()}-${stamp}@rakhal.test`;
    const password = 'P6SubE2Epass12345';
    const admin = await prisma.platformAdmin.create({
      data: {
        email,
        name: `P6 ${role}`,
        passwordHash: await ctx.app.get(PasswordService).hashPassword(password),
        role,
        totpSecret: TOTP,
        totpEnabled: true,
      },
    });
    adminIds.push(admin.id);
    const res = await request(server())
      .post(api('/admin/auth/login'))
      .send({ email, password, code: currentTotpCode(TOTP) })
      .expect(201);
    return dataOf<{ accessToken: string }>(res).accessToken;
  }

  async function makeFarm() {
    const user = await prisma.user.create({
      data: {
        email: `p6-owner-${stamp}-${userIds.length}@rakhal.test`,
        name: 'P6 Owner',
        passwordHash: await ctx.app
          .get(PasswordService)
          .hashPassword('P6OwnerE2Epass123'),
        isEmailVerified: true,
      },
      select: { id: true },
    });
    userIds.push(user.id);
    await ctx.app.get(LegalConsentService).recordConsent(user.id, []);
    const farm = await ctx.app
      .get(FarmService)
      .create(user.id, { name: `P6 Farm ${stamp} ${farmIds.length}` });
    farmIds.push(farm.id);
    return { id: farm.id, name: farm.name };
  }

  const latest = (farmId: string) =>
    prisma.farmSubscription.findFirstOrThrow({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    billing = await makeAdmin('BILLING_ADMIN');
    support = await makeAdmin('SUPPORT_ADMIN');
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: `P6 Test Plan ${stamp}`,
        description: 'e2e',
        monthlyPrice: 100,
        yearlyPrice: 1000,
        maxCattle: 50,
        maxFarmMembers: 3,
      },
    });
    planId = plan.id;
    const feature = await prisma.feature.findFirstOrThrow();
    featureKey = feature.key;
  }, 40_000);

  afterAll(async () => {
    for (const id of farmIds) {
      await prisma.farmSubscription
        .deleteMany({ where: { farmId: id } })
        .catch(() => undefined);
    }
    await prisma.subscriptionFeature
      .deleteMany({ where: { subscriptionPlanId: planId } })
      .catch(() => undefined);
    await prisma.farmSubscription
      .deleteMany({ where: { subscriptionPlanId: planId } })
      .catch(() => undefined);
    await prisma.subscriptionPlan
      .delete({ where: { id: planId } })
      .catch(() => undefined);
    for (const id of farmIds)
      await prisma.farm.delete({ where: { id } }).catch(() => undefined);
    for (const id of userIds)
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    for (const id of adminIds) {
      await purgeAdminAudit(prisma, id);
      await prisma.platformAdmin
        .delete({ where: { id } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  describe('plan matrix', () => {
    it('lists plans with limits, enabled features and farm counts; SUPPORT can read', async () => {
      const res = await as(support).get('/admin/plans/matrix').expect(200);
      const body = dataOf<{
        features: { key: string }[];
        plans: {
          id: string;
          name: string;
          monthlyPrice: number;
          enabledFeatures: string[];
          farmCount: number;
        }[];
      }>(res);
      expect(body.features.length).toBeGreaterThan(0);
      const mine = body.plans.find((p) => p.id === planId);
      expect(mine?.monthlyPrice).toBe(100);
      expect(mine?.enabledFeatures).toEqual([]);
      expect(typeof mine?.farmCount).toBe('number');
    });

    it('updates a plan with before/after audit; needs a reason, a change and plan.manage', async () => {
      await as(billing)
        .patch(`/admin/plans/${planId}`, { monthlyPrice: 150 })
        .expect(400); // no reason
      await as(billing).patch(`/admin/plans/${planId}`, { reason }).expect(400); // nothing to change
      await as(billing)
        .patch(`/admin/plans/${planId}`, { monthlyPrice: -5, reason })
        .expect(400);
      await as(support)
        .patch(`/admin/plans/${planId}`, { monthlyPrice: 150, reason })
        .expect(403);
      await as(billing)
        .patch('/admin/plans/does-not-exist', { monthlyPrice: 150, reason })
        .expect(404);

      await as(billing)
        .patch(`/admin/plans/${planId}`, {
          monthlyPrice: 150,
          maxCattle: 80,
          reason,
        })
        .expect(200);
      const row = await prisma.platformAdminAuditLog.findFirstOrThrow({
        where: { action: 'PLAN_UPDATED', entityId: planId },
      });
      expect((row.before as { monthlyPrice: string }).monthlyPrice).toBe('100');
      expect((row.after as { monthlyPrice: string }).monthlyPrice).toBe('150');
      expect((row.after as { maxCattle: number }).maxCattle).toBe(80);
      expect((row.metadata as { reason: string }).reason).toBe(reason);
    });

    it('sets a feature on a plan, idempotently, and the matrix reflects it', async () => {
      const path = `/admin/plans/${planId}/features/${featureKey}`;
      await as(billing).put(path, { enabled: true }).expect(400); // no reason
      const on = await as(billing)
        .put(path, { enabled: true, reason })
        .expect(200);
      expect(dataOf<{ changed: boolean }>(on).changed).toBe(true);
      const again = await as(billing)
        .put(path, { enabled: true, reason })
        .expect(200);
      expect(dataOf<{ changed: boolean }>(again).changed).toBe(false);

      const matrix = await as(billing).get('/admin/plans/matrix').expect(200);
      const mine = dataOf<{
        plans: { id: string; enabledFeatures: string[] }[];
      }>(matrix).plans.find((p) => p.id === planId);
      expect(mine?.enabledFeatures).toContain(featureKey);

      await as(billing).put(path, { enabled: false, reason }).expect(200);
      await as(billing)
        .put(`/admin/plans/${planId}/features/no-such-feature`, {
          enabled: true,
          reason,
        })
        .expect(404);
    });
  });

  describe('manual subscription operations', () => {
    it('requires a reason, the exact farm name and subscription.manage', async () => {
      const farm = await makeFarm();
      const path = `/admin/farms/${farm.id}/subscription/activate`;
      await as(billing)
        .post(path, { planId, period: 'MONTHLY', confirm: farm.name })
        .expect(400);
      await as(billing)
        .post(path, { planId, period: 'MONTHLY', reason, confirm: 'wrong' })
        .expect(400);
      await as(billing)
        .post(path, {
          planId,
          period: 'FORTNIGHTLY',
          reason,
          confirm: farm.name,
        })
        .expect(400);
      await as(support)
        .post(path, { planId, period: 'MONTHLY', reason, confirm: farm.name })
        .expect(403);
      await as(billing)
        .post('/admin/farms/nope/subscription/activate', {
          planId,
          period: 'MONTHLY',
          reason,
          confirm: 'x',
        })
        .expect(404);
      await as(billing)
        .post(path, {
          planId: 'nope',
          period: 'MONTHLY',
          reason,
          confirm: farm.name,
        })
        .expect(404);
    });

    it('activate, comp, extend, cancel: effects, audit and idempotent cancel', async () => {
      const farm = await makeFarm();
      const base = `/admin/farms/${farm.id}/subscription`;
      const body = { reason, confirm: farm.name };

      await as(billing)
        .post(`${base}/activate`, { ...body, planId, period: 'MONTHLY' })
        .expect(200);
      const activated = await latest(farm.id);
      expect(activated.subscriptionPlanId).toBe(planId);
      expect(activated.status).toBe('ACTIVE');
      const monthMs =
        (activated.expiresAt!.getTime() - activated.startsAt.getTime()) /
        86_400_000;
      expect(monthMs).toBeGreaterThanOrEqual(28);
      expect(monthMs).toBeLessThanOrEqual(31);

      await as(billing)
        .post(`${base}/comp`, { ...body, planId, days: 30 })
        .expect(200);
      const comped = await latest(farm.id);
      expect(comped.id).not.toBe(activated.id);
      expect(
        Math.round((comped.expiresAt!.getTime() - Date.now()) / 86_400_000),
      ).toBe(30);

      const before = comped.expiresAt!.getTime();
      await as(billing)
        .post(`${base}/extend`, { ...body, days: 10 })
        .expect(200);
      const extended = await latest(farm.id);
      expect(extended.id).toBe(comped.id);
      expect(
        Math.round((extended.expiresAt!.getTime() - before) / 86_400_000),
      ).toBe(10);

      const cancelled = await as(billing)
        .post(`${base}/cancel`, body)
        .expect(200);
      expect(
        dataOf<{ status: string; changed: boolean }>(cancelled),
      ).toMatchObject({ status: 'CANCELLED', changed: true });
      expect((await latest(farm.id)).cancelledAt).not.toBeNull();
      const again = await as(billing).post(`${base}/cancel`, body).expect(200);
      expect(dataOf<{ changed: boolean }>(again).changed).toBe(false);
      await as(billing)
        .post(`${base}/extend`, { ...body, days: 5 })
        .expect(409); // cancelled can't be extended

      const audits = await prisma.platformAdminAuditLog.findMany({
        where: { entityId: farm.id, action: { startsWith: 'SUBSCRIPTION_' } },
        orderBy: { createdAt: 'asc' },
      });
      expect(audits.map((a) => a.action)).toEqual([
        'SUBSCRIPTION_ACTIVATED',
        'SUBSCRIPTION_COMPED',
        'SUBSCRIPTION_EXTENDED',
        'SUBSCRIPTION_CANCELLED',
      ]);
      const last = audits[3];
      expect((last.before as { status: string }).status).toBe('ACTIVE');
      expect((last.after as { status: string }).status).toBe('CANCELLED');
      expect((last.metadata as { manual: boolean }).manual).toBe(true);
      expect((last.metadata as { reason: string }).reason).toBe(reason);
    });

    it('extending an expired subscription revives it from now, not from the past expiry', async () => {
      const farm = await makeFarm();
      const sub = await latest(farm.id);
      await prisma.farmSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'EXPIRED',
          expiresAt: new Date(Date.now() - 20 * 86_400_000),
        },
      });
      await as(billing)
        .post(`/admin/farms/${farm.id}/subscription/extend`, {
          reason,
          confirm: farm.name,
          days: 7,
        })
        .expect(200);
      const after = await latest(farm.id);
      expect(after.status).toBe('ACTIVE');
      expect(
        Math.round((after.expiresAt!.getTime() - Date.now()) / 86_400_000),
      ).toBe(7);
    });

    it('bounds the number of days', async () => {
      const farm = await makeFarm();
      const path = `/admin/farms/${farm.id}/subscription`;
      await as(billing)
        .post(`${path}/extend`, { reason, confirm: farm.name, days: 0 })
        .expect(400);
      await as(billing)
        .post(`${path}/extend`, { reason, confirm: farm.name, days: 4000 })
        .expect(400);
      await as(billing)
        .post(`${path}/comp`, { reason, confirm: farm.name, planId, days: 366 })
        .expect(400);
    });
  });
});

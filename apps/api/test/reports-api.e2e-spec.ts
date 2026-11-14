import request from 'supertest';
import { REPORT_QUEUE } from '../src/modules/reports/application/ports/report-ports';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { SubscriptionAccessService } from '../src/modules/subscription/application/services/subscription-access.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';
import { LegalConsentService } from '../src/modules/compliance/application/services/legal-consent.service';
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from '../src/modules/media/application/ports/object-storage.port';
import {
  AuthedUser,
  bearer,
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  loginAs,
  TestContext,
  ThrowawayOwner,
} from './utils/e2e';

const FARM_A_NAME = 'E2E Reports API Farm A';
const FARM_B_NAME = 'E2E Reports API Farm B';
const TEMP_TEMPLATE_MIN_VERSION = 900000;

/**
 * RPT-08 — Reports v2 API (`/reports`). Rows are inserted straight through Prisma; the REPORT_QUEUE
 * provider is overridden with a no-op fake so no real worker races the assertions (create leaves the
 * row QUEUED). Preview uses the real compute service; its concurrency cap is a unit test.
 * Throwaway farm + custom roles give full control over finance.read and the owner check.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Reports API (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let storage: ObjectStoragePort;
  let tenant: ThrowawayOwner; // farm A (throwaway)
  let other: ThrowawayOwner; // farm B (throwaway) for cross-farm checks
  let templateVersionId: string;
  let tempTemplateId: string | null = null;
  let originalSubscription: {
    subscriptionPlanId: string;
    status: string;
    expiresAt: Date | null;
  } | null = null;
  const enqueued: string[] = [];

  let noFin: AuthedUser; // reports.read/create/delete, NO finance.read, custom (non-Owner) role
  let withFin: AuthedUser; // reports.read/create + finance.read
  let removed: AuthedUser;
  let demoOwner: AuthedUser;
  let demoManager: AuthedUser;
  let demoWorker: AuthedUser;

  const createdUserIds: string[] = [];
  const api = (p: string) => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  async function addMember(
    farmId: string,
    roleName: string,
    permissionKeys: string[],
  ): Promise<{ auth: AuthedUser; userId: string }> {
    const password = 'MemberPass123';
    const email = `e2e-rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@rakhal.test`;
    const user = await prisma.user.create({
      data: {
        email,
        name: 'E2E Reports Member',
        passwordHash: await ctx.app.get(PasswordService).hashPassword(password),
        isEmailVerified: true,
      },
      select: { id: true },
    });
    createdUserIds.push(user.id);
    await ctx.app.get(LegalConsentService).recordConsent(user.id, []);
    const perms = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true },
    });
    const role = await prisma.role.create({
      data: {
        name: `${roleName}-${Math.random().toString(36).slice(2, 6)}`,
        farmId,
        isSystemRole: false,
        permissions: {
          create: perms.map((p) => ({ permissionId: p.id })),
        },
      },
    });
    await prisma.farmMember.create({
      data: { farmId, userId: user.id, roleId: role.id },
    });
    const login = await request(server())
      .post(api('/auth/login'))
      .send({ email, password, farmId });
    const token = (login.body as { data?: { accessToken?: string } }).data
      ?.accessToken;
    if (!token) throw new Error('member login failed');
    return { auth: { token, farmId }, userId: user.id };
  }

  async function insertReport(
    farmId: string,
    over: Record<string, unknown> = {},
  ) {
    return prisma.report.create({
      data: {
        farmId,
        origin: 'ON_DEMAND',
        type: 'ON_DEMAND',
        templateVersionId,
        periodStart: new Date('2026-09-30T18:00:00Z'),
        periodEnd: new Date('2026-10-31T18:00:00Z'),
        periodStartDate: '2026-10-01',
        periodEndDate: '2026-10-31',
        timezone: 'Asia/Dhaka',
        scope: { kind: 'ALL_ELIGIBLE' },
        selectedMetricIds: ['milk.total_yield'],
        status: 'QUEUED',
        ...over,
      } as never,
    });
  }

  async function insertCompleted(
    farmId: string,
    over: Record<string, unknown> = {},
  ) {
    const row = await insertReport(farmId, { status: 'COMPLETED', ...over });
    await prisma.reportSnapshot.create({
      data: {
        reportId: row.id,
        payload: { includesFinance: false, sections: [], exceptions: [] },
        schemaVersion: 1,
        calcVersion: 1,
        templateVersion: 1,
        includesFinance: Boolean(over.includesFinance),
      },
    });
    return row;
  }

  /** Removes leftovers of earlier crashed runs (identified by this spec's unique farm names / emails). */
  async function purgeLeftovers() {
    const farms = await prisma.farm.findMany({
      where: { name: { in: [FARM_A_NAME, FARM_B_NAME] } },
      select: { id: true },
    });
    for (const { id: farmId } of farms) {
      const members = await prisma.farmMember.findMany({
        where: { farmId },
        select: { userId: true },
      });
      await prisma.report.deleteMany({ where: { farmId } });
      await prisma.farmMember.deleteMany({ where: { farmId } });
      await prisma.rolePermission.deleteMany({ where: { role: { farmId } } });
      await prisma.role.deleteMany({ where: { farmId } });
      for (const m of members) {
        await deleteThrowawayOwner(prisma, { userId: m.userId, farmId });
      }
    }
    const stale = await prisma.user.findMany({
      where: { email: { startsWith: 'e2e-rpt-' } },
      select: { id: true },
    });
    for (const u of stale) {
      await prisma.user.delete({ where: { id: u.id } }).catch(() => undefined);
    }
    const temps = await prisma.reportTemplateVersion.findMany({
      where: { type: 'ON_DEMAND', version: { gte: TEMP_TEMPLATE_MIN_VERSION } },
      select: { id: true },
    });
    for (const t of temps) {
      await prisma.report.deleteMany({ where: { templateVersionId: t.id } });
      await prisma.reportTemplateVersion.delete({ where: { id: t.id } });
    }
  }

  beforeAll(async () => {
    ctx = await createTestApp({
      configure: (builder) =>
        builder.overrideProvider(REPORT_QUEUE).useValue({
          enqueue: (id: string) => {
            enqueued.push(id);
            return Promise.resolve();
          },
        }),
    });
    prisma = ctx.app.get(PrismaService);
    await purgeLeftovers();
    storage = ctx.app.get<ObjectStoragePort>(OBJECT_STORAGE);
    tenant = await createThrowawayOwner(ctx, prisma, FARM_A_NAME);
    other = await createThrowawayOwner(ctx, prisma, FARM_B_NAME);
    // Reports generation is a Pro feature; move the throwaway farm onto Pro.
    const pro = await prisma.subscriptionPlan.findFirst({
      where: { name: 'Pro' },
      select: { id: true },
    });
    if (!pro) throw new Error('Pro plan missing: run pnpm seed');
    originalSubscription = await prisma.farmSubscription.findFirst({
      where: { farmId: tenant.farmId },
      select: { subscriptionPlanId: true, status: true, expiresAt: true },
    });
    await prisma.farmSubscription.updateMany({
      where: { farmId: tenant.farmId },
      data: { subscriptionPlanId: pro.id, status: 'ACTIVE', expiresAt: null },
    });
    await ctx.app.get(SubscriptionAccessService).invalidateFarm(tenant.farmId);
    let tpl = await prisma.reportTemplateVersion.findFirst({
      where: { type: 'ON_DEMAND', effectiveFrom: { lte: new Date() } },
      orderBy: { version: 'desc' },
    });
    if (!tpl) {
      // The seeded v1 may start at a future farm-local midnight; use a test-only effective copy.
      const seed = await prisma.reportTemplateVersion.findFirst({
        where: { type: 'ON_DEMAND' },
        orderBy: { version: 'desc' },
      });
      if (!seed) throw new Error('ON_DEMAND template missing: run migrations');
      tpl = await prisma.reportTemplateVersion.create({
        data: {
          type: 'ON_DEMAND',
          version:
            TEMP_TEMPLATE_MIN_VERSION + Math.floor(Math.random() * 90000),
          definition: seed.definition as never,
          effectiveFrom: new Date(Date.now() - 3_600_000),
        },
      });
      tempTemplateId = tpl.id;
    }
    templateVersionId = tpl.id;

    noFin = (
      await addMember(tenant.farmId, 'NoFin', [
        'reports.read',
        'reports.create',
        'reports.delete',
      ])
    ).auth;
    withFin = (
      await addMember(tenant.farmId, 'WithFin', [
        'reports.read',
        'reports.create',
        'finance.read',
      ])
    ).auth;
    removed = (await addMember(tenant.farmId, 'Removed', ['reports.read']))
      .auth;

    demoOwner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    demoManager = await loginAs(
      ctx,
      'manager@demo.rakhal.test',
      'ManagerPass123',
    );
    demoWorker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
  }, 60_000);

  afterAll(async () => {
    if (originalSubscription) {
      await prisma.farmSubscription
        .updateMany({
          where: { farmId: tenant.farmId },
          data: originalSubscription as never,
        })
        .catch(() => undefined);
    }
    if (!tenant || !other) {
      await ctx?.app.close();
      return;
    }
    for (const f of [tenant.farmId, other.farmId]) {
      await prisma.report
        .deleteMany({ where: { farmId: f } })
        .catch(() => undefined);
      await prisma.farmMember
        .deleteMany({ where: { farmId: f } })
        .catch(() => undefined);
      await prisma.rolePermission
        .deleteMany({ where: { role: { farmId: f } } })
        .catch(() => undefined);
      await prisma.role
        .deleteMany({ where: { farmId: f } })
        .catch(() => undefined);
    }
    if (tempTemplateId) {
      await prisma.report
        .deleteMany({ where: { templateVersionId: tempTemplateId } })
        .catch(() => undefined);
      await prisma.reportTemplateVersion
        .delete({ where: { id: tempTemplateId } })
        .catch(() => undefined);
    }
    await deleteThrowawayOwner(prisma, tenant);
    await deleteThrowawayOwner(prisma, other);
    for (const id of createdUserIds) {
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
    await ctx.app.close();
  }, 60_000);

  describe('RBAC', () => {
    it('worker gets 403 on every route', async () => {
      const w = bearer(demoWorker);
      const cfg = {
        templateId: 'on-demand',
        period: { preset: 'this_month' },
        scope: { kind: 'ALL_ELIGIBLE' },
        selectedMetricIds: ['milk.total_yield'],
      };
      const calls = [
        request(server())
          .get(api('/reports/templates'))
          .set(...w),
        request(server())
          .get(api('/reports'))
          .set(...w),
        request(server())
          .get(api('/reports/someid'))
          .set(...w),
        request(server())
          .get(api('/reports/someid/download'))
          .set(...w),
        request(server())
          .post(api('/reports/preview'))
          .set(...w)
          .send(cfg),
        request(server())
          .post(api('/reports'))
          .set(...w)
          .send(cfg),
        request(server())
          .post(api('/reports/someid/retry'))
          .set(...w),
        request(server())
          .delete(api('/reports/someid'))
          .set(...w),
      ];
      for (const res of await Promise.all(calls)) {
        expect(res.status).toBe(403);
      }
    });

    it('manager can list; cannot delete (403)', async () => {
      await request(server())
        .get(api('/reports'))
        .set(...bearer(demoManager))
        .expect(200);
      await request(server())
        .delete(api('/reports/anything'))
        .set(...bearer(demoManager))
        .expect(403);
    });

    it('a role that holds reports.delete but is not the Owner still gets 403 (explicit owner check)', async () => {
      const row = await insertCompleted(tenant.farmId);
      const res = await request(server())
        .delete(api(`/reports/${row.id}`))
        .set(...bearer(noFin))
        .expect(403);
      expect(JSON.stringify(res.body)).toContain('REPORT_OWNER_ONLY');
      const still = await prisma.report.findUnique({ where: { id: row.id } });
      expect(still?.deletedAt).toBeNull();
    });

    it('owner deletes (soft) and the report 404s everywhere afterwards', async () => {
      const row = await insertCompleted(tenant.farmId, {
        artifactKey: `e2e/${Date.now()}-del.pdf`,
        artifactContentType: 'application/pdf',
      });
      await storage.put({
        key: row.artifactKey as string,
        body: Buffer.from('%PDF-del'),
        contentType: 'application/pdf',
      });
      await request(server())
        .delete(api(`/reports/${row.id}`))
        .set(...bearer(tenant.owner))
        .expect(200);
      const after = await prisma.report.findUnique({ where: { id: row.id } });
      expect(after?.deletedAt).not.toBeNull();
      for (const path of [
        `/reports/${row.id}`,
        `/reports/${row.id}/download`,
      ]) {
        await request(server())
          .get(api(path))
          .set(...bearer(tenant.owner))
          .expect(404);
      }
      const list = await request(server())
        .get(api('/reports?limit=100'))
        .set(...bearer(tenant.owner))
        .expect(200);
      expect(
        (list.body.data as Array<{ id: string }>).some((r) => r.id === row.id),
      ).toBe(false);
      await request(server())
        .delete(api(`/reports/${row.id}`))
        .set(...bearer(tenant.owner))
        .expect(404);
    });
  });

  describe('tenancy and finance visibility', () => {
    it('a report of another farm is 404 on detail/download/retry/delete (same shape as missing)', async () => {
      const foreign = await insertCompleted(other.farmId);
      const missing = await request(server())
        .get(api('/reports/does-not-exist'))
        .set(...bearer(tenant.owner))
        .expect(404);
      for (const [method, path] of [
        ['get', `/reports/${foreign.id}`],
        ['get', `/reports/${foreign.id}/download`],
        ['post', `/reports/${foreign.id}/retry`],
        ['delete', `/reports/${foreign.id}`],
      ] as const) {
        const res = await request(server())
          [method](api(path))
          .set(...bearer(tenant.owner))
          .expect(404);
        expect(res.body.message).toBe(missing.body.message);
        expect(res.body.code).toBe(missing.body.code);
      }
      const list = await request(server())
        .get(api('/reports?limit=100'))
        .set(...bearer(tenant.owner))
        .expect(200);
      expect(
        (list.body.data as Array<{ id: string }>).some(
          (r) => r.id === foreign.id,
        ),
      ).toBe(false);
    });

    it('finance reports are hidden from a user without finance.read (list, detail, download)', async () => {
      const fin = await insertCompleted(tenant.farmId, {
        includesFinance: true,
        selectedMetricIds: ['finance.cash_received'],
        artifactKey: `e2e/${Date.now()}-fin.pdf`,
        artifactContentType: 'application/pdf',
      });
      const plain = await insertCompleted(tenant.farmId);

      const hidden = await request(server())
        .get(api('/reports?limit=100'))
        .set(...bearer(noFin))
        .expect(200);
      const hiddenIds = (hidden.body.data as Array<{ id: string }>).map(
        (r) => r.id,
      );
      expect(hiddenIds).toContain(plain.id);
      expect(hiddenIds).not.toContain(fin.id);
      await request(server())
        .get(api(`/reports/${fin.id}`))
        .set(...bearer(noFin))
        .expect(404);
      await request(server())
        .get(api(`/reports/${fin.id}/download`))
        .set(...bearer(noFin))
        .expect(404);

      const visible = await request(server())
        .get(api('/reports?limit=100'))
        .set(...bearer(withFin))
        .expect(200);
      expect(
        (visible.body.data as Array<{ id: string }>).map((r) => r.id),
      ).toContain(fin.id);
      await request(server())
        .get(api(`/reports/${fin.id}`))
        .set(...bearer(withFin))
        .expect(200);
    });

    it('catalogue omits finance metrics without finance.read and lists them with it', async () => {
      const without = await request(server())
        .get(api('/reports/templates'))
        .set(...bearer(noFin))
        .expect(200);
      expect(JSON.stringify(without.body.data)).not.toMatch(/"id":"finance\./);
      const withIt = await request(server())
        .get(api('/reports/templates'))
        .set(...bearer(withFin))
        .expect(200);
      expect(JSON.stringify(withIt.body.data)).toMatch(/"id":"finance\./);
      expect(withIt.body.data.onDemand.id).toBe(templateVersionId);
    });

    it('explicitly requesting a finance metric without finance.read is a 403, not a silent drop', async () => {
      const res = await request(server())
        .post(api('/reports'))
        .set(...bearer(noFin))
        .send({
          templateId: 'on-demand',
          period: { preset: 'this_month' },
          scope: { kind: 'ALL_ELIGIBLE' },
          selectedMetricIds: ['milk.total_yield', 'finance.cash_received'],
        })
        .expect(403);
      expect(JSON.stringify(res.body)).toContain('REPORT_FINANCE_FORBIDDEN');
    });
  });

  describe('detail and download', () => {
    it('detail returns the payload only when COMPLETED and never a storage key', async () => {
      const done = await insertCompleted(tenant.farmId, {
        artifactKey: 'e2e/secret-key.pdf',
        artifactContentType: 'application/pdf',
      });
      const queued = await insertReport(tenant.farmId, { status: 'QUEUED' });
      const d = await request(server())
        .get(api(`/reports/${done.id}`))
        .set(...bearer(tenant.owner))
        .expect(200);
      expect(d.body.data.payload).toBeTruthy();
      expect(d.body.data.hasPdf).toBe(true);
      expect(JSON.stringify(d.body)).not.toContain('secret-key');
      const q = await request(server())
        .get(api(`/reports/${queued.id}`))
        .set(...bearer(tenant.owner))
        .expect(200);
      expect(q.body.data.payload).toBeNull();
    });

    it('download answers 409 REPORT_PDF_NOT_AVAILABLE when there is no artifact', async () => {
      const row = await insertCompleted(tenant.farmId);
      const res = await request(server())
        .get(api(`/reports/${row.id}/download`))
        .set(...bearer(tenant.owner))
        .expect(409);
      expect(JSON.stringify(res.body)).toContain('REPORT_PDF_NOT_AVAILABLE');
    });

    it('download streams the bytes with a safe filename and no storage key', async () => {
      const key = `e2e/${Date.now()}-dl-secret.pdf`;
      const row = await insertCompleted(tenant.farmId, {
        artifactKey: key,
        artifactContentType: 'application/pdf',
      });
      await storage.put({
        key,
        body: Buffer.from('%PDF-1.4 e2e'),
        contentType: 'application/pdf',
      });
      const res = await request(server())
        .get(api(`/reports/${row.id}/download`))
        .set(...bearer(tenant.owner))
        .expect(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="report-on_demand-2026-10-01_2026-10-31.pdf"',
      );
      expect(JSON.stringify(res.headers)).not.toContain('secret');
    });
  });

  describe('retry', () => {
    const failedRow = (over: Record<string, unknown> = {}) =>
      insertReport(tenant.farmId, {
        status: 'FAILED',
        errorCategory: 'RENDER_FAILED',
        errorMessage: 'boom',
        ...over,
      });

    it('only a FAILED report can be retried (409 REPORT_NOT_RETRYABLE otherwise)', async () => {
      for (const status of ['COMPLETED', 'QUEUED'] as const) {
        const row = await insertReport(tenant.farmId, {
          status,
          createdAt: new Date(Date.now() - 3_600_000),
        });
        const res = await request(server())
          .post(api(`/reports/${row.id}/retry`))
          .set(...bearer(tenant.owner))
          .expect(409);
        expect(JSON.stringify(res.body)).toContain('REPORT_NOT_RETRYABLE');
        const after = await prisma.report.findUnique({ where: { id: row.id } });
        expect(after?.status).toBe(status);
        expect(after?.manualRetries).toBe(0);
      }
    });

    it('a FAILED report goes back to QUEUED, counts one manual retry, is enqueued and audited', async () => {
      const failed = await failedRow();
      const res = await request(server())
        .post(api(`/reports/${failed.id}/retry`))
        .set(...bearer(tenant.owner))
        .expect(201);
      expect(res.body.data.status).toBe('QUEUED');
      expect(res.body.data.errorMessage).toBeNull();
      const after = await prisma.report.findUnique({
        where: { id: failed.id },
      });
      expect(after?.status).toBe('QUEUED');
      expect(after?.manualRetries).toBe(1);
      expect(enqueued).toContain(failed.id);
      expect(
        await prisma.auditLog.count({
          where: { action: 'REPORT_RETRIED', entityId: failed.id },
        }),
      ).toBe(1);
    });

    it('stops at the retry limit with 409 REPORT_RETRY_LIMIT and changes nothing', async () => {
      const failed = await failedRow({ manualRetries: 3 });
      const res = await request(server())
        .post(api(`/reports/${failed.id}/retry`))
        .set(...bearer(tenant.owner))
        .expect(409);
      expect(JSON.stringify(res.body)).toContain('REPORT_RETRY_LIMIT');
      const after = await prisma.report.findUnique({
        where: { id: failed.id },
      });
      expect(after?.status).toBe('FAILED');
      expect(after?.manualRetries).toBe(3);
    });
  });

  describe('delete while processing', () => {
    it('a PROCESSING report inside the lease is 409 REPORT_PROCESSING and stays', async () => {
      const row = await insertReport(tenant.farmId, {
        status: 'PROCESSING',
        startedAt: new Date(),
      });
      const res = await request(server())
        .delete(api(`/reports/${row.id}`))
        .set(...bearer(tenant.owner))
        .expect(409);
      expect(JSON.stringify(res.body)).toContain('REPORT_PROCESSING');
      const after = await prisma.report.findUnique({ where: { id: row.id } });
      expect(after?.deletedAt).toBeNull();
    });

    it('a stale PROCESSING report can be deleted', async () => {
      const row = await insertReport(tenant.farmId, {
        status: 'PROCESSING',
        startedAt: new Date(Date.now() - 3_600_000),
      });
      await request(server())
        .delete(api(`/reports/${row.id}`))
        .set(...bearer(tenant.owner))
        .expect(200);
    });
  });

  describe('create and preview', () => {
    beforeEach(async () => {
      // This farm is ours alone: drop in-flight rows left by earlier tests so the cap is exact.
      await prisma.report.deleteMany({
        where: {
          farmId: tenant.farmId,
          status: { in: ['QUEUED', 'PROCESSING'] },
        },
      });
    });

    const cfg = (over: Record<string, unknown> = {}) => ({
      templateId: 'on-demand',
      period: { preset: 'this_week' },
      scope: { kind: 'ALL_ELIGIBLE' },
      selectedMetricIds: ['milk.total_yield', 'health.cases_opened'],
      ...over,
    });

    it('validates the body (whitelist, caps, custom range)', async () => {
      await request(server())
        .post(api('/reports'))
        .set(...bearer(tenant.owner))
        .send({ ...cfg(), farmId: tenant.farmId })
        .expect(400);
      await request(server())
        .post(api('/reports'))
        .set(...bearer(tenant.owner))
        .send(
          cfg({
            period: {
              preset: 'custom',
              customStartDate: '2024-01-01',
              customEndDate: '2026-10-01',
            },
          }),
        )
        .expect(400);
      await request(server())
        .post(api('/reports'))
        .set(...bearer(tenant.owner))
        .send(cfg({ selectedMetricIds: ['milk.nope'] }))
        .expect(400);
      await request(server())
        .post(api('/reports'))
        .set(...bearer(tenant.owner))
        .send(
          cfg({
            scope: { kind: 'SINGLE_COW', cattleId: 'cow-of-another-farm' },
          }),
        )
        .expect(404);
    });

    it('creates a QUEUED row (201), enqueues it once and stores a request hash', async () => {
      const res = await request(server())
        .post(api('/reports'))
        .set(...bearer(tenant.owner))
        .send(cfg({ selectedMetricIds: ['milk.avg_daily_yield'] }))
        .expect(201);
      expect(res.body.data.duplicate).toBe(false);
      expect(res.body.data.report.status).toBe('QUEUED');
      const id = res.body.data.report.id as string;
      expect(enqueued.filter((e) => e === id)).toHaveLength(1);
      const row = await prisma.report.findUnique({ where: { id } });
      expect(row?.requestHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('an identical request is a duplicate (200) and creates nothing', async () => {
      const body = cfg({ selectedMetricIds: ['health.cases_opened'] });
      const first = await request(server())
        .post(api('/reports'))
        .set(...bearer(tenant.owner))
        .send(body)
        .expect(201);
      const dup = await request(server())
        .post(api('/reports'))
        .set(...bearer(tenant.owner))
        .send(body)
        .expect(200);
      expect(dup.body.data.duplicate).toBe(true);
      expect(dup.body.data.existing.id).toBe(first.body.data.report.id);
    });

    it('Idempotency-Key replays the same report with exactly one row', async () => {
      const key = `e2e-key-${Date.now()}`;
      const body = cfg({ forceNew: true });
      const first = await request(server())
        .post(api('/reports'))
        .set(...bearer(tenant.owner))
        .set('Idempotency-Key', key)
        .send(body)
        .expect(201);
      const id = first.body.data.report.id as string;
      const replay = await request(server())
        .post(api('/reports'))
        .set(...bearer(tenant.owner))
        .set('Idempotency-Key', key)
        .send(body)
        .expect(200);
      expect(replay.body.data.replayed).toBe(true);
      expect(replay.body.data.report.id).toBe(id);
      expect(
        await prisma.report.count({
          where: { farmId: tenant.farmId, idempotencyKey: key },
        }),
      ).toBe(1);
      expect(enqueued.filter((e) => e === id)).toHaveLength(1);
    });

    it('the same Idempotency-Key with a different body is 409 REPORT_IDEMPOTENCY_CONFLICT', async () => {
      const key = `e2e-key-conflict-${Date.now()}`;
      await request(server())
        .post(api('/reports'))
        .set(...bearer(tenant.owner))
        .set('Idempotency-Key', key)
        .send(cfg({ forceNew: true }))
        .expect(201);
      const res = await request(server())
        .post(api('/reports'))
        .set(...bearer(tenant.owner))
        .set('Idempotency-Key', key)
        .send(
          cfg({ selectedMetricIds: ['milk.avg_daily_yield'], forceNew: true }),
        )
        .expect(409);
      expect(JSON.stringify(res.body)).toContain('REPORT_IDEMPOTENCY_CONFLICT');
      expect(
        await prisma.report.count({
          where: { farmId: tenant.farmId, idempotencyKey: key },
        }),
      ).toBe(1);
    });

    it('answers 429 REPORT_TOO_MANY_IN_FLIGHT at the cap, but ignores stale in-flight rows', async () => {
      for (let i = 0; i < 3; i++) {
        await insertReport(tenant.farmId, { status: 'QUEUED' });
      }
      const body = cfg({
        selectedMetricIds: ['milk.total_yield'],
        forceNew: true,
      });
      const blocked = await request(server())
        .post(api('/reports'))
        .set(...bearer(tenant.owner))
        .send(body)
        .expect(429);
      expect(JSON.stringify(blocked.body)).toContain(
        'REPORT_TOO_MANY_IN_FLIGHT',
      );

      await prisma.report.updateMany({
        where: { farmId: tenant.farmId, status: 'QUEUED' },
        data: { createdAt: new Date(Date.now() - 3_600_000) },
      });
      await request(server())
        .post(api('/reports'))
        .set(...bearer(tenant.owner))
        .send(body)
        .expect(201);
    });

    it('rejects an impossible calendar date, end before start, and a >366 day range with 400', async () => {
      const bad = async (from: string, to: string, code: string) => {
        const res = await request(server())
          .post(api('/reports'))
          .set(...bearer(tenant.owner))
          .send(
            cfg({
              period: {
                preset: 'custom',
                customStartDate: from,
                customEndDate: to,
              },
            }),
          )
          .expect(400);
        expect(JSON.stringify(res.body)).toContain('REPORT_INVALID_PERIOD');
        expect(JSON.stringify(res.body)).toContain(code);
      };
      await bad('2026-02-31', '2026-03-05', 'INVALID_DATE');
      await bad('2026-03-05', '2026-03-01', 'INVALID_RANGE');
      await bad('2025-01-01', '2026-12-31', 'RANGE_TOO_LONG');
    });

    it('preview returns a payload and persists nothing', async () => {
      const before = await prisma.report.count({
        where: { farmId: tenant.farmId },
      });
      const res = await request(server())
        .post(api('/reports/preview'))
        .set(...bearer(noFin))
        .send(cfg({ selectedMetricIds: ['milk.total_yield'] }));
      expect(res.status).toBe(201);
      expect(res.body.data.includesFinance).toBe(false);
      expect(res.body.data.sections.length).toBeGreaterThan(0);
      expect(
        await prisma.report.count({ where: { farmId: tenant.farmId } }),
      ).toBe(before);
    }, 30_000);
  });

  describe('revoked members', () => {
    it('a removed member is refused on list, detail and download', async () => {
      const row = await insertCompleted(tenant.farmId);
      await request(server())
        .get(api('/reports'))
        .set(...bearer(removed))
        .expect(200);
      await prisma.farmMember.deleteMany({
        where: {
          farmId: tenant.farmId,
          role: { name: { startsWith: 'Removed' } },
        },
      });
      for (const path of [
        '/reports',
        `/reports/${row.id}`,
        `/reports/${row.id}/download`,
      ]) {
        const res = await request(server())
          .get(api(path))
          .set(...bearer(removed));
        expect([401, 403]).toContain(res.status);
      }
    });
  });

  // Demo-farm owner smoke: confirms the real seeded Owner passes both delete checks.
  it('seeded demo owner passes the explicit owner check (404 for a missing id, not 403)', async () => {
    await request(server())
      .delete(api('/reports/does-not-exist'))
      .set(...bearer(demoOwner))
      .expect(404);
  });
});

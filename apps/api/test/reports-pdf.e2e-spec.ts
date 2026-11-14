import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { LoggerService } from '../src/core/logger/logger/logger.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';
import { LegalConsentService } from '../src/modules/compliance/application/services/legal-consent.service';
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from '../src/modules/media/application/ports/object-storage.port';
import { SubscriptionAccessService } from '../src/modules/subscription/application/services/subscription-access.service';
import { ReportLifecycleService } from '../src/modules/reports/application/pipeline/report-lifecycle.service';
import { SAFE_ERROR_MESSAGE } from '../src/modules/reports/application/pipeline/report-pipeline.constants';
import {
  REPORT_QUEUE,
  type ReportQueue,
} from '../src/modules/reports/application/ports/report-ports';
import { ReportScheduleService } from '../src/modules/reports/application/scheduling/report-schedule.service';
import type { ReportSnapshotPayload } from '../src/modules/reports/domain/contracts/snapshot';
import { buildReportLayout } from '../src/modules/reports/infrastructure/renderer/report-layout';
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

/**
 * RPT-14a: the WHOLE Reports v2 path with real components and no fakes:
 * POST /reports -> real BullMQ queue + real worker (`ReportsProcessor`) -> real compute -> snapshot ->
 * real `PdfReportRenderer` -> artifact in `OBJECT_STORAGE` -> `GET /reports/:id/download` returns a PDF.
 *
 * Under NODE_ENV=test `OBJECT_STORAGE` is the `MemoryStorageAdapter`, whose store is a process-wide
 * static Map. The worker runs in the same process as the app under test (same jest worker, `--runInBand`),
 * so downloads see the artifacts the worker wrote. A separate API process would NOT see them: never split
 * the worker from the download assertions.
 *
 * Demo-farm rows are identified ONLY by the `e2e-rpt-pdf-` Idempotency-Key prefix (every demo-farm create
 * here uses `forceNew` + a key), so cleanup never touches reports this spec did not create.
 * Requires the dev stack (Postgres + Redis) up + `pnpm seed`.
 */
jest.setTimeout(240_000);

const FARM_A_NAME = 'E2E Reports PDF Farm A';
const FARM_B_NAME = 'E2E Reports PDF Farm B';
const KEY_PREFIX = 'e2e-rpt-pdf-';
const MEMBER_PREFIX = 'e2e-rptpdf-';
const POLL_MS = 1000;
const WORKER_TIMEOUT_MS = 90_000;
const FAIL_TIMEOUT_MS = 30_000;
const CUID_LIKE = /^c[a-z0-9]{20,30}$/;

interface ReportView {
  id: string;
  status: string;
  errorCategory: string | null;
  errorMessage: string | null;
  includesFinance: boolean;
  hasPdf: boolean;
  pdfBytes: number | null;
  manualRetries?: number;
  payload: ReportSnapshotPayload | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ymd = (d: Date) => d.toISOString().slice(0, 10);

function binaryParser(
  res: NodeJS.ReadableStream,
  cb: (err: Error | null, body: Buffer) => void,
) {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

describe('Reports v2 real worker + PDF path (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let storage: ObjectStoragePort;
  let queue: ReportQueue;
  let logger: LoggerService;
  let demoOwner: AuthedUser;
  let demoManager: AuthedUser;
  let demoWorker: AuthedUser;
  let demoFarmName: string;
  let tenant: ThrowawayOwner; // farm A: scheduled + failure + hidden-from-no-finance
  let other: ThrowawayOwner; // farm B: owns the "cross-farm" group
  let noFin: AuthedUser; // member of farm A without finance.read
  let tenantOnProBackup: { plan: string } | null = null;
  const createdUserIds: string[] = [];
  const startedAt = Date.now();

  // Shared state between the sequential steps.
  let range: { from: string; to: string };
  let baseBody: Record<string, unknown>;
  let plainId: string;
  let plainPayload: ReportSnapshotPayload;
  let financeId: string;
  let financePayload: ReportSnapshotPayload;

  const api = (p: string) => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  let keySeq = 0;
  const nextKey = (tag: string) =>
    `${KEY_PREFIX}${tag}-${Date.now()}-${keySeq++}`;

  const get = (path: string, who: AuthedUser) =>
    request(server())
      .get(api(path))
      .set(...bearer(who));

  function create(
    who: AuthedUser,
    body: Record<string, unknown>,
    key?: string,
  ) {
    let req = request(server())
      .post(api('/reports'))
      .set(...bearer(who));
    if (key) req = req.set('Idempotency-Key', key);
    return req.send(body);
  }

  async function detail(who: AuthedUser, id: string): Promise<ReportView> {
    const res = await get(`/reports/${id}`, who).expect(200);
    return res.body.data as ReportView;
  }

  /** Polls GET /reports/:id until `done(view)`; fails with the last status/errorCategory on timeout. */
  async function pollApi(
    who: AuthedUser,
    id: string,
    done: (v: ReportView) => boolean,
    timeoutMs: number,
  ): Promise<ReportView> {
    const deadline = Date.now() + timeoutMs;
    let last: ReportView | null = null;
    while (Date.now() < deadline) {
      last = await detail(who, id);
      if (done(last)) return last;
      await sleep(POLL_MS);
    }
    throw new Error(
      `report ${id} not in the expected state after ${timeoutMs} ms: status=${last?.status} errorCategory=${last?.errorCategory} errorMessage=${last?.errorMessage}`,
    );
  }

  async function pollDb(
    ids: string[],
    status: 'COMPLETED' | 'FAILED',
    timeoutMs: number,
  ) {
    const deadline = Date.now() + timeoutMs;
    let rows: Array<{
      id: string;
      status: string;
      errorCategory: string | null;
    }> = [];
    while (Date.now() < deadline) {
      rows = await prisma.report.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true, errorCategory: true },
      });
      if (rows.length === ids.length && rows.every((r) => r.status === status))
        return;
      await sleep(POLL_MS);
    }
    throw new Error(
      `reports not all ${status} after ${timeoutMs} ms: ${JSON.stringify(rows)}`,
    );
  }

  async function downloadPdf(who: AuthedUser, id: string) {
    return get(`/reports/${id}/download`, who)
      .buffer(true)
      .parse(binaryParser as never);
  }

  function expectRealPdf(res: request.Response) {
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    const body = res.body as Buffer;
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(body.length).toBeGreaterThan(5 * 1024);
    expect(res.headers['content-length']).toBe(String(body.length));
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="report-(on_demand|weekly|monthly)-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.pdf"$/,
    );
    return body;
  }

  async function addMember(
    farmId: string,
    roleName: string,
    permissionKeys: string[],
  ): Promise<AuthedUser> {
    const password = 'MemberPass123';
    const email = `${MEMBER_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}@rakhal.test`;
    const user = await prisma.user.create({
      data: {
        email,
        name: 'E2E Reports PDF Member',
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
        permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
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
    return { token, farmId };
  }

  async function removeFarmData(farmId: string) {
    const reports = await prisma.report.findMany({
      where: { farmId },
      select: { artifactKey: true },
    });
    for (const r of reports) {
      if (r.artifactKey) await storage.delete(r.artifactKey).catch(() => {});
    }
    await prisma.report.deleteMany({ where: { farmId } });
    // Created lazily by compute (farm settings read); blocks Farm.delete otherwise.
    await prisma.farmModuleSettings.deleteMany({ where: { farmId } });
    await prisma.milkLogEntry.deleteMany({ where: { farmId } });
    await prisma.animalGroupMember.deleteMany({ where: { farmId } });
    await prisma.animalGroup.deleteMany({ where: { farmId } });
    await prisma.cattle.deleteMany({ where: { farmId } });
    await prisma.farmSubscription.deleteMany({ where: { farmId } });
    await prisma.breed.deleteMany({ where: { farmId } });
    await prisma.rolePermission.deleteMany({ where: { role: { farmId } } });
    await prisma.farmMember.deleteMany({ where: { farmId } });
    await prisma.role.deleteMany({ where: { farmId } });
  }

  async function purgeLeftovers() {
    // Demo farm: only rows carrying this spec's idempotency-key prefix.
    const mine = await prisma.report.findMany({
      where: { idempotencyKey: { startsWith: KEY_PREFIX } },
      select: { id: true, artifactKey: true },
    });
    for (const r of mine) {
      if (r.artifactKey) await storage.delete(r.artifactKey).catch(() => {});
    }
    await prisma.report.deleteMany({
      where: { id: { in: mine.map((r) => r.id) } },
    });
    const farms = await prisma.farm.findMany({
      where: { name: { in: [FARM_A_NAME, FARM_B_NAME] } },
      select: { id: true, ownerId: true },
    });
    for (const f of farms) {
      await removeFarmData(f.id);
      await deleteThrowawayOwner(prisma, { userId: f.ownerId, farmId: f.id });
    }
    const stale = await prisma.user.findMany({
      where: { email: { startsWith: MEMBER_PREFIX } },
      select: { id: true },
    });
    for (const u of stale) {
      await prisma.user.delete({ where: { id: u.id } }).catch(() => undefined);
    }
  }

  async function setPro(farmId: string) {
    const pro = await prisma.subscriptionPlan.findFirstOrThrow({
      where: { name: 'Pro' },
      select: { id: true },
    });
    await prisma.farmSubscription.deleteMany({ where: { farmId } });
    await prisma.farmSubscription.create({
      data: {
        farmId,
        subscriptionPlanId: pro.id,
        status: 'ACTIVE',
        startsAt: new Date('2020-01-01'),
      },
    });
    await ctx.app.get(SubscriptionAccessService).invalidateFarm(farmId);
  }

  beforeAll(async () => {
    // REAL queue, REAL worker, REAL renderer, in-memory object storage (NODE_ENV=test).
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    storage = ctx.app.get<ObjectStoragePort>(OBJECT_STORAGE);
    queue = ctx.app.get<ReportQueue>(REPORT_QUEUE);
    logger = await ctx.app.resolve(LoggerService);
    await purgeLeftovers();

    demoOwner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    demoManager = await loginAs(
      ctx,
      'manager@demo.rakhal.test',
      'ManagerPass123',
    );
    demoWorker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    demoFarmName = (
      await prisma.farm.findUniqueOrThrow({
        where: { id: demoOwner.farmId },
        select: { name: true },
      })
    ).name;

    tenant = await createThrowawayOwner(ctx, prisma, FARM_A_NAME);
    other = await createThrowawayOwner(ctx, prisma, FARM_B_NAME);
    await prisma.farm.updateMany({
      where: { id: { in: [tenant.farmId, other.farmId] } },
      data: { createdAt: new Date('2020-01-01T00:00:00Z') },
    });
    await setPro(tenant.farmId);
    tenantOnProBackup = { plan: 'Pro' };
    noFin = await addMember(tenant.farmId, 'NoFin', [
      'reports.read',
      'reports.create',
    ]);

    const today = new Date();
    range = {
      from: ymd(new Date(today.getTime() - 14 * 86_400_000)),
      to: ymd(new Date(today.getTime() - 1 * 86_400_000)),
    };
    baseBody = {
      templateId: 'on-demand',
      period: {
        preset: 'custom',
        customStartDate: range.from,
        customEndDate: range.to,
      },
      scope: { kind: 'ALL_ELIGIBLE' },
      selectedMetricIds: [
        'milk.total_yield',
        'milk.top_cow_avg_yield',
        'milk.bottom_cow_avg_yield',
        'feed.offered_minus_refusal_kg',
        'health.cases_opened',
      ],
      forceNew: true,
    };
  }, 120_000);

  afterAll(async () => {
    if (prisma && storage) {
      await purgeLeftovers().catch(() => undefined);
      for (const f of [tenant, other]) {
        if (!f) continue;
        await removeFarmData(f.farmId).catch(() => undefined);
        await deleteThrowawayOwner(prisma, f);
      }
      for (const id of createdUserIds) {
        await prisma.user.delete({ where: { id } }).catch(() => undefined);
      }
    }
    await ctx?.app.close();
    void tenantOnProBackup;

    console.info(`reports-pdf e2e total ${(Date.now() - startedAt) / 1000}s`);
  }, 120_000);

  // ── 1. real worker path, no finance ─────────────────────────────────────

  describe('1. real worker path (no finance)', () => {
    it('create -> worker -> COMPLETED within 90 s', async () => {
      const res = await create(demoOwner, baseBody, nextKey('plain')).expect(
        201,
      );
      expect(res.body.data.duplicate).toBe(false);
      expect(res.body.data.report.status).toBe('QUEUED');
      expect(res.body.data.report.includesFinance).toBe(false);
      plainId = res.body.data.report.id as string;

      const done = await pollApi(
        demoOwner,
        plainId,
        (v) => v.status === 'COMPLETED' || v.status === 'FAILED',
        WORKER_TIMEOUT_MS,
      );
      expect(done.status).toBe('COMPLETED');
      expect(done.hasPdf).toBe(true);
      expect(done.includesFinance).toBe(false);
      plainPayload = done.payload as ReportSnapshotPayload;
      expect(plainPayload).toBeTruthy();
    });

    it('the PDF downloads as a real PDF', async () => {
      const body = expectRealPdf(await downloadPdf(demoOwner, plainId));
      const view = await detail(demoOwner, plainId);
      expect(view.pdfBytes).toBe(body.length);
      // Same process as the worker: the artifact is in the shared in-memory store.
      const key = (
        await prisma.report.findUniqueOrThrow({
          where: { id: plainId },
          select: { artifactKey: true },
        })
      ).artifactKey as string;
      expect(key).toBe(`reports/${demoOwner.farmId}/${plainId}.pdf`);
      expect((await storage.get(key)).length).toBe(body.length);
    });

    it('detail carries the snapshot payload (farm, period, sections, reportType, no finance)', () => {
      const p = plainPayload;
      expect(p.farm.name).toBe(demoFarmName);
      expect(p.period.startDate).toBe(range.from);
      expect(p.period.endDate).toBe(range.to);
      expect(p.reportType).toBe('ON_DEMAND');
      expect(p.includesFinance).toBe(false);
      expect(p.scope).toEqual({ kind: 'ALL_ELIGIBLE' });
      expect(p.sections.length).toBeGreaterThan(0);
      const domains = p.sections.map((s) => s.domain);
      expect(domains).toEqual(expect.arrayContaining(['milk', 'health']));
      expect(domains).not.toContain('finance');
      expect(p.dataQuality).toBeDefined();
      expect(Array.isArray(p.exceptions)).toBe(true);
    });

    it('cow-keyed rows carry tag labels, never raw ids', () => {
      const rows = plainPayload.sections
        .flatMap((s) => s.metrics)
        .filter((m) => /^milk\.(top|bottom)_cow_avg_yield$/.test(m.metricId))
        .flatMap((m) => m.rows ?? []);
      if (rows.length === 0) {
        // Structure-only: the demo farm has no milk rows inside the range this run.

        console.warn('no milk cow rows in range: label assertions skipped');
        return;
      }
      for (const r of rows) {
        expect(r.label).toBeTruthy();
        expect(r.label as string).not.toMatch(CUID_LIKE);
        expect(r.label).not.toBe(r.key);
      }
    });

    it('the real layout has no finance block, BDT unit or finance source label', () => {
      const layout = buildReportLayout(plainPayload);
      const text = JSON.stringify(layout);
      expect(layout.kind).toBe('snapshot');
      expect(layout.farmName).toBe(demoFarmName);
      expect(layout.meta.some((m) => m.label === 'Currency')).toBe(false);
      expect(text).not.toContain('BDT');
      expect(text).not.toContain('৳');
      expect(text).not.toMatch(/cash_ledger|expense_accrual|ledgerFeed5000/);
      expect(text).not.toMatch(/Cash received|Cash paid|Net cash flow/i);
    });
  });

  // ── 2. finance path + RBAC ─────────────────────────────────────────────

  describe('2. finance path', () => {
    it('owner creates a finance report: COMPLETED, includesFinance true, PDF downloadable', async () => {
      const body = {
        ...baseBody,
        selectedMetricIds: [
          'milk.total_yield',
          'finance.cash_received',
          'finance.expenses_total',
        ],
      };
      const res = await create(demoOwner, body, nextKey('fin')).expect(201);
      expect(res.body.data.report.includesFinance).toBe(true);
      financeId = res.body.data.report.id as string;
      const done = await pollApi(
        demoOwner,
        financeId,
        (v) => v.status === 'COMPLETED' || v.status === 'FAILED',
        WORKER_TIMEOUT_MS,
      );
      expect(done.status).toBe('COMPLETED');
      expect(done.includesFinance).toBe(true);
      financePayload = done.payload as ReportSnapshotPayload;
      expect(financePayload.includesFinance).toBe(true);
      expectRealPdf(await downloadPdf(demoOwner, financeId));
    });

    it('finance and finance-free layouts differ: the finance section exists only here', () => {
      expect(plainPayload.sections.some((s) => s.domain === 'finance')).toBe(
        false,
      );
      expect(financePayload.sections.some((s) => s.domain === 'finance')).toBe(
        true,
      );
      const plain = JSON.stringify(buildReportLayout(plainPayload));
      const fin = buildReportLayout(financePayload);
      expect(JSON.stringify(fin)).not.toBe(plain);
      expect(fin.meta.some((m) => m.label === 'Currency')).toBe(true);
      expect(plain).not.toContain('BDT');
    });

    it('the demo manager (finance.read) sees and downloads the finance report', async () => {
      const v = await detail(demoManager, financeId);
      expect(v.includesFinance).toBe(true);
      expectRealPdf(await downloadPdf(demoManager, financeId));
    });

    it('the demo worker gets 403 on every report route', async () => {
      const w = bearer(demoWorker);
      const cfg = { ...baseBody };
      const calls = [
        request(server())
          .get(api('/reports/templates'))
          .set(...w),
        request(server())
          .get(api('/reports'))
          .set(...w),
        request(server())
          .get(api(`/reports/${financeId}`))
          .set(...w),
        request(server())
          .get(api(`/reports/${financeId}/download`))
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
          .post(api(`/reports/${financeId}/retry`))
          .set(...w),
        request(server())
          .delete(api(`/reports/${financeId}`))
          .set(...w),
      ];
      for (const res of await Promise.all(calls)) expect(res.status).toBe(403);
    });
  });

  // ── 3. duplicate + delete ──────────────────────────────────────────────

  describe('3. duplicate and delete', () => {
    it('repeating the same request is duplicate:true and creates no second row', async () => {
      const mineBefore = await prisma.report.count({
        where: { idempotencyKey: { startsWith: KEY_PREFIX } },
      });
      const { forceNew: _ignored, ...same } = baseBody;
      void _ignored;
      const res = await create(demoOwner, same).expect(200);
      expect(res.body.data.duplicate).toBe(true);
      expect(res.body.data.existing.id).toBe(plainId);
      expect(
        await prisma.report.count({
          where: { idempotencyKey: { startsWith: KEY_PREFIX } },
        }),
      ).toBe(mineBefore);
    });

    it('owner DELETE -> 200; detail and download are 404; the artifact is gone', async () => {
      const before = await prisma.report.findUniqueOrThrow({
        where: { id: plainId },
        select: { artifactKey: true },
      });
      expect(before.artifactKey).toBeTruthy();
      await request(server())
        .delete(api(`/reports/${plainId}`))
        .set(...bearer(demoOwner))
        .expect(200);
      await get(`/reports/${plainId}`, demoOwner).expect(404);
      await get(`/reports/${plainId}/download`, demoOwner).expect(404);
      const after = await prisma.report.findUniqueOrThrow({
        where: { id: plainId },
      });
      expect(after.deletedAt).not.toBeNull();
      expect(after.artifactKey).toBeNull();
      await expect(storage.get(before.artifactKey as string)).rejects.toThrow();
    });
  });

  // ── 4. scheduled path ──────────────────────────────────────────────────

  describe('4. scheduled path (throwaway farm, real worker)', () => {
    const NOW = new Date('2026-10-24T10:00:00Z');
    let ids: string[] = [];

    it('sweep creates the periods, the real worker completes them with PDFs in storage', async () => {
      const cow = await prisma.cattle.create({
        data: {
          farmId: tenant.farmId,
          tagNumber: `E2E-PDF-${Date.now()}`,
          gender: 'FEMALE',
          createdBy: tenant.userId,
          createdAt: new Date('2020-01-01T00:00:00Z'),
        },
      });
      await prisma.milkLogEntry.create({
        data: {
          farmId: tenant.farmId,
          cattleId: cow.id,
          logDate: new Date('2026-10-14T00:00:00Z'),
          session: 'MORNING',
          yieldL: 8,
          disposition: 'SALEABLE',
          submitted: true,
          createdBy: tenant.userId,
        },
      });

      // Real queue (not a fake): the sweep's enqueue lands on the same queue the app's worker consumes.
      const schedule = new ReportScheduleService(
        prisma,
        ctx.app.get(SubscriptionAccessService),
        queue,
        new ReportLifecycleService(prisma, logger),
        logger,
      );
      const res = await schedule.sweep(NOW, { farmIds: [tenant.farmId] });
      expect(res).toMatchObject({ farms: 1, created: 4, errors: 0 });

      const rows = await prisma.report.findMany({
        where: { farmId: tenant.farmId, origin: 'SCHEDULED' },
      });
      ids = rows.map((r) => r.id);
      expect(rows).toHaveLength(4);
      await pollDb(ids, 'COMPLETED', WORKER_TIMEOUT_MS);

      const done = await prisma.report.findMany({
        where: { id: { in: ids } },
        include: { snapshot: { select: { includesFinance: true } } },
      });
      for (const r of done) {
        expect(r.requestedBy).toBeNull();
        expect(r.includesFinance).toBe(true);
        expect(r.snapshot?.includesFinance).toBe(true);
        expect(r.artifactKey).toBe(`reports/${tenant.farmId}/${r.id}.pdf`);
        const pdf = await storage.get(r.artifactKey as string);
        expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
        expect(pdf.length).toBeGreaterThan(5 * 1024);
      }
    });

    it('a user without finance.read gets 404 (detail, download) and no list entry; the owner downloads the PDF', async () => {
      const id = ids[0];
      await get(`/reports/${id}`, noFin).expect(404);
      await get(`/reports/${id}/download`, noFin).expect(404);
      const list = await get('/reports?limit=100', noFin).expect(200);
      const listed = (list.body.data as Array<{ id: string }>).map((r) => r.id);
      for (const scheduled of ids) expect(listed).not.toContain(scheduled);

      const ownerList = await get('/reports?limit=100', tenant.owner).expect(
        200,
      );
      const ownerIds = (ownerList.body.data as Array<{ id: string }>).map(
        (r) => r.id,
      );
      for (const scheduled of ids) expect(ownerIds).toContain(scheduled);
      expectRealPdf(await downloadPdf(tenant.owner, id));
    });

    it('the week holding the milk row has a labelled cow and a weekly layout', async () => {
      const week = await prisma.report.findFirstOrThrow({
        where: {
          farmId: tenant.farmId,
          type: 'WEEKLY',
          periodStartDate: '2026-10-12',
        },
        select: { id: true },
      });
      const v = await detail(tenant.owner, week.id);
      expect(v.payload?.reportType).toBe('WEEKLY');
      expect(buildReportLayout(v.payload as ReportSnapshotPayload).kind).toBe(
        'weekly',
      );
      const rows = (v.payload?.sections ?? [])
        .flatMap((s) => s.metrics)
        .filter((m) => /^milk\.(top|bottom)_cow_avg_yield$/.test(m.metricId))
        .flatMap((m) => m.rows ?? []);
      if (rows.length > 0) {
        for (const r of rows) {
          expect(r.label).toMatch(/^E2E-PDF-/);
        }
      }
    });
  });

  // ── 5. permanent failure ───────────────────────────────────────────────

  describe('5. permanent failure', () => {
    let failedId: string;

    it('a cross-farm group scope fails with INVALID_CONFIG and a fixed safe message', async () => {
      const foreignGroup = await prisma.animalGroup.create({
        data: { farmId: other.farmId, name: `E2E PDF group ${Date.now()}` },
      });
      const tpl = await prisma.reportTemplateVersion.findFirstOrThrow({
        where: { type: 'ON_DEMAND', effectiveFrom: { lte: new Date() } },
        orderBy: { version: 'desc' },
        select: { id: true },
      });
      const row = await prisma.report.create({
        data: {
          farmId: tenant.farmId,
          origin: 'ON_DEMAND',
          type: 'ON_DEMAND',
          templateVersionId: tpl.id,
          periodStart: new Date('2026-09-30T18:00:00Z'),
          periodEnd: new Date('2026-10-31T18:00:00Z'),
          periodStartDate: '2026-10-01',
          periodEndDate: '2026-10-31',
          timezone: 'Asia/Dhaka',
          scope: {
            kind: 'GROUP',
            groupId: foreignGroup.id,
            membershipAsOf: new Date().toISOString(),
          },
          selectedMetricIds: ['milk.total_yield'],
          status: 'QUEUED',
          requestedBy: tenant.userId,
        },
      });
      failedId = row.id;
      await queue.enqueue(failedId);

      const v = await pollApi(
        tenant.owner,
        failedId,
        (r) => r.status === 'FAILED' || r.status === 'COMPLETED',
        FAIL_TIMEOUT_MS,
      );
      expect(v.status).toBe('FAILED');
      expect(v.errorCategory).toBe('INVALID_CONFIG');
      expect(v.errorMessage).toBe(SAFE_ERROR_MESSAGE.INVALID_CONFIG);
      expect(v.hasPdf).toBe(false);
      await get(`/reports/${failedId}/download`, tenant.owner).expect(409);
    });

    it('manual retry resets it to QUEUED (201), the worker fails it again, one manual retry is counted', async () => {
      const res = await request(server())
        .post(api(`/reports/${failedId}/retry`))
        .set(...bearer(tenant.owner))
        .expect(201);
      // The worker may already have picked the re-queued row up by the time the response is read.
      expect(['QUEUED', 'PROCESSING']).toContain(res.body.data.status);
      const v = await pollApi(
        tenant.owner,
        failedId,
        (r) => r.status === 'FAILED',
        FAIL_TIMEOUT_MS,
      );
      expect(v.errorCategory).toBe('INVALID_CONFIG');
      const row = await prisma.report.findUniqueOrThrow({
        where: { id: failedId },
      });
      expect(row.manualRetries).toBe(1);
    });

    it('retrying a COMPLETED report is 409 REPORT_NOT_RETRYABLE', async () => {
      const completed = await prisma.report.findFirstOrThrow({
        where: { farmId: tenant.farmId, status: 'COMPLETED' },
        select: { id: true },
      });
      const res = await request(server())
        .post(api(`/reports/${completed.id}/retry`))
        .set(...bearer(tenant.owner))
        .expect(409);
      expect(JSON.stringify(res.body)).toContain('REPORT_NOT_RETRYABLE');
    });
  });
});

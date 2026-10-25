import type { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  loginAs,
  type AuthedUser,
  type TestContext,
  type ThrowawayOwner,
} from './utils/e2e';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  ReportGenerationService,
  ReportLifecycleService,
  ReportReconcileService,
} from '../src/modules/reports/application/pipeline';
import { REPORT_PROCESSING_LEASE_MS } from '../src/modules/reports/application/pipeline/report-pipeline.constants';
import type { LoggerService } from '../src/core/logger/logger/logger.service';
import { resolvePreset } from '../src/modules/reports/domain/period';
import type { ReportSnapshotPayload } from '../src/modules/reports/domain/contracts/snapshot';

/**
 * RPT-09 pipeline e2e. Drives the generation/lifecycle services directly (no dependence on Redis
 * worker timing) against the real DB: Report rows are inserted with Prisma for the seeded demo farm.
 */
describe('Reports v2 pipeline (e2e)', () => {
  let ctx: TestContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let generation: ReportGenerationService;
  let lifecycle: ReportLifecycleService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let other: ThrowawayOwner;
  let templateVersionId: string;
  let timezone: string;
  let period: ReturnType<typeof resolvePreset>;
  let cowId: string;
  let milkId: string;
  let foreignGroupId: string;
  const reportIds: string[] = [];
  const attempt = { attemptsMade: 0, maxAttempts: 3 };

  const allTemplateMetricIds = async (): Promise<string[]> => {
    const tv = await prisma.reportTemplateVersion.findUniqueOrThrow({
      where: { id: templateVersionId },
    });
    const def = tv.definition as {
      sections: Array<{ metricIds: string[] }>;
    };
    return def.sections.flatMap((s) => s.metricIds);
  };

  const createReport = async (over: {
    scope: object;
    includesFinance?: boolean;
    selectedMetricIds?: string[];
  }) => {
    const r = await prisma.report.create({
      data: {
        farmId: owner.farmId,
        origin: 'ON_DEMAND',
        type: 'WEEKLY',
        templateVersionId,
        periodStart: new Date(period.start),
        periodEnd: new Date(period.end),
        periodStartDate: period.startDate,
        periodEndDate: period.endDate,
        timezone,
        scope: over.scope,
        selectedMetricIds: over.selectedMetricIds ?? [
          'milk.total_yield',
          'milk.cows_with_data',
        ],
        includesFinance: over.includesFinance ?? false,
        requestedBy: ownerUserId,
      },
    });
    reportIds.push(r.id);
    return r;
  };

  const payloadOf = async (reportId: string) => {
    const s = await prisma.reportSnapshot.findUniqueOrThrow({
      where: { reportId },
    });
    return s.payload as unknown as ReportSnapshotPayload;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    prisma = app.get(PrismaService);
    generation = app.get(ReportGenerationService, { strict: false });
    lifecycle = app.get(ReportLifecycleService, { strict: false });
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    ownerUserId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'owner@demo.rakhal.test' },
        select: { id: true },
      })
    ).id;
    const farm = await prisma.farm.findUniqueOrThrow({
      where: { id: owner.farmId },
      select: { timezone: true },
    });
    timezone = farm.timezone;
    period = resolvePreset('custom', new Date(), timezone, {
      from: '2026-09-14',
      to: '2026-09-20',
    });
    templateVersionId = (
      await prisma.reportTemplateVersion.findFirstOrThrow({
        where: { type: 'WEEKLY', version: 1 },
        select: { id: true },
      })
    ).id;

    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-RPT09-${Date.now()}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    });
    cowId = cow.id;
    const milk = await prisma.milkLogEntry.create({
      data: {
        farmId: owner.farmId,
        cattleId: cowId,
        logDate: new Date('2026-09-15T00:00:00Z'),
        session: 'MORNING',
        yieldL: 10,
        disposition: 'SALEABLE',
        submitted: true,
        createdBy: ownerUserId,
      },
    });
    milkId = milk.id;

    other = await createThrowawayOwner(ctx, prisma, 'RPT09 foreign farm');
    foreignGroupId = (
      await prisma.animalGroup.create({
        data: { farmId: other.farmId, name: `foreign-${Date.now()}` },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.report
      .deleteMany({ where: { id: { in: reportIds } } })
      .catch(() => undefined);
    await prisma.milkLogEntry
      .deleteMany({ where: { id: milkId } })
      .catch(() => undefined);
    await prisma.cattle
      .deleteMany({ where: { id: cowId } })
      .catch(() => undefined);
    await prisma.animalGroup
      .deleteMany({ where: { id: foreignGroupId } })
      .catch(() => undefined);
    await deleteThrowawayOwner(prisma, other);
    await app.close();
  });

  it('generates a snapshot that stays immutable when source data changes later', async () => {
    const report = await createReport({
      scope: { kind: 'SINGLE_COW', cattleId: cowId },
    });
    await expect(generation.process(report.id, attempt)).resolves.toEqual({
      status: 'completed',
    });
    const row = await prisma.report.findUniqueOrThrow({
      where: { id: report.id },
    });
    expect(row.status).toBe('COMPLETED');
    expect(row.completedAt).not.toBeNull();
    expect(row.expiresAt!.getTime()).toBeGreaterThan(
      row.completedAt!.getTime(),
    );
    expect(row.errorCategory).toBeNull();

    const before = await payloadOf(report.id);
    const total = before.sections
      .flatMap((s) => s.metrics)
      .find((m) => m.metricId === 'milk.total_yield');
    expect(total?.value).toMatchObject({ state: 'value', value: 10 });

    await prisma.milkLogEntry.update({
      where: { id: milkId },
      data: { yieldL: 99 },
    });
    const after = await payloadOf(report.id);
    expect(after).toEqual(before);

    // The DB trigger also refuses direct edits of the snapshot.
    await expect(
      prisma.reportSnapshot.update({
        where: { reportId: report.id },
        data: { calcVersion: 99 },
      }),
    ).rejects.toThrow();
  });

  it('does not touch a COMPLETED row on a second process call', async () => {
    const report = await createReport({
      scope: { kind: 'SINGLE_COW', cattleId: cowId },
    });
    await generation.process(report.id, attempt);
    const first = await prisma.report.findUniqueOrThrow({
      where: { id: report.id },
    });
    await expect(generation.process(report.id, attempt)).resolves.toEqual({
      status: 'skipped',
    });
    const second = await prisma.report.findUniqueOrThrow({
      where: { id: report.id },
    });
    expect(second.completedAt).toEqual(first.completedAt);
    expect(second.attempts).toBe(first.attempts);
    expect(second.status).toBe('COMPLETED');
  });

  it('retry of a FAILED row reuses the existing snapshot', async () => {
    const report = await createReport({
      scope: { kind: 'SINGLE_COW', cattleId: cowId },
    });
    await generation.process(report.id, attempt);
    const snapshotBefore = await payloadOf(report.id);

    // Simulate a render/storage failure after the snapshot was captured.
    await prisma.report.update({
      where: { id: report.id },
      data: { status: 'FAILED', errorCategory: 'STORAGE_UNAVAILABLE' },
    });
    await expect(
      lifecycle.resetForRetry(report.id, other.farmId),
    ).resolves.toBe(false);
    await expect(
      lifecycle.resetForRetry(report.id, owner.farmId),
    ).resolves.toBe(true);
    const reset = await prisma.report.findUniqueOrThrow({
      where: { id: report.id },
    });
    expect(reset.status).toBe('QUEUED');
    expect(reset.errorCategory).toBeNull();

    // Source data changed meanwhile: a recompute would differ.
    await prisma.milkLogEntry.update({
      where: { id: milkId },
      data: { yieldL: 5 },
    });
    await expect(generation.process(report.id, attempt)).resolves.toEqual({
      status: 'completed',
    });
    expect(await payloadOf(report.id)).toEqual(snapshotBefore);
    expect(
      await prisma.reportSnapshot.count({ where: { reportId: report.id } }),
    ).toBe(1);
  });

  it('fails INVALID_CONFIG for a group id from another farm (no snapshot, safe message)', async () => {
    const report = await createReport({
      scope: {
        kind: 'GROUP',
        groupId: foreignGroupId,
        membershipAsOf: new Date().toISOString(),
      },
    });
    await expect(generation.process(report.id, attempt)).resolves.toEqual({
      status: 'failed',
      category: 'INVALID_CONFIG',
    });
    const row = await prisma.report.findUniqueOrThrow({
      where: { id: report.id },
    });
    expect(row.status).toBe('FAILED');
    expect(row.errorCategory).toBe('INVALID_CONFIG');
    expect(row.errorMessage).toBeTruthy();
    expect(row.errorMessage).not.toContain(foreignGroupId);
    expect(row.errorMessage).not.toContain(other.farmId);
    expect(
      await prisma.reportSnapshot.count({ where: { reportId: report.id } }),
    ).toBe(0);
  });

  it('includeFinance=false report has no finance content even if finance ids were selected', async () => {
    const ids = await allTemplateMetricIds();
    const report = await createReport({
      scope: { kind: 'ALL_ELIGIBLE' },
      includesFinance: false,
      selectedMetricIds: ids,
    });
    await expect(generation.process(report.id, attempt)).resolves.toEqual({
      status: 'completed',
    });
    const payload = await payloadOf(report.id);
    expect(payload.includesFinance).toBe(false);
    expect(payload.sections.some((s) => s.domain === 'finance')).toBe(false);
    expect(JSON.stringify(payload)).not.toMatch(/"finance\./);
    expect(JSON.stringify(payload)).not.toContain('BDT');
  });

  it('includeFinance=true report carries the finance section', async () => {
    const ids = await allTemplateMetricIds();
    const report = await createReport({
      scope: { kind: 'ALL_ELIGIBLE' },
      includesFinance: true,
      selectedMetricIds: ids,
    });
    await expect(generation.process(report.id, attempt)).resolves.toEqual({
      status: 'completed',
    });
    const payload = await payloadOf(report.id);
    expect(payload.includesFinance).toBe(true);
    expect(payload.sections.some((s) => s.domain === 'finance')).toBe(true);
  });

  describe('stuck rows, fencing and deletion (RPT-09b)', () => {
    const ensured: string[] = [];
    let reconcile: ReportReconcileService;
    const cow = () => ({ kind: 'SINGLE_COW', cattleId: cowId });

    beforeAll(() => {
      reconcile = new ReportReconcileService(
        prisma,
        {
          ensureJob: (id: string) => {
            ensured.push(id);
            return Promise.resolve(true);
          },
        },
        {
          setContext() {
            return this;
          },
          info: () => undefined,
          warn: () => undefined,
        } as unknown as LoggerService,
      );
    });

    it('reconcile re-queues a PROCESSING row past its lease and fails an exhausted one', async () => {
      const old = new Date(Date.now() - REPORT_PROCESSING_LEASE_MS - 60_000);
      const a = await createReport({ scope: cow() });
      const b = await createReport({ scope: cow() });
      await prisma.report.update({
        where: { id: a.id },
        data: { status: 'PROCESSING', startedAt: old, attempts: 1 },
      });
      await prisma.report.update({
        where: { id: b.id },
        data: { status: 'PROCESSING', startedAt: old, attempts: 3 },
      });
      const out = await reconcile.reconcile(new Date());
      expect(out.requeued).toBeGreaterThanOrEqual(1);
      expect(out.failed).toBeGreaterThanOrEqual(1);
      expect(ensured).toContain(a.id);
      const ra = await prisma.report.findUniqueOrThrow({ where: { id: a.id } });
      const rb = await prisma.report.findUniqueOrThrow({ where: { id: b.id } });
      expect(ra.status).toBe('QUEUED');
      expect(rb.status).toBe('FAILED');
      expect(rb.errorCategory).toBe('GENERATION_FAILED');
    });

    it('a fresh-lease redelivery is delayed, not completed or skipped', async () => {
      const r = await createReport({ scope: cow() });
      await prisma.report.update({
        where: { id: r.id },
        data: { status: 'PROCESSING', startedAt: new Date(), attempts: 1 },
      });
      const out = await generation.process(r.id, attempt);
      expect(out.status).toBe('delayed');
      const row = await prisma.report.findUniqueOrThrow({
        where: { id: r.id },
      });
      expect(row.status).toBe('PROCESSING');
    });

    it('a stale worker (old claim token) cannot overwrite the new owner', async () => {
      const r = await createReport({ scope: cow() });
      const t1 = new Date(Date.now() - 1000);
      const claim1 = await lifecycle.claim(r.id, t1);
      expect(claim1.claimed).toBe(true);
      // Lease reclaimed by a second worker.
      await prisma.report.update({
        where: { id: r.id },
        data: {
          startedAt: new Date(Date.now() - 2 * REPORT_PROCESSING_LEASE_MS),
        },
      });
      const t2 = new Date();
      const claim2 = await lifecycle.claim(r.id, t2);
      expect(claim2.claimed).toBe(true);
      await expect(
        lifecycle.markCompleted(r.id, t1, new Date(), new Date(), null),
      ).resolves.toBe(false);
      await expect(
        lifecycle.markFailed(r.id, t1, 'RENDER_FAILED', new Date()),
      ).resolves.toBe(false);
      await expect(
        lifecycle.markRetryable(r.id, t1, 'DB_TIMEOUT'),
      ).resolves.toBe(false);
      await expect(
        lifecycle.markCompleted(r.id, t2, new Date(), new Date(), null),
      ).resolves.toBe(true);
    });

    it('resetForRetry bumps manualRetries and honours the cap', async () => {
      const r = await createReport({ scope: cow() });
      await prisma.report.update({
        where: { id: r.id },
        data: { status: 'FAILED', manualRetries: 2 },
      });
      await expect(
        lifecycle.resetForRetry(r.id, owner.farmId, 2),
      ).resolves.toBe(false);
      await expect(
        lifecycle.resetForRetry(r.id, owner.farmId, 3),
      ).resolves.toBe(true);
      const row = await prisma.report.findUniqueOrThrow({
        where: { id: r.id },
      });
      expect(row.manualRetries).toBe(3);
      expect(row.status).toBe('QUEUED');
    });

    it('a report deleted before generation is skipped: no snapshot, not completed', async () => {
      const r = await createReport({ scope: cow() });
      await prisma.report.update({
        where: { id: r.id },
        data: { deletedAt: new Date() },
      });
      await expect(generation.process(r.id, attempt)).resolves.toEqual({
        status: 'skipped',
      });
      const row = await prisma.report.findUniqueOrThrow({
        where: { id: r.id },
      });
      expect(row.status).not.toBe('COMPLETED');
      expect(
        await prisma.reportSnapshot.count({ where: { reportId: r.id } }),
      ).toBe(0);
    });

    it('deleted during processing: markCompleted refuses and nothing is resurrected', async () => {
      const r = await createReport({ scope: cow() });
      const token = new Date();
      await lifecycle.claim(r.id, token);
      await prisma.report.update({
        where: { id: r.id },
        data: { deletedAt: new Date() },
      });
      await expect(
        lifecycle.markCompleted(r.id, token, new Date(), new Date(), null),
      ).resolves.toBe(false);
      const row = await prisma.report.findUniqueOrThrow({
        where: { id: r.id },
      });
      expect(row.status).toBe('PROCESSING');
    });
  });
});

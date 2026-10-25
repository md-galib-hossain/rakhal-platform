import type { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  type TestContext,
  type ThrowawayOwner,
} from './utils/e2e';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { LoggerService } from '../src/core/logger/logger/logger.service';
import { SubscriptionAccessService } from '../src/modules/subscription/application/services/subscription-access.service';
import { ReportLifecycleService } from '../src/modules/reports/application/pipeline/report-lifecycle.service';
import { ReportScheduleService } from '../src/modules/reports/application/scheduling/report-schedule.service';
import { ReportRetentionService } from '../src/modules/reports/application/scheduling/report-retention.service';
import { PgAdvisoryJobLock } from '../src/modules/reports/infrastructure/cron/report-job-lock';
import type { ObjectStoragePort } from '../src/modules/media/application/ports/object-storage.port';

/**
 * RPT-10 scheduler/retention e2e. Services are constructed from the booted app's real Prisma/Subscription/
 * Logger and called directly (never waiting for cron), with a fake queue and fake storage. Every sweep is
 * restricted with `farmIds` to the throwaway farms this spec creates, so no other farm in the dev DB is touched.
 */
describe('Reports v2 scheduler + retention (e2e)', () => {
  let ctx: TestContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let access: SubscriptionAccessService;
  let schedule: ReportScheduleService;
  let lock: PgAdvisoryJobLock;
  let logger: LoggerService;
  let farmA: ThrowawayOwner; // entitled (Pro)
  let farmB: ThrowawayOwner; // not entitled, then suspended
  let proPlanId: string;
  let weeklyTemplateId: string;
  const enqueue = jest.fn().mockResolvedValue(undefined);
  const V2 = 98;
  // Far-future "now" values so the temporary template v2 (effectiveFrom 2099) is invisible to the live API.
  const FUTURE_FIRST = new Date('2099-01-05T12:00:00Z');
  const FUTURE_NEXT = new Date('2099-01-12T12:00:00Z');
  const NOW = new Date('2026-10-24T10:00:00Z');

  const sweepA = (now: Date) =>
    schedule.sweep(now, { farmIds: [farmA.farmId] });
  const reportsOf = (farmId: string) =>
    prisma.report.findMany({
      where: { farmId },
      orderBy: [{ type: 'asc' }, { periodStartDate: 'asc' }],
    });
  const wipeReports = async (farmId: string) => {
    await prisma.report.deleteMany({ where: { farmId } });
  };
  const setPlan = async (
    farmId: string,
    planId: string | null,
    status: 'ACTIVE' | 'EXPIRED' = 'ACTIVE',
  ) => {
    await prisma.farmSubscription.deleteMany({ where: { farmId } });
    if (planId) {
      await prisma.farmSubscription.create({
        data: {
          farmId,
          subscriptionPlanId: planId,
          status,
          startsAt: new Date('2020-01-01'),
        },
      });
    }
    await access.invalidateFarm(farmId);
  };

  const purgeLeftovers = async () => {
    const tv = await prisma.reportTemplateVersion.findMany({
      where: { type: 'WEEKLY', version: V2 },
      select: { id: true },
    });
    for (const t of tv) {
      await prisma.report.deleteMany({ where: { templateVersionId: t.id } });
      await prisma.reportTemplateVersion.delete({ where: { id: t.id } });
    }
    const stale = await prisma.farm.findMany({
      where: { name: { startsWith: 'RPT10 e2e' } },
      select: { id: true, ownerId: true },
    });
    for (const f of stale) {
      await prisma.report.deleteMany({ where: { farmId: f.id } });
      await prisma.milkLogEntry.deleteMany({ where: { farmId: f.id } });
      await prisma.cattle.deleteMany({ where: { farmId: f.id } });
      await prisma.farmSubscription.deleteMany({ where: { farmId: f.id } });
      await prisma.breed.deleteMany({ where: { farmId: f.id } });
      await deleteThrowawayOwner(prisma, { userId: f.ownerId, farmId: f.id });
    }
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    prisma = app.get(PrismaService);
    access = app.get(SubscriptionAccessService, { strict: false });
    logger = await app.resolve(LoggerService);
    schedule = new ReportScheduleService(
      prisma,
      access,
      { enqueue },
      new ReportLifecycleService(prisma, logger),
      logger,
    );
    lock = new PgAdvisoryJobLock(prisma);

    await purgeLeftovers();

    proPlanId = (
      await prisma.subscriptionPlan.findFirstOrThrow({
        where: { name: 'Pro' },
        select: { id: true },
      })
    ).id;
    weeklyTemplateId = (
      await prisma.reportTemplateVersion.findFirstOrThrow({
        where: { type: 'WEEKLY', version: 1 },
        select: { id: true },
      })
    ).id;

    farmA = await createThrowawayOwner(ctx, prisma, 'RPT10 e2e farm A');
    farmB = await createThrowawayOwner(ctx, prisma, 'RPT10 e2e farm B');
    // Old enough that the fixed test periods are not "before the farm existed".
    await prisma.farm.updateMany({
      where: { id: { in: [farmA.farmId, farmB.farmId] } },
      data: { createdAt: new Date('2020-01-01T00:00:00Z') },
    });
    await setPlan(farmA.farmId, proPlanId);
    await setPlan(farmB.farmId, proPlanId, 'EXPIRED');
  });

  afterAll(async () => {
    if (prisma) {
      await purgeLeftovers().catch(() => undefined);
      for (const f of [farmA, farmB]) {
        if (!f) continue;
        await prisma.farmSubscription.deleteMany({
          where: { farmId: f.farmId },
        });
        await prisma.breed.deleteMany({ where: { farmId: f.farmId } });
        await deleteThrowawayOwner(prisma, f);
      }
    }
    await app?.close();
  });

  beforeEach(async () => {
    enqueue.mockClear();
    await wipeReports(farmA.farmId);
  });

  describe('sweep', () => {
    it('re-queues a FAILED scheduled report under the cap and leaves an exhausted one FAILED', async () => {
      await sweepA(NOW);
      const rows = await reportsOf(farmA.farmId);
      const weekly = rows.filter((r) => r.type === 'WEEKLY');
      await prisma.report.update({
        where: { id: weekly[0].id },
        data: { status: 'FAILED', manualRetries: 1 },
      });
      await prisma.report.update({
        where: { id: weekly[1].id },
        data: { status: 'FAILED', manualRetries: 2 },
      });
      enqueue.mockClear();
      const res = await sweepA(NOW);
      expect(res).toMatchObject({ retriedFailed: 1, failedExhausted: 1 });
      expect(enqueue).toHaveBeenCalledWith(weekly[0].id);
      const after = await prisma.report.findMany({
        where: { id: { in: [weekly[0].id, weekly[1].id] } },
        select: { id: true, status: true, manualRetries: true },
      });
      const byId = new Map(after.map((r) => [r.id, r]));
      expect(byId.get(weekly[0].id)).toMatchObject({
        status: 'QUEUED',
        manualRetries: 2,
      });
      expect(byId.get(weekly[1].id)).toMatchObject({
        status: 'FAILED',
        manualRetries: 2,
      });
    });

    it('creates exactly one report per farm/type/period and a second sweep creates none', async () => {
      const first = await sweepA(NOW);
      expect(first).toMatchObject({
        farms: 1,
        created: 4,
        alreadyExists: 0,
        errors: 0,
      });
      const second = await sweepA(NOW);
      expect(second).toMatchObject({ created: 0, alreadyExists: 4 });

      const rows = await reportsOf(farmA.farmId);
      expect(rows).toHaveLength(4);
      expect(rows.map((r) => `${r.type}:${r.periodStartDate}`).sort()).toEqual([
        'MONTHLY:2026-08-01',
        'MONTHLY:2026-09-01',
        'WEEKLY:2026-10-05',
        'WEEKLY:2026-10-12',
      ]);
      for (const r of rows) {
        expect(r).toMatchObject({
          origin: 'SCHEDULED',
          requestedBy: null,
          status: 'QUEUED',
          includesFinance: true,
          expiresAt: null,
          timezone: 'Asia/Dhaka',
        });
        expect(r.scope).toEqual({ kind: 'ALL_ELIGIBLE' });
        expect(r.scheduledKey).toBe(
          `${farmA.farmId}:${r.type}:${r.periodStartDate}:v1`,
        );
      }
      expect(enqueue).toHaveBeenCalledTimes(4);
    });

    it('two concurrent sweeps still create one report per period', async () => {
      const [a, b] = await Promise.all([sweepA(NOW), sweepA(NOW)]);
      expect(a.created + b.created).toBe(4);
      expect(
        await prisma.report.count({ where: { farmId: farmA.farmId } }),
      ).toBe(4);
    });

    it('a template version published between periods applies to the next period only', async () => {
      const v2 = await prisma.reportTemplateVersion.create({
        data: {
          type: 'WEEKLY',
          version: V2,
          effectiveFrom: new Date('2099-01-06T00:00:00Z'),
          definition: (
            await prisma.reportTemplateVersion.findUniqueOrThrow({
              where: { id: weeklyTemplateId },
              select: { definition: true },
            })
          ).definition as object,
        },
      });
      await sweepA(FUTURE_FIRST); // v1 still the latest effective version
      const before = await prisma.report.findMany({
        where: { farmId: farmA.farmId, type: 'WEEKLY' },
        select: { periodStartDate: true, templateVersionId: true },
      });
      expect(before).toHaveLength(2);
      expect(
        before.every((r) => r.templateVersionId === weeklyTemplateId),
      ).toBe(true);

      await sweepA(FUTURE_NEXT); // v2 is now effective
      const after = await prisma.report.findMany({
        where: { farmId: farmA.farmId, type: 'WEEKLY' },
        select: {
          periodStartDate: true,
          templateVersionId: true,
          scheduledKey: true,
        },
        orderBy: { periodStartDate: 'asc' },
      });
      // The already-generated periods are NOT regenerated under v2; exactly one new period appears, on v2.
      expect(after).toHaveLength(3);
      const byVersion = after.filter((r) => r.templateVersionId === v2.id);
      expect(byVersion).toHaveLength(1);
      expect(byVersion[0].scheduledKey).toMatch(new RegExp(`:v${V2}$`));
      expect(
        after.filter((r) => r.templateVersionId === weeklyTemplateId),
      ).toHaveLength(2);
    });

    it('defers while unsubmitted milk drafts exist inside the wait window, then generates after it', async () => {
      const cow = await prisma.cattle.create({
        data: {
          farmId: farmA.farmId,
          tagNumber: `E2E-RPT10-${Date.now()}`,
          gender: 'FEMALE',
          createdBy: farmA.userId,
          createdAt: new Date('2020-01-01T00:00:00Z'),
        },
      });
      await prisma.milkLogEntry.create({
        data: {
          farmId: farmA.farmId,
          cattleId: cow.id,
          logDate: new Date('2026-10-14T00:00:00Z'),
          session: 'MORNING',
          yieldL: 8,
          disposition: 'SALEABLE',
          submitted: false,
          createdBy: farmA.userId,
        },
      });
      // Week 12-18 Oct closes at 2026-10-18T18:00Z (Dhaka); template wait is 6 h.
      const inside = await sweepA(new Date('2026-10-18T19:00:00Z'));
      expect(inside.deferred).toBe(1);
      expect(
        await prisma.report.count({
          where: {
            farmId: farmA.farmId,
            type: 'WEEKLY',
            periodStartDate: '2026-10-12',
          },
        }),
      ).toBe(0);

      const after = await sweepA(new Date('2026-10-19T01:00:00Z'));
      expect(after.deferred).toBe(0);
      expect(
        await prisma.report.count({
          where: {
            farmId: farmA.farmId,
            type: 'WEEKLY',
            periodStartDate: '2026-10-12',
          },
        }),
      ).toBe(1);

      await prisma.milkLogEntry.deleteMany({ where: { farmId: farmA.farmId } });
      await prisma.cattle.deleteMany({ where: { farmId: farmA.farmId } });
    });

    it('skips a farm that is not entitled, and a suspended farm', async () => {
      const notEntitled = await schedule.sweep(NOW, {
        farmIds: [farmB.farmId],
      });
      expect(notEntitled).toMatchObject({
        farms: 1,
        skippedNotEntitled: 1,
        created: 0,
      });

      await prisma.farm.update({
        where: { id: farmB.farmId },
        data: { status: 'SUSPENDED' },
      });
      await setPlan(farmB.farmId, proPlanId); // would be entitled, but suspended
      const suspended = await schedule.sweep(NOW, { farmIds: [farmB.farmId] });
      expect(suspended).toMatchObject({ farms: 0, created: 0 });
      expect(
        await prisma.report.count({ where: { farmId: farmB.farmId } }),
      ).toBe(0);
    });
  });

  describe('retention', () => {
    const mkStorage = (failKeys: string[] = []) => {
      const deleted: string[] = [];
      const storage = {
        provider: 'fake',
        isConfigured: () => true,
        put: jest.fn(),
        get: jest.fn(),
        getSignedUrl: jest.fn(),
        delete: jest.fn((key: string) => {
          if (failKeys.includes(key))
            return Promise.reject(new Error('storage down'));
          deleted.push(key);
          return Promise.resolve();
        }),
      } as unknown as ObjectStoragePort;
      return { storage, deleted };
    };
    const retentionWith = (storage: ObjectStoragePort) =>
      new ReportRetentionService(prisma, storage, logger);

    const day = 24 * 3600 * 1000;
    const mk = async (
      tag: string,
      over: Partial<{
        status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
        expiresAt: Date | null;
        deletedAt: Date | null;
        createdAt: Date;
        artifactKey: string | null;
        periodEnd: Date;
        manualRetries: number;
      }>,
      snapshot = true,
    ) => {
      const r = await prisma.report.create({
        data: {
          farmId: farmA.farmId,
          origin: 'SCHEDULED',
          type: 'WEEKLY',
          templateVersionId: weeklyTemplateId,
          periodStart: new Date('2026-01-05T00:00:00Z'),
          periodEnd: new Date('2026-01-12T00:00:00Z'),
          periodStartDate: '2026-01-05',
          periodEndDate: '2026-01-11',
          timezone: 'Asia/Dhaka',
          scope: { kind: 'ALL_ELIGIBLE' },
          selectedMetricIds: [],
          scheduledKey: `${farmA.farmId}:retention:${tag}`,
          status: 'COMPLETED',
          ...over,
        },
      });
      if (snapshot) {
        await prisma.reportSnapshot.create({
          data: {
            reportId: r.id,
            payload: { marker: tag },
            schemaVersion: 1,
            calcVersion: 1,
            templateVersion: 1,
            includesFinance: true,
          },
        });
      }
      return r.id;
    };
    const exists = async (id: string) =>
      (await prisma.report.count({ where: { id } })) === 1;
    const hasSnapshot = async (id: string) =>
      (await prisma.reportSnapshot.count({ where: { reportId: id } })) === 1;

    it('removes expired, soft-deleted-after-grace and old FAILED rows with their artifacts and snapshots, and leaves the rest', async () => {
      const now = new Date();
      const expired = await mk('expired', {
        expiresAt: new Date(now.getTime() - day),
        artifactKey: 'k-expired',
      });
      const softOld = await mk('soft-old', {
        deletedAt: new Date(now.getTime() - 8 * day),
        artifactKey: 'k-soft-old',
      });
      const failedOld = await mk('failed-old', {
        status: 'FAILED',
        createdAt: new Date(now.getTime() - 31 * day),
      });
      const softNew = await mk('soft-new', {
        deletedAt: new Date(now.getTime() - 2 * day),
        artifactKey: 'k-soft-new',
      });
      const live = await mk('live', {
        expiresAt: new Date(now.getTime() + 30 * day),
        artifactKey: 'k-live',
      });
      const failedNew = await mk('failed-new', {
        status: 'FAILED',
        createdAt: new Date(now.getTime() - 5 * day),
      });
      const processing = await mk('processing', {
        status: 'PROCESSING',
        expiresAt: new Date(now.getTime() - day),
        deletedAt: new Date(now.getTime() - 9 * day),
        artifactKey: 'k-processing',
      });

      const { storage, deleted } = mkStorage();
      const res = await retentionWith(storage).cleanup(now, {
        farmIds: [farmA.farmId],
      });
      expect(res).toMatchObject({ deleted: 3, storageFailures: 0 });

      for (const id of [expired, softOld, failedOld]) {
        expect(await exists(id)).toBe(false);
        expect(await hasSnapshot(id)).toBe(false);
      }
      for (const id of [softNew, live, failedNew, processing]) {
        expect(await exists(id)).toBe(true);
        expect(await hasSnapshot(id)).toBe(true);
      }
      expect(deleted.sort()).toEqual(['k-expired', 'k-soft-old']);
    });

    describe('tombstones (a deleted scheduled report is never regenerated)', () => {
      it('user soft-delete, retention at day 8, then sweep: no new row, tombstone kept and stripped', async () => {
        await sweepA(NOW);
        const target = await prisma.report.findFirstOrThrow({
          where: {
            farmId: farmA.farmId,
            type: 'WEEKLY',
            periodStartDate: '2026-10-12',
          },
        });
        await prisma.report.update({
          where: { id: target.id },
          data: {
            status: 'COMPLETED',
            artifactKey: 'k-tomb',
            deletedAt: NOW,
          },
        });
        await prisma.reportSnapshot.create({
          data: {
            reportId: target.id,
            payload: { marker: 'tomb' },
            schemaVersion: 1,
            calcVersion: 1,
            templateVersion: 1,
            includesFinance: true,
          },
        });
        const day8 = new Date(NOW.getTime() + 8 * day);
        const { storage, deleted } = mkStorage();
        const res = await retentionWith(storage).cleanup(day8, {
          farmIds: [farmA.farmId],
        });
        expect(res).toMatchObject({ deleted: 0, tombstoned: 1 });
        expect(deleted).toEqual(['k-tomb']);
        const kept = await prisma.report.findUniqueOrThrow({
          where: { id: target.id },
        });
        expect(kept.artifactKey).toBeNull();
        expect(kept.deletedAt).not.toBeNull();
        expect(await hasSnapshot(target.id)).toBe(false);

        enqueue.mockClear();
        const again = await sweepA(NOW);
        expect(again.created).toBe(0);
        expect(
          await prisma.report.count({
            where: {
              farmId: farmA.farmId,
              type: 'WEEKLY',
              periodStartDate: '2026-10-12',
            },
          }),
        ).toBe(1);
        // A second retention run does not touch the already-stripped tombstone.
        const second = await retentionWith(mkStorage().storage).cleanup(day8, {
          farmIds: [farmA.farmId],
        });
        expect(second).toMatchObject({ deleted: 0, tombstoned: 0 });
      });

      it('a FAILED scheduled row aged 31 days inside the window is kept and not regenerated beyond the retry cap', async () => {
        await sweepA(NOW);
        const target = await prisma.report.findFirstOrThrow({
          where: {
            farmId: farmA.farmId,
            type: 'WEEKLY',
            periodStartDate: '2026-10-05',
          },
        });
        await prisma.report.update({
          where: { id: target.id },
          data: {
            status: 'FAILED',
            manualRetries: 2,
            createdAt: new Date(NOW.getTime() - 31 * day),
          },
        });
        const { storage } = mkStorage();
        const res = await retentionWith(storage).cleanup(NOW, {
          farmIds: [farmA.farmId],
        });
        expect(res).toMatchObject({ deleted: 0, tombstoned: 0 });
        expect(await exists(target.id)).toBe(true);

        enqueue.mockClear();
        const sweep = await sweepA(NOW);
        expect(sweep).toMatchObject({
          created: 0,
          retriedFailed: 0,
          failedExhausted: 1,
        });
        expect(enqueue).not.toHaveBeenCalled();
        const after = await prisma.report.findUniqueOrThrow({
          where: { id: target.id },
        });
        expect(after.status).toBe('FAILED');
      });

      it('hard-deletes a scheduled row only once its periodEnd is older than 70 days', async () => {
        const inside = await mk('tomb-inside', {
          deletedAt: new Date(NOW.getTime() - 8 * day),
          periodEnd: new Date(NOW.getTime() - 69 * day),
          artifactKey: 'k-inside',
        });
        const outside = await mk('tomb-outside', {
          deletedAt: new Date(NOW.getTime() - 8 * day),
          periodEnd: new Date(NOW.getTime() - 71 * day),
          artifactKey: 'k-outside',
        });
        const failedOutside = await mk('tomb-failed-outside', {
          status: 'FAILED',
          createdAt: new Date(NOW.getTime() - 100 * day),
          periodEnd: new Date(NOW.getTime() - 71 * day),
        });
        const { storage } = mkStorage();
        await retentionWith(storage).cleanup(NOW, { farmIds: [farmA.farmId] });
        expect(await exists(inside)).toBe(true);
        expect(await hasSnapshot(inside)).toBe(false);
        expect(await exists(outside)).toBe(false);
        expect(await exists(failedOutside)).toBe(false);
      });
    });

    it('keeps the row (artifactKey intact) when the storage delete throws, and retries on the next run', async () => {
      const id = await mk('flaky', {
        expiresAt: new Date(Date.now() - day),
        artifactKey: 'k-flaky',
      });
      const failing = mkStorage(['k-flaky']);
      const first = await retentionWith(failing.storage).cleanup(new Date(), {
        farmIds: [farmA.farmId],
      });
      expect(first).toMatchObject({ deleted: 0, storageFailures: 1 });
      const kept = await prisma.report.findUniqueOrThrow({ where: { id } });
      expect(kept.artifactKey).toBe('k-flaky');
      expect(await hasSnapshot(id)).toBe(true);

      const ok = mkStorage();
      const second = await retentionWith(ok.storage).cleanup(new Date(), {
        farmIds: [farmA.farmId],
      });
      expect(second.deleted).toBe(1);
      expect(ok.deleted).toEqual(['k-flaky']);
      expect(await exists(id)).toBe(false);
    });
  });

  describe('cron advisory lock', () => {
    it('lets only one concurrent holder run a job and releases afterwards', async () => {
      const job = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const holder = lock.runExclusive(job, async () => {
        const inner = await lock.runExclusive(job, () =>
          Promise.resolve('should-not-run'),
        );
        expect(inner.acquired).toBe(false);
        await gate;
        return 'held';
      });
      // Give the holder time to take the lock and the inner attempt to fail, then let it finish.
      await new Promise((r) => setTimeout(r, 300));
      const concurrent = await lock.runExclusive(job, () =>
        Promise.resolve('nope'),
      );
      expect(concurrent.acquired).toBe(false);
      release();
      const outcome = await holder;
      expect(outcome).toEqual({ acquired: true, value: 'held' });

      const again = await lock.runExclusive(job, () => Promise.resolve('free'));
      expect(again).toEqual({ acquired: true, value: 'free' });
    });

    it('releases the lock when the job throws', async () => {
      const job = `e2e-throw-${Date.now()}`;
      await expect(
        lock.runExclusive(job, () => Promise.reject(new Error('x'))),
      ).rejects.toThrow('x');
      expect(
        (await lock.runExclusive(job, () => Promise.resolve(1))).acquired,
      ).toBe(true);
    });
  });
});

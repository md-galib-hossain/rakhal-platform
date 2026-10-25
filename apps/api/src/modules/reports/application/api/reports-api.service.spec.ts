/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- jest.fn().mock.calls are typed any; assertions inspect Prisma call shapes */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { METRIC_REGISTRY } from '../metrics/registry';
import { ReportsApiService } from './reports-api.service';
import type { ReportCaller } from './reports-api.types';
import {
  MAX_MANUAL_RETRIES,
  STALE_IN_FLIGHT_MINUTES,
  DUPLICATE_FRESH_MINUTES,
  PROCESSING_LEASE_MINUTES,
} from './reports-api.constants';
import { PreviewLimiter } from './preview-limiter';

const FARM = 'farm_a';
const OWNER: ReportCaller = {
  userId: 'u_owner',
  farmId: FARM,
  permissionsVersion: 1,
  roleName: 'Owner',
  isSystemRole: true,
};
const MANAGER: ReportCaller = {
  ...OWNER,
  userId: 'u_mgr',
  roleName: 'Manager',
};
/** A custom role literally named "Owner" must not pass the owner check. */
const FAKE_OWNER: ReportCaller = {
  ...MANAGER,
  roleName: 'Owner',
  isSystemRole: false,
};

const TEMPLATE_DEF = {
  type: 'ON_DEMAND',
  version: 1,
  thresholds: {},
  sections: [
    {
      id: 'milk',
      domain: 'milk',
      titleKey: 't',
      metricIds: ['milk.total_yield', 'milk.avg_daily_yield'],
    },
    {
      id: 'health',
      domain: 'health',
      titleKey: 't',
      metricIds: ['health.cases_opened', 'health.treatment_cost'],
    },
    {
      id: 'fin',
      domain: 'finance',
      titleKey: 't',
      metricIds: ['finance.cash_received'],
    },
  ],
};

function summaryRow(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    type: 'ON_DEMAND',
    origin: 'ON_DEMAND',
    status: 'COMPLETED',
    periodStartDate: '2026-10-01',
    periodEndDate: '2026-10-31',
    timezone: 'Asia/Dhaka',
    scope: { kind: 'ALL_ELIGIBLE' },
    selectedMetricIds: ['milk.total_yield'],
    includesFinance: false,
    attempts: 1,
    errorCategory: null,
    errorMessage: null,
    artifactKey: 'secret/key.pdf',
    artifactBytes: 10,
    createdAt: new Date(),
    startedAt: null,
    completedAt: new Date(),
    periodEnd: new Date('2026-10-31T18:00:00Z'),
    manualRetries: 0,
    expiresAt: null,
    templateVersion: { version: 1 },
    ...over,
  };
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

function build(opts: { canFinance?: boolean } = {}) {
  const prisma = {
    $transaction: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(1),
    report: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    reportTemplateVersion: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'tpl1',
        version: 1,
        definition: TEMPLATE_DEF,
      }),
    },
    cattle: { findFirst: jest.fn().mockResolvedValue({ id: 'c1' }) },
    animalGroup: { findFirst: jest.fn().mockResolvedValue({ id: 'g1' }) },
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  const permissions = {
    hasPermission: jest.fn().mockResolvedValue(opts.canFinance ?? false),
  };
  const farmClock = { timezone: jest.fn().mockResolvedValue('Asia/Dhaka') };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const logger = {
    setContext: jest.fn().mockReturnThis(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  };
  const storage = {
    get: jest.fn().mockResolvedValue(Buffer.from('%PDF')),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const lifecycle = { resetForRetry: jest.fn().mockResolvedValue(true) };
  const compute = { compute: jest.fn() };
  const queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const svc = new ReportsApiService(
    prisma as never,
    permissions as never,
    farmClock as never,
    audit as never,
    logger as never,
    storage as never,
    lifecycle,
    compute,
    queue,
  );
  return {
    svc,
    prisma,
    permissions,
    audit,
    storage,
    lifecycle,
    compute,
    queue,
  };
}

const cfg = (over: Record<string, unknown> = {}) => ({
  templateId: 'on-demand',
  period: { preset: 'this_month' as const },
  scope: { kind: 'ALL_ELIGIBLE' as const },
  selectedMetricIds: ['milk.total_yield'],
  ...over,
});

describe('ReportsApiService', () => {
  describe('config validation', () => {
    it('dedupes metric ids and stores them sorted', async () => {
      const t = build();
      t.prisma.report.create.mockResolvedValue(summaryRow());
      await t.svc.create(
        OWNER,
        cfg({
          selectedMetricIds: [
            'milk.total_yield',
            'health.cases_opened',
            'milk.total_yield',
          ],
        }),
      );
      const data = t.prisma.report.create.mock.calls[0][0].data;
      expect(data.selectedMetricIds).toEqual([
        'health.cases_opened',
        'milk.total_yield',
      ]);
    });

    it('rejects more than 60 distinct metrics', async () => {
      const t = build();
      const ids = Array.from({ length: 61 }, (_, i) => `milk.m${i}`);
      await expect(
        t.svc.create(OWNER, cfg({ selectedMetricIds: ids })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects metrics outside the template', async () => {
      const t = build();
      await expect(
        t.svc.create(OWNER, cfg({ selectedMetricIds: ['milk.not_a_metric'] })),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        t.svc.create(OWNER, cfg({ selectedMetricIds: ['feed.tmr_fed_kg'] })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown template id and a >366 day custom range', async () => {
      const t = build();
      await expect(
        t.svc.create(OWNER, cfg({ templateId: 'other' })),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        t.svc.create(
          OWNER,
          cfg({
            period: {
              preset: 'custom',
              customStartDate: '2025-01-01',
              customEndDate: '2026-12-31',
            },
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects mismatched scope fields and a cross-farm cow with 404', async () => {
      const t = build();
      await expect(
        t.svc.create(OWNER, cfg({ scope: { kind: 'SINGLE_COW' } })),
      ).rejects.toBeInstanceOf(BadRequestException);
      t.prisma.cattle.findFirst.mockResolvedValue(null);
      await expect(
        t.svc.create(
          OWNER,
          cfg({ scope: { kind: 'SINGLE_COW', cattleId: 'other_farm_cow' } }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(t.prisma.cattle.findFirst.mock.calls[0][0].where).toEqual({
        id: 'other_farm_cow',
        farmId: FARM,
      });
    });
  });

  describe('finance handling', () => {
    it('rejects (403) explicitly requested finance ids without finance.read', async () => {
      const t = build({ canFinance: false });
      for (const id of ['finance.cash_received', 'health.treatment_cost']) {
        await expect(
          t.svc.create(MANAGER, cfg({ selectedMetricIds: [id] })),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }
      expect(t.prisma.report.create).not.toHaveBeenCalled();
    });

    it('sets includesFinance only when allowed AND a finance metric is selected', async () => {
      const t = build({ canFinance: true });
      t.prisma.report.create.mockResolvedValue(
        summaryRow({ includesFinance: true }),
      );
      await t.svc.create(
        OWNER,
        cfg({
          selectedMetricIds: ['finance.cash_received', 'milk.total_yield'],
        }),
      );
      expect(t.prisma.report.create.mock.calls[0][0].data.includesFinance).toBe(
        true,
      );
      await t.svc.create(
        OWNER,
        cfg({ selectedMetricIds: ['milk.total_yield'], forceNew: true }),
      );
      expect(t.prisma.report.create.mock.calls[1][0].data.includesFinance).toBe(
        false,
      );
    });

    it('omits finance metrics and all-finance sections from the catalogue without finance.read', async () => {
      const t = build({ canFinance: false });
      const res = await t.svc.templates(MANAGER);
      const ids = res.onDemand.sections.flatMap((s) =>
        s.metrics.map((m) => m.id),
      );
      expect(ids).toEqual([
        'milk.total_yield',
        'milk.avg_daily_yield',
        'health.cases_opened',
      ]);
      expect(
        res.onDemand.sections.find((s) => s.domain === 'finance'),
      ).toBeUndefined();
      expect(JSON.stringify(res)).not.toMatch(/finance\.|treatment_cost/);
    });

    it('lists finance metrics for a caller with finance.read', async () => {
      const t = build({ canFinance: true });
      const res = await t.svc.templates(OWNER);
      const ids = res.onDemand.sections.flatMap((s) =>
        s.metrics.map((m) => m.id),
      );
      expect(ids).toContain('finance.cash_received');
      expect(METRIC_REGISTRY['finance.cash_received']).toBeDefined();
    });

    it('history excludes finance reports without finance.read, and always scopes farm + not deleted', async () => {
      const t = build({ canFinance: false });
      await t.svc.list(MANAGER, { limit: 20, sortOrder: 'desc' });
      const where = t.prisma.report.findMany.mock.calls[0][0].where;
      expect(where.farmId).toBe(FARM);
      expect(where.deletedAt).toBeNull();
      expect(where.includesFinance).toBe(false);
      expect(where.OR).toBeDefined(); // expiry filter

      const t2 = build({ canFinance: true });
      await t2.svc.list(OWNER, { limit: 20, sortOrder: 'desc' });
      expect(
        t2.prisma.report.findMany.mock.calls[0][0].where,
      ).not.toHaveProperty('includesFinance');
    });
  });

  describe('duplicates and idempotency', () => {
    it('returns duplicate:true without creating when an identical report exists', async () => {
      const t = build();
      t.prisma.report.findMany.mockResolvedValue([summaryRow()]);
      const res = await t.svc.create(OWNER, cfg());
      expect(res).toMatchObject({ duplicate: true });
      expect(t.prisma.report.create).not.toHaveBeenCalled();
      expect(t.queue.enqueue).not.toHaveBeenCalled();
    });

    it('does not treat a different metric set or scope as a duplicate', async () => {
      const t = build();
      t.prisma.report.findMany.mockResolvedValue([
        summaryRow({ selectedMetricIds: ['milk.avg_daily_yield'] }),
        summaryRow({ id: 'r3', scope: { kind: 'SINGLE_COW', cattleId: 'c9' } }),
      ]);
      t.prisma.report.create.mockResolvedValue(summaryRow({ id: 'new' }));
      const res = await t.svc.create(OWNER, cfg());
      expect(res).toMatchObject({ duplicate: false });
      expect(t.queue.enqueue).toHaveBeenCalledWith('new');
    });

    it('forceNew creates a new snapshot even when a duplicate exists', async () => {
      const t = build();
      t.prisma.report.findMany.mockResolvedValue([summaryRow()]);
      t.prisma.report.create.mockResolvedValue(summaryRow({ id: 'forced' }));
      const res = await t.svc.create(OWNER, cfg({ forceNew: true }));
      expect(res).toMatchObject({ duplicate: false, report: { id: 'forced' } });
      expect(t.prisma.report.findMany).not.toHaveBeenCalled();
    });

    it('replays an Idempotency-Key without a second job', async () => {
      const t = build();
      t.prisma.report.findFirst.mockResolvedValue({
        ...summaryRow({ id: 'same' }),
        deletedAt: null,
      });
      const res = await t.svc.create(OWNER, cfg(), 'key-1');
      expect(res).toMatchObject({
        duplicate: false,
        replayed: true,
        report: { id: 'same' },
      });
      expect(t.prisma.report.create).not.toHaveBeenCalled();
      expect(t.queue.enqueue).not.toHaveBeenCalled();
    });

    it('handles a P2002 race on the idempotency key by returning the winner', async () => {
      const t = build();
      t.prisma.report.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...summaryRow({ id: 'winner' }),
          deletedAt: null,
        });
      t.prisma.report.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );
      const res = await t.svc.create(OWNER, cfg(), 'key-2');
      expect(res).toMatchObject({ replayed: true, report: { id: 'winner' } });
      expect(t.queue.enqueue).not.toHaveBeenCalled();
    });

    it('rejects a malformed Idempotency-Key', async () => {
      const t = build();
      await expect(
        t.svc.create(OWNER, cfg(), 'bad key!'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('answers 429 at the per-farm in-flight cap', async () => {
      const t = build();
      t.prisma.report.count.mockResolvedValue(3);
      await expect(t.svc.create(OWNER, cfg())).rejects.toMatchObject({
        status: 429,
      });
      expect(t.prisma.report.create).not.toHaveBeenCalled();
    });

    it('marks the report FAILED and answers 503 when enqueue fails', async () => {
      const t = build();
      t.prisma.report.create.mockResolvedValue(summaryRow({ id: 'q' }));
      t.queue.enqueue.mockRejectedValue(new Error('redis down'));
      await expect(t.svc.create(OWNER, cfg())).rejects.toBeInstanceOf(
        HttpException,
      );
      expect(t.prisma.report.updateMany.mock.calls[0][0].data.status).toBe(
        'FAILED',
      );
    });
  });

  describe('404 uniformity and response safety', () => {
    it('detail/download/retry on a missing, cross-farm or finance-hidden report are the same 404', async () => {
      const t = build({ canFinance: false });
      t.prisma.report.findFirst.mockResolvedValue(null);
      const errs = await Promise.all([
        t.svc.getOne(MANAGER, 'x').catch((e: unknown) => e),
        t.svc.download(MANAGER, 'x').catch((e: unknown) => e),
        t.svc.retry(MANAGER, 'x').catch((e: unknown) => e),
      ]);
      for (const e of errs) {
        expect(e).toBeInstanceOf(NotFoundException);
        expect((e as NotFoundException).message).toBe('Report not found');
      }
      const where = t.prisma.report.findFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({
        id: 'x',
        farmId: FARM,
        deletedAt: null,
        includesFinance: false,
      });
    });

    it('summaries never carry artifactKey or signed URLs; payload only when COMPLETED', async () => {
      const t = build({ canFinance: true });
      t.prisma.report.findFirst.mockResolvedValue({
        ...summaryRow(),
        snapshot: {
          payload: { includesFinance: false, sections: [], exceptions: [] },
        },
      });
      const detail = await t.svc.getOne(OWNER, 'r1');
      const json = JSON.stringify(detail);
      expect(json).not.toContain('secret/key.pdf');
      expect(json).not.toMatch(/artifactKey|signed|https?:/);
      expect(detail.hasPdf).toBe(true);
      expect(detail.payload).not.toBeNull();

      t.prisma.report.findFirst.mockResolvedValue({
        ...summaryRow({ status: 'QUEUED' }),
        snapshot: { payload: { sections: [] } },
      });
      expect((await t.svc.getOne(OWNER, 'r1')).payload).toBeNull();
    });

    it('re-checks finance on the payload and hides a leaking report as 404', async () => {
      const t = build({ canFinance: false });
      t.prisma.report.findFirst.mockResolvedValue({
        ...summaryRow(),
        snapshot: {
          payload: {
            includesFinance: false,
            exceptions: [],
            sections: [{ id: 'f', domain: 'finance', metrics: [] }],
          },
        },
      });
      await expect(t.svc.getOne(MANAGER, 'r1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('download', () => {
    it('answers 409 REPORT_PDF_NOT_AVAILABLE when there is no artifact', async () => {
      const t = build();
      t.prisma.report.findFirst.mockResolvedValue({
        id: 'r1',
        type: 'ON_DEMAND',
        status: 'COMPLETED',
        periodStartDate: '2026-10-01',
        periodEndDate: '2026-10-31',
        artifactKey: null,
        artifactContentType: null,
      });
      const err = await t.svc.download(OWNER, 'r1').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(
        JSON.stringify((err as ConflictException).getResponse()),
      ).toContain('REPORT_PDF_NOT_AVAILABLE');
      expect(t.storage.get).not.toHaveBeenCalled();
    });

    it('streams bytes with a filename from type + period only and audits the download', async () => {
      const t = build();
      t.prisma.report.findFirst.mockResolvedValue({
        id: 'r1',
        type: 'ON_DEMAND',
        status: 'COMPLETED',
        periodStartDate: '2026-10-01',
        periodEndDate: '2026-10-31',
        artifactKey: 'farm/secret.pdf',
        artifactContentType: 'application/pdf',
      });
      const file = await t.svc.download(OWNER, 'r1');
      expect(file.fileName).toBe('report-on_demand-2026-10-01_2026-10-31.pdf');
      expect(file.fileName).not.toContain('secret');
      expect(t.storage.get).toHaveBeenCalledWith('farm/secret.pdf');
      expect(t.audit.record.mock.calls[0][0].action).toBe('REPORT_DOWNLOADED');
      expect(JSON.stringify(t.audit.record.mock.calls[0][0])).not.toContain(
        'secret',
      );
    });
  });

  describe('retry', () => {
    it('retries only FAILED reports', async () => {
      const t = build();
      t.prisma.report.findFirst.mockResolvedValue({
        id: 'r1',
        status: 'COMPLETED',
        type: 'ON_DEMAND',
      });
      await expect(t.svc.retry(OWNER, 'r1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(t.lifecycle.resetForRetry).not.toHaveBeenCalled();
      expect(t.queue.enqueue).not.toHaveBeenCalled();
    });

    it('resets, enqueues and audits a FAILED report', async () => {
      const t = build();
      t.prisma.report.findFirst
        .mockResolvedValueOnce({
          id: 'r1',
          status: 'FAILED',
          type: 'ON_DEMAND',
          manualRetries: 1,
        })
        .mockResolvedValueOnce(summaryRow({ status: 'QUEUED' }));
      const res = await t.svc.retry(OWNER, 'r1');
      expect(t.lifecycle.resetForRetry).toHaveBeenCalledWith(
        'r1',
        FARM,
        MAX_MANUAL_RETRIES,
      );
      expect(t.audit.record.mock.calls[0][0].metadata.attempt).toBe(2);
      expect(t.queue.enqueue).toHaveBeenCalledWith('r1');
      expect(t.audit.record.mock.calls[0][0].action).toBe('REPORT_RETRIED');
      expect(res.status).toBe('QUEUED');
    });

    it('stops at the manual retry limit (column) with REPORT_RETRY_LIMIT, before any reset', async () => {
      const t = build();
      t.prisma.report.findFirst.mockResolvedValue({
        id: 'r1',
        status: 'FAILED',
        type: 'ON_DEMAND',
        manualRetries: MAX_MANUAL_RETRIES,
      });
      const err = await t.svc.retry(OWNER, 'r1').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(
        JSON.stringify((err as ConflictException).getResponse()),
      ).toContain('REPORT_RETRY_LIMIT');
      expect(t.lifecycle.resetForRetry).not.toHaveBeenCalled();
    });

    it('409s when the conditional reset loses a race and never enqueues', async () => {
      const t = build();
      t.prisma.report.findFirst.mockResolvedValue({
        id: 'r1',
        status: 'FAILED',
        type: 'ON_DEMAND',
        manualRetries: 0,
      });
      t.lifecycle.resetForRetry.mockResolvedValue(false);
      await expect(t.svc.retry(OWNER, 'r1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(t.queue.enqueue).not.toHaveBeenCalled();
    });

    it('also honours the in-flight cap (429) before resetting', async () => {
      const t = build();
      t.prisma.report.findFirst.mockResolvedValue({
        id: 'r1',
        status: 'FAILED',
        type: 'ON_DEMAND',
        manualRetries: 0,
      });
      t.prisma.report.count.mockResolvedValue(3);
      await expect(t.svc.retry(OWNER, 'r1')).rejects.toMatchObject({
        status: 429,
      });
      expect(t.lifecycle.resetForRetry).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('is Owner only: a Manager (or a custom role named Owner) gets 403 before any lookup', async () => {
      const t = build();
      await expect(t.svc.remove(MANAGER, 'r1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(t.svc.remove(FAKE_OWNER, 'r1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(t.prisma.report.findFirst).not.toHaveBeenCalled();
      expect(t.prisma.report.updateMany).not.toHaveBeenCalled();
    });

    it('soft-deletes, deletes the artifact best-effort and audits', async () => {
      const t = build();
      t.prisma.report.findFirst.mockResolvedValue({
        id: 'r1',
        type: 'ON_DEMAND',
        artifactKey: 'k.pdf',
      });
      await t.svc.remove(OWNER, 'r1');
      const first = t.prisma.report.updateMany.mock.calls[0][0];
      expect(first.where).toMatchObject({
        id: 'r1',
        farmId: FARM,
        deletedAt: null,
      });
      expect(first.data.deletedAt).toBeInstanceOf(Date);
      expect(t.storage.delete).toHaveBeenCalledWith('k.pdf');
      expect(t.audit.record.mock.calls[0][0].action).toBe('REPORT_DELETED');
    });

    it('still succeeds when the storage delete fails', async () => {
      const t = build();
      t.prisma.report.findFirst.mockResolvedValue({
        id: 'r1',
        type: 'ON_DEMAND',
        artifactKey: 'k.pdf',
      });
      t.storage.delete.mockRejectedValue(new Error('r2 down'));
      await expect(t.svc.remove(OWNER, 'r1')).resolves.toEqual({
        deleted: true,
      });
    });

    it('answers 404 for a missing or cross-farm report', async () => {
      const t = build();
      t.prisma.report.findFirst.mockResolvedValue(null);
      await expect(t.svc.remove(OWNER, 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(t.prisma.report.findFirst.mock.calls[0][0].where).toMatchObject({
        farmId: FARM,
        deletedAt: null,
      });
    });
  });

  describe('delete during processing', () => {
    const reasonOf = (e: unknown) =>
      JSON.stringify((e as ConflictException).getResponse());

    it('409 REPORT_PROCESSING while PROCESSING inside the lease', async () => {
      const t = build();
      t.prisma.report.findFirst.mockResolvedValue({
        id: 'r1',
        type: 'ON_DEMAND',
        artifactKey: null,
        status: 'PROCESSING',
        startedAt: minutesAgo(PROCESSING_LEASE_MINUTES - 5),
      });
      const err = await t.svc.remove(OWNER, 'r1').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(reasonOf(err)).toContain('REPORT_PROCESSING');
      expect(t.prisma.report.updateMany).not.toHaveBeenCalled();
    });

    it('allows deleting a stale PROCESSING row and guards the write with the lease', async () => {
      const t = build();
      t.prisma.report.findFirst.mockResolvedValue({
        id: 'r1',
        type: 'ON_DEMAND',
        artifactKey: null,
        status: 'PROCESSING',
        startedAt: minutesAgo(PROCESSING_LEASE_MINUTES + 5),
      });
      await expect(t.svc.remove(OWNER, 'r1')).resolves.toEqual({
        deleted: true,
      });
      expect(
        t.prisma.report.updateMany.mock.calls[0][0].where.NOT,
      ).toMatchObject({ status: 'PROCESSING' });
    });

    it.each(['QUEUED', 'FAILED', 'COMPLETED'])(
      'allows deleting a %s row',
      async (status) => {
        const t = build();
        t.prisma.report.findFirst.mockResolvedValue({
          id: 'r1',
          type: 'ON_DEMAND',
          artifactKey: null,
          status,
          startedAt: null,
        });
        await expect(t.svc.remove(OWNER, 'r1')).resolves.toEqual({
          deleted: true,
        });
      },
    );
  });

  describe('create hardening', () => {
    it('runs duplicate detection, cap and insert in ONE advisory-locked transaction', async () => {
      const t = build();
      t.prisma.report.create.mockResolvedValue(summaryRow({ id: 'n' }));
      await t.svc.create(OWNER, cfg(), 'key-tx');
      expect(t.prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(t.prisma.$executeRaw).toHaveBeenCalledTimes(1);
      const sql = (t.prisma.$executeRaw.mock.calls[0][0] as string[]).join('');
      expect(sql).toContain('pg_advisory_xact_lock');
      expect(t.prisma.$executeRaw.mock.calls[0][1]).toBe(`reports:${FARM}`);
      // the lock is taken before the lookups and the insert
      const lockOrder = t.prisma.$executeRaw.mock.invocationCallOrder[0];
      expect(lockOrder).toBeLessThan(
        t.prisma.report.findFirst.mock.invocationCallOrder[0],
      );
      expect(lockOrder).toBeLessThan(
        t.prisma.report.create.mock.invocationCallOrder[0],
      );
      // enqueue only after the transaction returned
      expect(t.queue.enqueue).toHaveBeenCalledWith('n');
    });

    it('does not enqueue when the transaction rejects (cap)', async () => {
      const t = build();
      t.prisma.report.count.mockResolvedValue(3);
      await expect(t.svc.create(OWNER, cfg())).rejects.toMatchObject({
        status: 429,
      });
      expect(t.queue.enqueue).not.toHaveBeenCalled();
    });

    it('only counts QUEUED/PROCESSING rows younger than the stale window', async () => {
      const t = build();
      t.prisma.report.create.mockResolvedValue(summaryRow({ id: 'n' }));
      await t.svc.create(OWNER, cfg());
      const where = t.prisma.report.count.mock.calls[0][0].where;
      expect(where.farmId).toBe(FARM);
      expect(where.status).toBeUndefined();
      const [queued, processing] = where.OR;
      expect(queued.status).toBe('QUEUED');
      const cutoff = queued.createdAt.gt as Date;
      expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(
        STALE_IN_FLIGHT_MINUTES * 60_000 - 1000,
      );
      expect(Date.now() - cutoff.getTime()).toBeLessThan(
        STALE_IN_FLIGHT_MINUTES * 60_000 + 5000,
      );
      expect(processing.status).toBe('PROCESSING');
      expect(processing.OR[0].startedAt.gt).toBeInstanceOf(Date);
    });

    it('stores a requestHash and includes timezone in the duplicate query', async () => {
      const t = build();
      t.prisma.report.create.mockResolvedValue(summaryRow({ id: 'n' }));
      await t.svc.create(OWNER, cfg());
      expect(t.prisma.report.create.mock.calls[0][0].data.requestHash).toMatch(
        /^[0-9a-f]{64}$/,
      );
      expect(t.prisma.report.findMany.mock.calls[0][0].where.timezone).toBe(
        'Asia/Dhaka',
      );
    });

    it('requestHash ignores forceNew and metric order/dupes, but not the metric set', async () => {
      const t = build();
      t.prisma.report.create.mockResolvedValue(summaryRow({ id: 'n' }));
      const hashOf = async (over: Record<string, unknown>) => {
        t.prisma.report.create.mockClear();
        await t.svc.create(OWNER, cfg({ forceNew: true, ...over }));
        return t.prisma.report.create.mock.calls[0][0].data
          .requestHash as string;
      };
      const a = await hashOf({
        selectedMetricIds: ['milk.total_yield', 'health.cases_opened'],
      });
      const b = await hashOf({
        selectedMetricIds: [
          'health.cases_opened',
          'milk.total_yield',
          'milk.total_yield',
        ],
        forceNew: false,
      });
      const c = await hashOf({ selectedMetricIds: ['milk.total_yield'] });
      expect(a).toBe(b);
      expect(a).not.toBe(c);
    });

    it('same Idempotency-Key with a different request => 409 REPORT_IDEMPOTENCY_CONFLICT', async () => {
      const t = build();
      t.prisma.report.findFirst.mockResolvedValue({
        ...summaryRow({ id: 'old' }),
        deletedAt: null,
        requestHash: 'f'.repeat(64),
      });
      const err = await t.svc
        .create(OWNER, cfg(), 'key-x')
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(
        JSON.stringify((err as ConflictException).getResponse()),
      ).toContain('REPORT_IDEMPOTENCY_CONFLICT');
      expect(t.prisma.report.create).not.toHaveBeenCalled();
    });

    it('same key + same request replays; legacy null hash replays unchecked', async () => {
      const t = build();
      t.prisma.report.create.mockResolvedValue(summaryRow({ id: 'first' }));
      await t.svc.create(OWNER, cfg(), 'key-y');
      const hash = t.prisma.report.create.mock.calls[0][0].data.requestHash;
      t.prisma.report.findFirst.mockResolvedValue({
        ...summaryRow({ id: 'first' }),
        deletedAt: null,
        requestHash: hash,
      });
      const res = await t.svc.create(OWNER, cfg(), 'key-y');
      expect(res).toMatchObject({ replayed: true, report: { id: 'first' } });
      t.prisma.report.findFirst.mockResolvedValue({
        ...summaryRow({ id: 'legacy' }),
        deletedAt: null,
        requestHash: null,
      });
      expect(await t.svc.create(OWNER, cfg(), 'key-y')).toMatchObject({
        replayed: true,
        report: { id: 'legacy' },
      });
    });
  });

  describe('duplicate freshness', () => {
    const dup = async (
      rows: Array<Record<string, unknown>>,
      over: Record<string, unknown> = {},
    ) => {
      const t = build();
      t.prisma.report.findMany.mockResolvedValue(rows);
      t.prisma.report.create.mockResolvedValue(summaryRow({ id: 'fresh' }));
      const res = await t.svc.create(OWNER, cfg(over));
      return res.duplicate;
    };

    it('QUEUED / PROCESSING twins are reusable', async () => {
      expect(
        await dup([summaryRow({ status: 'QUEUED', completedAt: null })]),
      ).toBe(true);
      expect(
        await dup([
          summaryRow({
            status: 'PROCESSING',
            startedAt: minutesAgo(1),
            completedAt: null,
          }),
        ]),
      ).toBe(true);
    });

    it('a stale in-flight twin (lost job) is not reusable', async () => {
      expect(
        await dup([
          summaryRow({
            status: 'QUEUED',
            completedAt: null,
            createdAt: minutesAgo(STALE_IN_FLIGHT_MINUTES + 5),
          }),
        ]),
      ).toBe(false);
    });

    it('COMPLETED for a period that had ended when generated is reusable however old', async () => {
      expect(
        await dup([
          summaryRow({
            completedAt: minutesAgo(60 * 24),
            periodEnd: minutesAgo(60 * 48),
          }),
        ]),
      ).toBe(true);
    });

    it('COMPLETED for a still-open period is reusable only inside the fresh window', async () => {
      const open = { periodEnd: new Date(Date.now() + 86_400_000) };
      expect(
        await dup([
          summaryRow({
            ...open,
            completedAt: minutesAgo(DUPLICATE_FRESH_MINUTES - 5),
          }),
        ]),
      ).toBe(true);
      expect(
        await dup([
          summaryRow({
            ...open,
            completedAt: minutesAgo(DUPLICATE_FRESH_MINUTES + 5),
          }),
        ]),
      ).toBe(false);
    });

    it('GROUP scope reuses COMPLETED only inside the fresh window, even if the period ended', async () => {
      const group = { kind: 'GROUP', groupId: 'g1', membershipAsOf: 'x' };
      const ended = { scope: group, periodEnd: minutesAgo(60 * 48) };
      const groupCfg = { scope: { kind: 'GROUP', groupId: 'g1' } };
      expect(
        await dup(
          [
            summaryRow({
              ...ended,
              completedAt: minutesAgo(DUPLICATE_FRESH_MINUTES - 5),
            }),
          ],
          groupCfg,
        ),
      ).toBe(true);
      expect(
        await dup(
          [
            summaryRow({
              ...ended,
              completedAt: minutesAgo(DUPLICATE_FRESH_MINUTES + 5),
            }),
          ],
          groupCfg,
        ),
      ).toBe(false);
    });
  });

  describe('input validation', () => {
    const custom = (from: string, to: string) =>
      cfg({
        period: { preset: 'custom', customStartDate: from, customEndDate: to },
      });
    const reasonOf = async (p: Promise<unknown>) => {
      const e = (await p.catch((x: unknown) => x)) as BadRequestException;
      expect(e).toBeInstanceOf(BadRequestException);
      return JSON.stringify(e.getResponse());
    };

    it('rejects an impossible calendar date (2026-02-31) with INVALID_DATE', async () => {
      const t = build();
      const body = await reasonOf(
        t.svc.create(OWNER, custom('2026-02-31', '2026-03-05')),
      );
      expect(body).toContain('REPORT_INVALID_PERIOD');
      expect(body).toContain('INVALID_DATE');
      expect(t.prisma.report.create).not.toHaveBeenCalled();
    });

    it('rejects end before start with INVALID_RANGE', async () => {
      const t = build();
      expect(
        await reasonOf(t.svc.create(OWNER, custom('2026-03-05', '2026-03-01'))),
      ).toContain('INVALID_RANGE');
    });

    it('rejects a >366 day range with RANGE_TOO_LONG', async () => {
      const t = build();
      expect(
        await reasonOf(t.svc.create(OWNER, custom('2025-01-01', '2026-12-31'))),
      ).toContain('RANGE_TOO_LONG');
    });

    it('rejects custom dates on a non-custom preset', async () => {
      const t = build();
      expect(
        await reasonOf(
          t.svc.create(
            OWNER,
            cfg({
              period: { preset: 'this_week', customStartDate: '2026-01-01' },
            }),
          ),
        ),
      ).toContain('REPORT_INVALID_PERIOD');
    });
  });

  describe('preview concurrency', () => {
    const busy = (e: unknown) =>
      (e as HttpException).getStatus() === 429 &&
      JSON.stringify((e as HttpException).getResponse()).includes(
        'REPORT_PREVIEW_BUSY',
      );

    it('a second concurrent preview on the same farm is 429 REPORT_PREVIEW_BUSY, and the slot frees afterwards', async () => {
      const t = build();
      let finish!: (v: unknown) => void;
      t.compute.compute.mockImplementationOnce(
        () => new Promise((r) => (finish = r)),
      );
      const first = t.svc.preview(OWNER, cfg());
      await new Promise((r) => setImmediate(r));
      const err = await t.svc.preview(OWNER, cfg()).catch((e: unknown) => e);
      expect(busy(err)).toBe(true);
      finish({ includesFinance: false, sections: [], exceptions: [] });
      await first;
      t.compute.compute.mockResolvedValue({
        includesFinance: false,
        sections: [],
        exceptions: [],
      });
      await expect(t.svc.preview(OWNER, cfg())).resolves.toBeDefined();
    });

    it('releases the slot when compute throws', async () => {
      const t = build();
      t.compute.compute.mockRejectedValueOnce(new Error('boom'));
      await expect(t.svc.preview(OWNER, cfg())).rejects.toThrow('boom');
      t.compute.compute.mockResolvedValue({
        includesFinance: false,
        sections: [],
        exceptions: [],
      });
      await expect(t.svc.preview(OWNER, cfg())).resolves.toBeDefined();
    });

    it('PreviewLimiter: per-farm 1, global 4, release is idempotent', () => {
      const l = new PreviewLimiter(1, 4);
      const a = l.tryAcquire('a');
      expect(a).not.toBeNull();
      expect(l.tryAcquire('a')).toBeNull(); // per farm
      const others = ['b', 'c', 'd'].map((f) => l.tryAcquire(f));
      expect(others.every((r) => r !== null)).toBe(true);
      expect(l.tryAcquire('e')).toBeNull(); // global cap of 4
      a!();
      a!(); // double release must not free a second slot
      expect(l.tryAcquire('e')).not.toBeNull();
      expect(l.tryAcquire('f')).toBeNull();
    });
  });

  describe('preview', () => {
    it('passes the caller CURRENT finance.read as includeFinance and persists nothing', async () => {
      const t = build({ canFinance: false });
      t.compute.compute.mockResolvedValue({
        includesFinance: false,
        sections: [],
        exceptions: [],
      });
      await t.svc.preview(MANAGER, cfg());
      expect(t.compute.compute.mock.calls[0][0]).toMatchObject({
        farmId: FARM,
        includeFinance: false,
        type: 'ON_DEMAND',
      });
      expect(t.prisma.report.create).not.toHaveBeenCalled();
      expect(t.audit.record.mock.calls[0][0].action).toBe('REPORT_PREVIEWED');
    });
  });
});

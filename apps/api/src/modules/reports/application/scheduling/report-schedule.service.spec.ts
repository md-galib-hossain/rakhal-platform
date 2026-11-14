/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- jest mock call inspection */
import { Prisma } from '@prisma/client';
import { ReportScheduleService } from './report-schedule.service';

const FARM = `c${'a'.repeat(24)}`;
const NOW = new Date('2026-10-24T10:00:00Z'); // Saturday, Dhaka

const logger = () => {
  const l = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { setContext: () => l, l };
};

const def = (wait: number) => ({
  sections: [{ metricIds: ['milk.total_yield', 'milk.cows_with_data'] }],
  thresholds: { finalizationMaxWaitHours: wait },
});

function build(
  over: {
    features?: string[];
    existing?: Array<{
      id?: string;
      type: string;
      periodStartDate: string;
      status?: string;
      manualRetries?: number;
      deletedAt?: Date | null;
    }>;
    resetOk?: boolean;
    drafts?: number;
    wait?: number;
    createError?: Error;
  } = {},
) {
  const create = jest
    .fn()
    .mockImplementation(() =>
      over.createError
        ? Promise.reject(over.createError)
        : Promise.resolve({ id: `rep-${create.mock.calls.length}` }),
    );
  const prisma = {
    farm: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: FARM,
            timezone: 'Asia/Dhaka',
            createdAt: new Date('2020-01-01'),
          },
        ])
        .mockResolvedValue([]),
    },
    reportTemplateVersion: {
      findFirst: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve({
          id: `tv-${where.type}`,
          version: 1,
          definition: def(over.wait ?? 6),
        }),
      ),
    },
    report: {
      findMany: jest.fn().mockResolvedValue(
        (over.existing ?? []).map((e) => ({
          id: 'ex-1',
          status: 'COMPLETED',
          manualRetries: 0,
          deletedAt: null,
          ...e,
        })),
      ),
      create,
    },
    milkLogEntry: { count: jest.fn().mockResolvedValue(over.drafts ?? 0) },
  };
  const access = {
    resolveEntitlement: jest.fn().mockResolvedValue({
      features: over.features ?? ['reports.scheduled'],
    }),
  };
  const queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const lifecycle = {
    resetForRetry: jest.fn().mockResolvedValue(over.resetOk ?? true),
  };
  const lg = logger();
  const svc = new ReportScheduleService(
    prisma as never,
    access as never,
    queue,
    lifecycle as never,
    lg as never,
  );
  return { svc, prisma, queue, lg, lifecycle };
}

describe('ReportScheduleService.sweep', () => {
  it('creates a QUEUED SCHEDULED row per due period with the agreed fields, then enqueues', async () => {
    const t = build();
    const res = await t.svc.sweep(NOW);
    expect(res).toMatchObject({
      farms: 1,
      created: 4,
      alreadyExists: 0,
      deferred: 0,
    });
    const first = t.prisma.report.create.mock.calls[0][0].data;
    expect(first).toMatchObject({
      farmId: FARM,
      origin: 'SCHEDULED',
      type: 'WEEKLY',
      templateVersionId: 'tv-WEEKLY',
      periodStartDate: '2026-10-12',
      periodEndDate: '2026-10-18',
      timezone: 'Asia/Dhaka',
      scope: { kind: 'ALL_ELIGIBLE' },
      selectedMetricIds: ['milk.total_yield', 'milk.cows_with_data'],
      includesFinance: true,
      status: 'QUEUED',
      requestedBy: null,
      scheduledKey: `${FARM}:WEEKLY:2026-10-12:v1`,
      expiresAt: null,
    });
    expect(t.queue.enqueue).toHaveBeenCalledTimes(4);
  });

  it('skips farms without reports.scheduled', async () => {
    const t = build({ features: ['reports.generate'] });
    const res = await t.svc.sweep(NOW);
    expect(res).toMatchObject({ skippedNotEntitled: 1, created: 0 });
    expect(t.prisma.report.create).not.toHaveBeenCalled();
  });

  it('counts an existing period (any template version) as alreadyExists and does not create', async () => {
    const t = build({
      existing: [
        { type: 'WEEKLY', periodStartDate: '2026-10-12' },
        { type: 'WEEKLY', periodStartDate: '2026-10-05' },
        { type: 'MONTHLY', periodStartDate: '2026-09-01' },
        { type: 'MONTHLY', periodStartDate: '2026-08-01' },
      ],
    });
    const res = await t.svc.sweep(NOW);
    expect(res).toMatchObject({ created: 0, alreadyExists: 4 });
  });

  it('re-queues a FAILED scheduled report under the retry cap and counts it', async () => {
    const t = build({
      existing: [
        {
          id: 'rep-f',
          type: 'WEEKLY',
          periodStartDate: '2026-10-12',
          status: 'FAILED',
          manualRetries: 1,
        },
      ],
    });
    const res = await t.svc.sweep(NOW);
    expect(res).toMatchObject({ retriedFailed: 1, failedExhausted: 0 });
    expect(t.lifecycle.resetForRetry).toHaveBeenCalledWith('rep-f', FARM, 2);
    expect(t.queue.enqueue).toHaveBeenCalledWith('rep-f');
  });

  it('leaves an exhausted FAILED report FAILED, counts and logs it', async () => {
    const t = build({
      existing: [
        {
          id: 'rep-x',
          type: 'WEEKLY',
          periodStartDate: '2026-10-12',
          status: 'FAILED',
          manualRetries: 2,
        },
      ],
    });
    const res = await t.svc.sweep(NOW);
    expect(res).toMatchObject({ retriedFailed: 0, failedExhausted: 1 });
    expect(t.lifecycle.resetForRetry).not.toHaveBeenCalled();
    expect(t.queue.enqueue).not.toHaveBeenCalledWith('rep-x');
    expect(t.lg.l.warn).toHaveBeenCalled();
  });

  it('counts a soft-deleted period as existing, never recreates or retries it, and does not filter deletedAt', async () => {
    const t = build({
      existing: [
        {
          id: 'rep-d',
          type: 'WEEKLY',
          periodStartDate: '2026-10-12',
          status: 'FAILED',
          manualRetries: 0,
          deletedAt: new Date('2026-10-20'),
        },
        {
          type: 'WEEKLY',
          periodStartDate: '2026-10-05',
          deletedAt: new Date('2026-10-20'),
        },
      ],
    });
    const res = await t.svc.sweep(NOW);
    expect(res).toMatchObject({ created: 2, alreadyExists: 2 });
    expect(res.retriedFailed).toBe(0);
    expect(t.lifecycle.resetForRetry).not.toHaveBeenCalled();
    const where = t.prisma.report.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('deletedAt');
  });

  it('does not enqueue when the reset lost the race', async () => {
    const t = build({
      resetOk: false,
      existing: [
        {
          id: 'rep-r',
          type: 'WEEKLY',
          periodStartDate: '2026-10-12',
          status: 'FAILED',
          manualRetries: 0,
        },
      ],
    });
    const res = await t.svc.sweep(NOW);
    expect(res.retriedFailed).toBe(0);
    expect(t.queue.enqueue).not.toHaveBeenCalledWith('rep-r');
  });

  it('counts a P2002 race loss as alreadyExists and does not enqueue', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x',
    });
    const t = build({ createError: err });
    const res = await t.svc.sweep(NOW);
    expect(res).toMatchObject({ created: 0, alreadyExists: 4, errors: 0 });
    expect(t.queue.enqueue).not.toHaveBeenCalled();
  });

  it('defers while drafts exist inside the wait window', async () => {
    // Weekly run instant = Mon 19 Oct 00:00 Dhaka = 18 Oct 18:00Z; monthly = 30 Sep 18:00Z (long past).
    const t = build({ drafts: 3, wait: 6 });
    const res = await t.svc.sweep(new Date('2026-10-18T19:00:00Z'));
    expect(res.deferred).toBeGreaterThan(0);
    const created = t.prisma.report.create.mock.calls.map(
      (c) => `${c[0].data.type}:${c[0].data.periodStartDate}`,
    );
    expect(created).not.toContain('WEEKLY:2026-10-12');
    expect(created).toContain('WEEKLY:2026-10-05');
  });

  it('generates after the wait window even with drafts, and never queries drafts then', async () => {
    const t = build({ drafts: 3, wait: 6 });
    const res = await t.svc.sweep(NOW);
    expect(res.deferred).toBe(0);
    expect(res.created).toBe(4);
    expect(t.prisma.milkLogEntry.count).not.toHaveBeenCalled();
  });

  it('a failed enqueue leaves the row for reconcile and still counts it as created', async () => {
    const t = build();
    t.queue.enqueue.mockRejectedValue(new Error('redis'));
    const res = await t.svc.sweep(NOW);
    expect(res.created).toBe(4);
    expect(t.lg.l.warn).toHaveBeenCalled();
  });

  it('counts a farm with a bad timezone as an error and keeps going', async () => {
    const t = build();
    t.prisma.farm.findMany.mockReset();
    t.prisma.farm.findMany
      .mockResolvedValueOnce([
        { id: FARM, timezone: 'Bad/Zone', createdAt: new Date('2020-01-01') },
      ])
      .mockResolvedValue([]);
    const res = await t.svc.sweep(NOW);
    expect(res).toMatchObject({ farms: 1, errors: 1, created: 0 });
  });

  it('filters by farmIds and by active, non-deleted status', async () => {
    const t = build();
    await t.svc.sweep(NOW, { farmIds: [FARM] });
    const where = t.prisma.farm.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      status: 'ACTIVE',
      deletedAt: null,
      id: { in: [FARM] },
    });
  });

  it('logs counts only', async () => {
    const t = build();
    await t.svc.sweep(NOW);
    const [, ctx] = t.lg.l.info.mock.calls.at(-1)!;
    expect(Object.keys(ctx).sort()).toEqual(
      [
        'alreadyExists',
        'created',
        'deferred',
        'errors',
        'failedExhausted',
        'farms',
        'missed',
        'retriedFailed',
        'skippedNotEntitled',
      ].sort(),
    );
  });
});

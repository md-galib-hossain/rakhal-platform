/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- jest mock call inspection */
import { Prisma } from '@prisma/client';
import type { LoggerService } from 'src/core/logger/logger/logger.service';
import type { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { ObjectStoragePort } from 'src/modules/media/application/ports/object-storage.port';
import type { ReportSnapshotPayload } from '../../domain/contracts/snapshot';
import { ReportError } from '../../domain/report-error';
import { ReportGenerationService } from './report-generation.service';
import type { ReportLifecycleService } from './report-lifecycle.service';

const payload = {
  schemaVersion: 1,
  calcVersion: 1,
  templateVersion: 1,
  includesFinance: false,
  sections: [],
  exceptions: [],
} as unknown as ReportSnapshotPayload;

const row = {
  id: 'r1',
  farmId: 'farm1',
  type: 'WEEKLY',
  periodStart: new Date('2026-10-04T18:00:00Z'),
  periodEnd: new Date('2026-10-11T18:00:00Z'),
  periodStartDate: '2026-10-05',
  periodEndDate: '2026-10-11',
  timezone: 'Asia/Dhaka',
  scope: { kind: 'ALL_ELIGIBLE' },
  selectedMetricIds: ['milk.total_yield'],
  includesFinance: false,
  templateVersion: {
    version: 2,
    definition: { sections: [], thresholds: {} },
  },
};

const TOKEN = new Date('2026-10-24T10:00:00Z');

function setup() {
  const prisma = {
    report: {
      findUnique: jest
        .fn()
        .mockImplementation((a: { select?: unknown }) =>
          Promise.resolve(a.select ? { deletedAt: null } : row),
        ),
    },
    reportSnapshot: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const lifecycle = {
    claim: jest.fn().mockResolvedValue({ claimed: true, token: TOKEN }),
    markCompleted: jest.fn().mockResolvedValue(true),
    markRetryable: jest.fn().mockResolvedValue(true),
    markFailed: jest.fn().mockResolvedValue(true),
    retentionDays: jest.fn().mockResolvedValue(30),
  };
  const compute = { compute: jest.fn().mockResolvedValue(payload) };
  const renderer = { render: jest.fn().mockResolvedValue(null) };
  const storage = {
    put: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const logger = {
    setContext() {
      return this;
    },
    info: jest.fn(),
    warn: jest.fn(),
  };
  const svc = new ReportGenerationService(
    prisma as unknown as PrismaService,
    lifecycle as unknown as ReportLifecycleService,
    compute,
    renderer,
    storage as unknown as ObjectStoragePort,
    logger as unknown as LoggerService,
  );
  return { svc, prisma, lifecycle, compute, renderer, storage, logger };
}

const first = { attemptsMade: 0, maxAttempts: 3 };

describe('ReportGenerationService', () => {
  it('skips (no compute, no writes) when the row cannot be claimed', async () => {
    const { svc, compute, prisma, lifecycle } = setup();
    lifecycle.claim.mockResolvedValue({ claimed: false, retryAfterMs: null });
    await expect(svc.process('r1', first)).resolves.toEqual({
      status: 'skipped',
    });
    expect(compute.compute).not.toHaveBeenCalled();
    expect(prisma.reportSnapshot.create).not.toHaveBeenCalled();
    expect(lifecycle.markCompleted).not.toHaveBeenCalled();
  });

  it('computes once, stores the snapshot, completes with retention-based expiry', async () => {
    const { svc, compute, prisma, lifecycle } = setup();
    await expect(svc.process('r1', first)).resolves.toEqual({
      status: 'completed',
    });
    expect(compute.compute).toHaveBeenCalledTimes(1);
    const arg = compute.compute.mock.calls[0][0] as {
      period: { label: string };
      includeFinance: boolean;
      generatedAt: Date;
    };
    expect(arg.includeFinance).toBe(false);
    expect(arg.period.label).toBe('2026-W41');
    expect(prisma.reportSnapshot.create).toHaveBeenCalledTimes(1);
    const [, , completedAt, expiresAt, artifact] =
      lifecycle.markCompleted.mock.calls[0];
    expect(artifact).toBeNull();
    expect(
      (expiresAt as Date).getTime() - (completedAt as Date).getTime(),
    ).toBe(30 * 86_400_000);
  });

  it('reuses an existing snapshot on retry: no recompute, no second snapshot', async () => {
    const { svc, compute, prisma, renderer } = setup();
    prisma.reportSnapshot.findUnique.mockResolvedValue({ payload });
    await svc.process('r1', first);
    expect(compute.compute).not.toHaveBeenCalled();
    expect(prisma.reportSnapshot.create).not.toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledWith(payload);
  });

  it('on a snapshot unique collision returns the winning row instead of failing', async () => {
    const { svc, prisma, renderer } = setup();
    const winner = { ...payload, calcVersion: 9 };
    prisma.reportSnapshot.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    prisma.reportSnapshot.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ payload: winner });
    await expect(svc.process('r1', first)).resolves.toEqual({
      status: 'completed',
    });
    expect(renderer.render).toHaveBeenCalledWith(winner);
  });

  it('stores a rendered artifact under reports/{farmId}/{reportId}.pdf', async () => {
    const { svc, renderer, storage, lifecycle } = setup();
    renderer.render.mockResolvedValue({
      body: Buffer.from('%PDF'),
      contentType: 'application/pdf',
    });
    await svc.process('r1', first);
    expect(storage.put).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'reports/farm1/r1.pdf' }),
    );
    expect(lifecycle.markCompleted.mock.calls[0][4]).toEqual({
      key: 'reports/farm1/r1.pdf',
      bytes: 4,
      contentType: 'application/pdf',
    });
  });

  it('transient storage failure with attempts left => back to QUEUED, retry', async () => {
    const { svc, renderer, storage, lifecycle } = setup();
    renderer.render.mockResolvedValue({
      body: Buffer.from('x'),
      contentType: 'application/pdf',
    });
    storage.put.mockRejectedValue(new Error('secret bucket url'));
    await expect(svc.process('r1', first)).resolves.toEqual({
      status: 'retry',
      category: 'STORAGE_UNAVAILABLE',
    });
    expect(lifecycle.markRetryable).toHaveBeenCalledWith(
      'r1',
      expect.any(Date),
      'STORAGE_UNAVAILABLE',
    );
    expect(lifecycle.markFailed).not.toHaveBeenCalled();
    expect(lifecycle.markCompleted).not.toHaveBeenCalled();
  });

  it('transient failure on the final attempt => FAILED', async () => {
    const { svc, compute, lifecycle } = setup();
    compute.compute.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('tx timeout', {
        code: 'P2028',
        clientVersion: 'x',
      }),
    );
    await expect(
      svc.process('r1', { attemptsMade: 2, maxAttempts: 3 }),
    ).resolves.toEqual({ status: 'failed', category: 'DB_TIMEOUT' });
    expect(lifecycle.markFailed).toHaveBeenCalledWith(
      'r1',
      expect.any(Date),
      'DB_TIMEOUT',
      expect.any(Date),
    );
    expect(lifecycle.markRetryable).not.toHaveBeenCalled();
  });

  it('permanent ReportError => FAILED immediately, no retry', async () => {
    const { svc, compute, lifecycle } = setup();
    compute.compute.mockRejectedValue(
      new ReportError('INVALID_CONFIG', 'Group not found.'),
    );
    await expect(svc.process('r1', first)).resolves.toEqual({
      status: 'failed',
      category: 'INVALID_CONFIG',
    });
    expect(lifecycle.markRetryable).not.toHaveBeenCalled();
  });

  it('unknown render error is permanent RENDER_FAILED', async () => {
    const { svc, renderer, lifecycle } = setup();
    renderer.render.mockRejectedValue(new TypeError('boom'));
    await expect(svc.process('r1', first)).resolves.toEqual({
      status: 'failed',
      category: 'RENDER_FAILED',
    });
    expect(lifecycle.markFailed).toHaveBeenCalled();
  });

  it('unexpected compute error is permanent GENERATION_FAILED', async () => {
    const { svc, compute } = setup();
    compute.compute.mockRejectedValue(new TypeError('boom'));
    await expect(svc.process('r1', first)).resolves.toEqual({
      status: 'failed',
      category: 'GENERATION_FAILED',
    });
  });

  it('a live foreign lease delays the job instead of completing it', async () => {
    const { svc, lifecycle, compute } = setup();
    lifecycle.claim.mockResolvedValue({ claimed: false, retryAfterMs: 5000 });
    const out = await svc.process('r1', first);
    expect(out).toEqual({ status: 'delayed', delayMs: 6000 });
    expect(compute.compute).not.toHaveBeenCalled();
  });

  it('if markRetryable throws the job is still retried', async () => {
    const { svc, renderer, lifecycle } = setup();
    renderer.render.mockRejectedValue(
      new ReportError('STORAGE_UNAVAILABLE', 'x'),
    );
    lifecycle.markRetryable.mockRejectedValue(new Error('db down'));
    await expect(svc.process('r1', first)).resolves.toEqual({
      status: 'retry',
      category: 'STORAGE_UNAVAILABLE',
    });
  });

  it('a report deleted mid-run is not rendered or completed', async () => {
    const { svc, prisma, renderer, lifecycle } = setup();
    prisma.report.findUnique.mockImplementation((a: { select?: unknown }) =>
      Promise.resolve(a.select ? { deletedAt: new Date() } : row),
    );
    await expect(svc.process('r1', first)).resolves.toEqual({
      status: 'skipped',
    });
    expect(renderer.render).not.toHaveBeenCalled();
    expect(lifecycle.markCompleted).not.toHaveBeenCalled();
  });

  it('deleted while storing: markCompleted misses, artifact is removed, nothing resurrected', async () => {
    const { svc, prisma, renderer, storage, lifecycle } = setup();
    renderer.render.mockResolvedValue({
      body: Buffer.from('x'),
      contentType: 'application/pdf',
    });
    let n = 0;
    prisma.report.findUnique.mockImplementation((a: { select?: unknown }) =>
      Promise.resolve(
        a.select ? { deletedAt: ++n >= 2 ? new Date() : null } : row,
      ),
    );
    lifecycle.markCompleted.mockResolvedValue(false);
    await expect(svc.process('r1', first)).resolves.toEqual({
      status: 'skipped',
    });
    expect(storage.delete).toHaveBeenCalledWith('reports/farm1/r1.pdf');
  });

  it('a fenced-out worker (not deleted) leaves the shared artifact alone', async () => {
    const { svc, renderer, storage, lifecycle } = setup();
    renderer.render.mockResolvedValue({
      body: Buffer.from('x'),
      contentType: 'application/pdf',
    });
    lifecycle.markCompleted.mockResolvedValue(false);
    await svc.process('r1', first);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('never logs raw error text', async () => {
    const { svc, renderer, logger } = setup();
    renderer.render.mockRejectedValue(new Error('SELECT * secret'));
    await svc.process('r1', first);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('secret');
  });

  it('a finance-bearing stored snapshot on a finance-free report is refused', async () => {
    const { svc, prisma, lifecycle } = setup();
    prisma.reportSnapshot.findUnique.mockResolvedValue({
      payload: {
        ...payload,
        includesFinance: false,
        sections: [{ id: 'f', domain: 'finance', titleKey: 't', metrics: [] }],
      },
    });
    await expect(svc.process('r1', first)).resolves.toEqual({
      status: 'failed',
      category: 'PERMISSION_DENIED',
    });
    expect(lifecycle.markCompleted).not.toHaveBeenCalled();
  });
});

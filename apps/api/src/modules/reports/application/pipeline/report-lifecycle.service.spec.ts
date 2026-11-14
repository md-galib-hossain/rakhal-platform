/* eslint-disable @typescript-eslint/no-unsafe-member-access -- jest mock call inspection */
import type { LoggerService } from 'src/core/logger/logger/logger.service';
import type { PrismaService } from 'src/core/database/prisma/prisma.service';
import { ReportLifecycleService } from './report-lifecycle.service';
import { REPORT_PROCESSING_LEASE_MS } from './report-pipeline.constants';

function setup() {
  const prisma = {
    report: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    farmSubscription: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const logger = {
    setContext() {
      return this;
    },
    info: jest.fn(),
  };
  const svc = new ReportLifecycleService(
    prisma as unknown as PrismaService,
    logger as unknown as LoggerService,
  );
  return { svc, prisma };
}

describe('ReportLifecycleService', () => {
  it('claim is a compare-and-set on QUEUED or an expired PROCESSING lease', async () => {
    const { svc, prisma } = setup();
    const now = new Date('2026-10-24T10:00:00Z');
    await expect(svc.claim('r1', now)).resolves.toEqual({
      claimed: true,
      token: now,
    });
    const args = prisma.report.updateMany.mock.calls[0][0] as {
      where: { OR: Array<Record<string, unknown>>; deletedAt: null };
      data: Record<string, unknown>;
    };
    expect(args.where.deletedAt).toBeNull();
    expect(args.where.OR[0]).toEqual({ status: 'QUEUED' });
    expect(args.where.OR[1]).toEqual({
      status: 'PROCESSING',
      startedAt: { lt: new Date(now.getTime() - REPORT_PROCESSING_LEASE_MS) },
    });
    expect(args.data).toMatchObject({
      status: 'PROCESSING',
      attempts: { increment: 1 },
    });
  });

  it('a second claim that matches no row returns false', async () => {
    const { svc, prisma } = setup();
    prisma.report.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.claim('r1', new Date())).resolves.toEqual({
      claimed: false,
      retryAfterMs: null,
    });
  });

  it('a failed claim on a live lease reports the time left', async () => {
    const { svc, prisma } = setup();
    prisma.report.updateMany.mockResolvedValue({ count: 0 });
    const now = new Date('2026-10-24T10:00:00Z');
    prisma.report.findUnique.mockResolvedValue({
      status: 'PROCESSING',
      deletedAt: null,
      startedAt: new Date(now.getTime() - REPORT_PROCESSING_LEASE_MS + 4000),
    });
    await expect(svc.claim('r1', now)).resolves.toEqual({
      claimed: false,
      retryAfterMs: 4000,
    });
  });

  it('completion, retry and failure are fenced on PROCESSING and the claim token', async () => {
    const { svc, prisma } = setup();
    const token = new Date('2026-10-24T10:00:00Z');
    await svc.markCompleted('r1', token, new Date(), new Date(), null);
    await svc.markRetryable('r1', token, 'DB_TIMEOUT');
    await svc.markFailed('r1', token, 'RENDER_FAILED', new Date());
    const wheres = prisma.report.updateMany.mock.calls.map(
      (c) => (c[0] as { where: Record<string, unknown> }).where,
    );
    expect(wheres[0]).toEqual({
      id: 'r1',
      status: 'PROCESSING',
      startedAt: token,
      deletedAt: null,
    });
    const fenced = { id: 'r1', status: 'PROCESSING', startedAt: token };
    expect(wheres[1]).toEqual(fenced);
    expect(wheres[2]).toEqual(fenced);
  });

  it('failure persists only the category and a fixed safe message', async () => {
    const { svc, prisma } = setup();
    await svc.markFailed('r1', new Date(), 'STORAGE_UNAVAILABLE', new Date());
    const data = (
      prisma.report.updateMany.mock.calls[0][0] as {
        data: { errorCategory: string; errorMessage: string };
      }
    ).data;
    expect(data.errorCategory).toBe('STORAGE_UNAVAILABLE');
    expect(data.errorMessage).toMatch(/storage/i);
  });

  it('resetForRetry only moves a FAILED, undeleted row of the same farm and keeps the snapshot', async () => {
    const { svc, prisma } = setup();
    await expect(svc.resetForRetry('r1', 'farm1')).resolves.toBe(true);
    const args = prisma.report.updateMany.mock.calls[0][0] as {
      where: unknown;
      data: Record<string, unknown>;
    };
    expect(args.where).toEqual({
      id: 'r1',
      farmId: 'farm1',
      status: 'FAILED',
      deletedAt: null,
    });
    expect(args.data).toMatchObject({
      status: 'QUEUED',
      manualRetries: { increment: 1 },
      errorCategory: null,
      errorMessage: null,
    });
    prisma.report.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.resetForRetry('r1', 'other')).resolves.toBe(false);
  });

  it('resetForRetry with a cap requires manualRetries < cap in the same where', async () => {
    const { svc, prisma } = setup();
    await svc.resetForRetry('r1', 'farm1', 3);
    expect(
      (prisma.report.updateMany.mock.calls[0][0] as { where: unknown }).where,
    ).toMatchObject({ manualRetries: { lt: 3 } });
  });

  it('retention falls back to 365 days without a subscription', async () => {
    const { svc, prisma } = setup();
    await expect(svc.retentionDays('farm1')).resolves.toBe(365);
    prisma.farmSubscription.findFirst.mockResolvedValue({
      subscriptionPlan: { reportRetentionDays: 90 },
    });
    await expect(svc.retentionDays('farm1')).resolves.toBe(90);
  });
});

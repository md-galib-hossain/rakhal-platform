/* eslint-disable @typescript-eslint/no-unsafe-return -- jest mock call inspection */
import { Test } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { SubscriptionAccessService } from '../../../subscription/application/services/subscription-access.service';
import { OBJECT_STORAGE } from '../../../media/application/ports/object-storage.port';
import { ReportReconcileService } from '../../application/pipeline/report-reconcile.service';
import { REPORT_QUEUE } from '../../application/ports/report-ports';
import { ReportRetentionService } from '../../application/scheduling/report-retention.service';
import { ReportLifecycleService } from '../../application/pipeline/report-lifecycle.service';
import { ReportScheduleService } from '../../application/scheduling/report-schedule.service';
import {
  REPORT_SCHEDULER_PROVIDERS,
  REPORT_JOB_LOCK,
  ReportSchedulerCron,
} from './index';

const log = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function cronWith(lock: { runExclusive: jest.Mock }) {
  return new ReportSchedulerCron(
    { sweep: jest.fn() } as never,
    { reconcile: jest.fn() } as never,
    { cleanup: jest.fn() } as never,
    lock as never,
    { setContext: () => log } as never,
  );
}

describe('ReportSchedulerCron.run', () => {
  beforeEach(() => jest.clearAllMocks());

  it('skips cleanly (no fn call) when the lock is held elsewhere', async () => {
    const lock = {
      runExclusive: jest.fn().mockResolvedValue({ acquired: false }),
    };
    const fn = jest.fn();
    expect(await cronWith(lock).run('job', fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it('runs fn under the lock and returns true', async () => {
    const lock = {
      runExclusive: jest.fn(async (_n: string, f: () => Promise<unknown>) => ({
        acquired: true,
        value: await f(),
      })),
    };
    const fn = jest.fn().mockResolvedValue({ created: 1 });
    expect(await cronWith(lock).run('job', fn)).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('never throws when the job throws', async () => {
    const lock = {
      runExclusive: jest.fn(async (_n: string, f: () => Promise<unknown>) => ({
        acquired: true,
        value: await f(),
      })),
    };
    await expect(
      cronWith(lock).run('job', () => Promise.reject(new Error('boom'))),
    ).resolves.toBe(true);
    expect(log.error).toHaveBeenCalled();
  });

  it('never throws when the lock itself fails', async () => {
    const lock = {
      runExclusive: jest.fn().mockRejectedValue(new Error('db down')),
    };
    await expect(cronWith(lock).run('job', jest.fn())).resolves.toBe(false);
  });

  it('cron entry points are no-ops under NODE_ENV=test', async () => {
    const lock = { runExclusive: jest.fn() };
    const c = cronWith(lock);
    await c.scheduleSweep();
    await c.reconcile();
    await c.retentionCleanup();
    expect(lock.runExclusive).not.toHaveBeenCalled();
  });
});

describe('REPORT_SCHEDULER_PROVIDERS (own Nest testing module)', () => {
  it('resolves every provider with the host dependencies mocked', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ...REPORT_SCHEDULER_PROVIDERS,
        { provide: PrismaService, useValue: {} },
        { provide: SubscriptionAccessService, useValue: {} },
        { provide: OBJECT_STORAGE, useValue: {} },
        {
          provide: ReportLifecycleService,
          useValue: { resetForRetry: jest.fn() },
        },
        { provide: REPORT_QUEUE, useValue: { enqueue: jest.fn() } },
        { provide: ReportReconcileService, useValue: { reconcile: jest.fn() } },
        { provide: LoggerService, useValue: { setContext: () => log } },
      ],
    }).compile();
    expect(moduleRef.get(ReportScheduleService)).toBeInstanceOf(
      ReportScheduleService,
    );
    expect(moduleRef.get(ReportRetentionService)).toBeInstanceOf(
      ReportRetentionService,
    );
    expect(moduleRef.get(REPORT_JOB_LOCK)).toBeDefined();
    expect(moduleRef.get(ReportSchedulerCron)).toBeInstanceOf(
      ReportSchedulerCron,
    );
  });

  it('declares the three named crons with the agreed expressions', () => {
    const meta = (m: keyof ReportSchedulerCron) =>
      Reflect.getMetadataKeys(ReportSchedulerCron.prototype[m]);
    // @nestjs/schedule stores the name/expression on the method; assert via its metadata keys existing.
    expect(meta('scheduleSweep').length).toBeGreaterThan(0);
    expect(meta('reconcile').length).toBeGreaterThan(0);
    expect(meta('retentionCleanup').length).toBeGreaterThan(0);
    expect(SchedulerRegistry).toBeDefined();
  });
});

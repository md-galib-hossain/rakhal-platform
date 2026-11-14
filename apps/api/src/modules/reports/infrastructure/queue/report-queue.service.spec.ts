/* eslint-disable @typescript-eslint/no-unsafe-member-access -- jest mock call inspection */
import type { Queue } from 'bullmq';
import type { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { LoggerService } from 'src/core/logger/logger/logger.service';
import { ReportQueueService } from './report-queue.service';

function setup(manualRetries = 0) {
  const queue = {
    getJob: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue({}),
  };
  const prisma = {
    report: { findUnique: jest.fn().mockResolvedValue({ manualRetries }) },
  };
  const logger = {
    setContext() {
      return this;
    },
    info: jest.fn(),
    error: jest.fn(),
  };
  const svc = new ReportQueueService(
    queue as unknown as Queue<{ reportId: string }>,
    prisma as unknown as PrismaService,
    logger as unknown as LoggerService,
  );
  return { svc, queue };
}

describe('ReportQueueService', () => {
  it('uses the bare report id for the original run and -r<n> after manual retries', async () => {
    const a = setup(0);
    await a.svc.enqueue('r1');
    expect(a.queue.add.mock.calls[0][2].jobId).toBe('r1');
    const b = setup(2);
    await b.svc.enqueue('r1');
    expect(b.queue.add.mock.calls[0][2].jobId).toBe('r1-r2');
  });

  it('leaves a live job alone', async () => {
    const { svc, queue } = setup();
    queue.getJob.mockResolvedValue({
      getState: () => Promise.resolve('active'),
    });
    await expect(svc.ensureJob('r1')).resolves.toBe(false);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('a retry is not dropped by an older job that is still active', async () => {
    const { svc, queue } = setup(1);
    // The old job lives under the bare id; the retry looks up r1-r1, which does not exist.
    queue.getJob.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'r1' ? { getState: () => Promise.resolve('active') } : undefined,
      ),
    );
    await expect(svc.ensureJob('r1')).resolves.toBe(true);
    expect(queue.add.mock.calls[0][2].jobId).toBe('r1-r1');
  });

  it('replaces a finished job record under the same id', async () => {
    const { svc, queue } = setup();
    const remove = jest.fn().mockResolvedValue(undefined);
    queue.getJob.mockResolvedValue({
      getState: () => Promise.resolve('failed'),
      remove,
    });
    await expect(svc.ensureJob('r1')).resolves.toBe(true);
    expect(remove).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalled();
  });
});

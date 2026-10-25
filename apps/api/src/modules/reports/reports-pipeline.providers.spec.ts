import { DelayedError, UnrecoverableError, type Job } from 'bullmq';
import type { ReportGenerationService } from './application/pipeline/report-generation.service';
import {
  REPORT_COMPUTE,
  REPORT_QUEUE,
  REPORT_RENDERER,
} from './application/ports/report-ports';
import { ReportsProcessor } from './infrastructure/queue/reports.processor';
import {
  REPORT_PIPELINE_IMPORTS,
  REPORT_PIPELINE_PROVIDERS,
} from './reports-pipeline.providers';

describe('REPORT_PIPELINE_PROVIDERS', () => {
  it('binds all three port tokens', () => {
    const tokens = REPORT_PIPELINE_PROVIDERS.map((p) =>
      typeof p === 'function' ? p : (p as { provide: unknown }).provide,
    );
    expect(tokens).toEqual(
      expect.arrayContaining([REPORT_COMPUTE, REPORT_QUEUE, REPORT_RENDERER]),
    );
  });

  it('registers the queue and bull root imports', () => {
    expect(REPORT_PIPELINE_IMPORTS.length).toBeGreaterThanOrEqual(3);
  });
});

describe('ReportsProcessor', () => {
  const run = (outcome: unknown) => {
    const generation = {
      process: jest.fn().mockResolvedValue(outcome),
    } as unknown as ReportGenerationService;
    const job = {
      data: { reportId: 'r1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as unknown as Job<{ reportId: string }>;
    return new ReportsProcessor(generation).process(job);
  };

  it('completes quietly for completed and skipped outcomes', async () => {
    await expect(run({ status: 'completed' })).resolves.toBeUndefined();
    await expect(run({ status: 'skipped' })).resolves.toBeUndefined();
  });

  it('throws a plain error for retry so BullMQ backs off', async () => {
    const p = run({ status: 'retry', category: 'DB_TIMEOUT' });
    await expect(p).rejects.toThrow('report_transient:DB_TIMEOUT');
    await expect(p).rejects.not.toBeInstanceOf(UnrecoverableError);
  });

  it('delayed parks the job past the lease and throws DelayedError', async () => {
    const generation = {
      process: jest
        .fn()
        .mockResolvedValue({ status: 'delayed', delayMs: 5000 }),
    } as unknown as ReportGenerationService;
    const moveToDelayed = jest.fn().mockResolvedValue(undefined);
    const job = {
      data: { reportId: 'r1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
      moveToDelayed,
    } as unknown as Job<{ reportId: string }>;
    await expect(
      new ReportsProcessor(generation).process(job, 'tok'),
    ).rejects.toBeInstanceOf(DelayedError);
    expect(moveToDelayed).toHaveBeenCalledWith(expect.any(Number), 'tok');
  });

  it('throws UnrecoverableError for failed so BullMQ stops', async () => {
    await expect(
      run({ status: 'failed', category: 'INVALID_CONFIG' }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });
});

import request from 'supertest';
import type { App } from 'supertest/types';
import { ReportFormat, ReportJobStatus } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { ReportCleanupRunner } from '../src/modules/reports/infrastructure/cron/report-cleanup.runner';
import {
  AuthedUser,
  TestContext,
  bearer,
  createTestApp,
  loginAs,
} from './utils/e2e';

/**
 * RD-013(b) flood guards + TTL cleanup. Report bytes now live in R2 (memory
 * adapter in tests) instead of Postgres bytea — covers the two caps that
 * bound storage/queue growth independent of the request-rate throttle (which
 * this harness's `ThrottlerGuard` override makes untestable here, same as the
 * existing auth-login rate limit), and the hourly cleanup sweep.
 */
describe('Reports — storage limits + cleanup (RD-013b)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let prisma: PrismaService;
  const seededJobIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    prisma = ctx.app.get(PrismaService);
  });

  afterEach(async () => {
    if (seededJobIds.length) {
      await prisma.reportJob.deleteMany({
        where: { id: { in: seededJobIds } },
      });
      seededJobIds.length = 0;
    }
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('rejects a 4th concurrent report while 3 are already in flight for the farm', async () => {
    for (let i = 0; i < 3; i += 1) {
      const job = await prisma.reportJob.create({
        data: {
          farmId: owner.farmId,
          reportId: 'rpt_open_cows',
          format: ReportFormat.CSV,
          params: {},
          status: ReportJobStatus.QUEUED,
          createdBy: 'test-seed',
        },
        select: { id: true },
      });
      seededJobIds.push(job.id);
    }

    const res = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(owner))
      .send({ reportId: 'rpt_open_cows', format: 'csv' });

    expect(res.status).toBe(400);
  });

  /** Count of jobs still counting against the farm's stored-report cap. */
  async function storedCount(): Promise<number> {
    return prisma.reportJob.count({
      where: {
        farmId: owner.farmId,
        status: ReportJobStatus.COMPLETED,
        storageKey: { not: null },
      },
    });
  }

  it("never lets a farm's stored-report count exceed the 50-report cap", async () => {
    // The shared demo farm can already carry leftover completed jobs from
    // other specs run earlier today (pre-existing test hygiene gap, not
    // introduced here) — so assert the cap invariant itself, not which
    // specific row gets purged.
    const before = await storedCount();
    const toSeed = Math.max(0, 55 - before);
    const now = Date.now();
    for (let i = 0; i < toSeed; i += 1) {
      const job = await prisma.reportJob.create({
        data: {
          farmId: owner.farmId,
          reportId: 'rpt_open_cows',
          format: ReportFormat.CSV,
          params: {},
          status: ReportJobStatus.COMPLETED,
          createdBy: 'test-seed',
          storageKey: `reports/${owner.farmId}/seed-${i}.csv`,
          byteSize: 10,
          createdAt: new Date(now - (toSeed - i) * 1000),
        },
        select: { id: true },
      });
      seededJobIds.push(job.id);
    }
    expect(await storedCount()).toBeGreaterThan(50);

    const generateRes = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(owner))
      .send({ reportId: 'rpt_open_cows', format: 'csv' });
    expect(generateRes.status).toBe(201);
    const jobId = (generateRes.body as { data: { job_id: string } }).data
      .job_id;
    seededJobIds.push(jobId);

    // Cap enforcement runs *after* the row flips to COMPLETED (it needs the
    // freshly-completed job counted), so poll the count down rather than
    // checking once right on completion.
    const deadline = Date.now() + 15_000;
    let capped = false;
    while (Date.now() < deadline) {
      if ((await storedCount()) <= 50) {
        capped = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    expect(capped).toBe(true);
  }, 20_000);

  it("cleanup runner nulls an expired job's storage key but keeps the row", async () => {
    const job = await prisma.reportJob.create({
      data: {
        farmId: owner.farmId,
        reportId: 'rpt_open_cows',
        format: ReportFormat.CSV,
        params: {},
        status: ReportJobStatus.COMPLETED,
        createdBy: 'test-seed',
        storageKey: `reports/${owner.farmId}/expired.csv`,
        byteSize: 10,
        expiresAt: new Date(Date.now() - 60_000),
      },
      select: { id: true },
    });
    seededJobIds.push(job.id);

    const runner = ctx.app.get(ReportCleanupRunner);
    await runner.purgeExpired();

    const row = await prisma.reportJob.findUnique({ where: { id: job.id } });
    expect(row).not.toBeNull();
    expect(row?.storageKey).toBeNull();
    expect(row?.byteSize).toBeNull();
  });
});

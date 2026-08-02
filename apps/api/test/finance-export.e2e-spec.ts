import request from 'supertest';
import type { App } from 'supertest/types';
import {
  AuthedUser,
  TestContext,
  bearer,
  createTestApp,
  loginAs,
} from './utils/e2e';

/**
 * Finance transactions export — moved from the synchronous
 * `GET /finance/transactions/export` (RD-010c) onto the Reports engine's
 * async BullMQ job pipeline (`rpt_finance_export`) so it no longer blocks
 * the request thread. Same filters (category/status/date-range/search),
 * same intentional inclusion of voided/reversal rows.
 */
describe('Reports — Finance Transactions Export (async)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  async function pollUntilCompleted(jobId: string): Promise<any> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const res = await request(ctx.app.getHttpServer() as App)
        .get(`${ctx.prefix}/reports/jobs/${jobId}`)
        .set(...bearer(owner));
      const status = (res.body as { data: { status: string } }).data.status;
      if (status === 'completed' || status === 'failed') {
        return res.body;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(`Report job ${jobId} did not settle within 15s`);
  }

  it('returns a CSV file containing a just-recorded transaction', async () => {
    const marker = `E2E-EXPORT-${Date.now()}`;

    await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/finance/transactions`)
      .set(...bearer(owner))
      .send({
        type: 'OPERATING_EXPENSE',
        category: 'OVERHEAD',
        entityName: marker,
        amount: 1234.5,
      })
      .expect(201);

    const generateRes = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(owner))
      .send({
        reportId: 'rpt_finance_export',
        format: 'csv',
        parameters: { search: marker },
      });
    expect(generateRes.status).toBe(201);
    const jobId = (generateRes.body as { data: { job_id: string } }).data
      .job_id;

    const settled = await pollUntilCompleted(jobId);
    expect((settled as { data: { status: string } }).data.status).toBe(
      'completed',
    );

    const download = await request(ctx.app.getHttpServer() as App)
      .get(`${ctx.prefix}/reports/jobs/${jobId}/download`)
      .set(...bearer(owner));
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('text/csv');
    expect(download.text).toContain('Finance Transactions Export');
    expect(download.text).toContain('Date,Reference,Type,Category');
    expect(download.text).toContain(marker);
    expect(download.text).toContain('1234.5');
  }, 20_000);

  it('respects the category filter, excluding non-matching rows', async () => {
    const marker = `E2E-EXPORT-FILTER-${Date.now()}`;

    await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/finance/transactions`)
      .set(...bearer(owner))
      .send({
        type: 'REVENUE',
        category: 'REVENUE',
        entityName: marker,
        amount: 500,
      })
      .expect(201);

    const wrongGenerate = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(owner))
      .send({
        reportId: 'rpt_finance_export',
        format: 'csv',
        parameters: { search: marker, category: 'OVERHEAD' },
      });
    const wrongJobId = (wrongGenerate.body as { data: { job_id: string } }).data
      .job_id;
    const wrongSettled = await pollUntilCompleted(wrongJobId);
    const wrongUrl = (wrongSettled as { data: { download_url: string } }).data
      .download_url;
    const wrongDownload = await request(ctx.app.getHttpServer() as App)
      .get(wrongUrl)
      .set(...bearer(owner));
    expect(wrongDownload.text).not.toContain(marker);

    const rightGenerate = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(owner))
      .send({
        reportId: 'rpt_finance_export',
        format: 'csv',
        parameters: { search: marker, category: 'REVENUE' },
      });
    const rightJobId = (rightGenerate.body as { data: { job_id: string } }).data
      .job_id;
    const rightSettled = await pollUntilCompleted(rightJobId);
    const rightUrl = (rightSettled as { data: { download_url: string } }).data
      .download_url;
    const rightDownload = await request(ctx.app.getHttpServer() as App)
      .get(rightUrl)
      .set(...bearer(owner));
    expect(rightDownload.text).toContain(marker);
  }, 25_000);

  it('worker is forbidden from generating the export (reports.create is manager+)', async () => {
    const res = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(worker))
      .send({ reportId: 'rpt_finance_export', format: 'csv' });
    expect(res.status).toBe(403);
  });
});

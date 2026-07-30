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
 * Monthly Farm Report — combined Cattle/Milk/Health/Finance PDF/CSV for one
 * farm+month, alongside the 13 existing single-topic reports (`report-data.ts`
 * `sections` extension). Covers the async generate→poll→download path plus
 * catalogue listing, empty-month, and RBAC.
 */
describe('Reports — Monthly Farm Report (combined)', () => {
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

  it('rpt_monthly_farm_report is listed in the catalogue under "combined"', async () => {
    const res = await request(ctx.app.getHttpServer() as App)
      .get(`${ctx.prefix}/reports`)
      .set(...bearer(owner));
    expect(res.status).toBe(200);
    const groups = (
      res.body as {
        data: {
          report_categories: Array<{
            category: string;
            reports: Array<{ id: string }>;
          }>;
        };
      }
    ).data.report_categories;
    const combined = groups.find((g) => g.category === 'combined');
    expect(combined?.reports.map((r) => r.id)).toContain(
      'rpt_monthly_farm_report',
    );
  });

  it('generates a PDF, polls to completion, downloads a non-trivial file', async () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const generateRes = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(owner))
      .send({
        reportId: 'rpt_monthly_farm_report',
        format: 'pdf',
        parameters: { month: currentMonth },
      });
    expect(generateRes.status).toBe(201);
    const { job_id: jobId, status } = (
      generateRes.body as { data: { job_id: string; status: string } }
    ).data;
    expect(status).toBe('queued');

    const settled = await pollUntilCompleted(jobId);
    expect((settled as { data: { status: string } }).data.status).toBe(
      'completed',
    );
    const downloadUrl = (settled as { data: { download_url: string } }).data
      .download_url;
    expect(downloadUrl).toBeTruthy();

    const download = await request(ctx.app.getHttpServer() as App)
      .get(`${ctx.prefix}/reports/jobs/${jobId}/download`)
      .set(...bearer(owner))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('application/pdf');
    expect((download.body as Buffer).length).toBeGreaterThan(100);
  }, 20_000);

  it('generates a CSV containing all 4 section headings', async () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const generateRes = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(owner))
      .send({
        reportId: 'rpt_monthly_farm_report',
        format: 'csv',
        parameters: { month: currentMonth },
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
    const body = download.text;
    expect(body).toContain('=== Cattle ===');
    expect(body).toContain('=== Milk ===');
    expect(body).toContain('=== Health ===');
    expect(body).toContain('=== Finance ===');
  }, 20_000);

  it('a month with no data still completes (empty sections, no 500)', async () => {
    const generateRes = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(owner))
      .send({
        reportId: 'rpt_monthly_farm_report',
        format: 'csv',
        parameters: { month: '2019-01' },
      });
    expect(generateRes.status).toBe(201);
    const jobId = (generateRes.body as { data: { job_id: string } }).data
      .job_id;

    const settled = await pollUntilCompleted(jobId);
    expect((settled as { data: { status: string } }).data.status).toBe(
      'completed',
    );
  }, 20_000);

  it('worker is forbidden from generating the report (reports.create is manager+)', async () => {
    const res = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(worker))
      .send({ reportId: 'rpt_monthly_farm_report', format: 'csv' });
    expect(res.status).toBe(403);
  });
});

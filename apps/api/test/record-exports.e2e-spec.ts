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
 * New record-dump exports on the Reports engine (async BullMQ, same pipeline
 * as the 14 existing reports): Cattle, Milk Log, Healthcare Cases, and a
 * combined Dashboard snapshot (PDF only). Each reuses `POST /reports/generate`
 * → poll → download instead of a bespoke synchronous route, so none of them
 * block the request thread.
 */
describe('Reports — Cattle/Milk/Healthcare/Dashboard exports (async)', () => {
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

  async function generateAndDownload(
    user: AuthedUser,
    reportId: string,
    format: 'csv' | 'pdf',
    parameters?: Record<string, string>,
  ) {
    const generateRes = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(user))
      .send({ reportId, format, ...(parameters ? { parameters } : {}) });
    expect(generateRes.status).toBe(201);
    const jobId = (generateRes.body as { data: { job_id: string } }).data
      .job_id;

    const settled = await pollUntilCompleted(jobId);
    expect((settled as { data: { status: string } }).data.status).toBe(
      'completed',
    );

    return request(ctx.app.getHttpServer() as App)
      .get(`${ctx.prefix}/reports/jobs/${jobId}/download`)
      .set(...bearer(user))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  }

  it('rpt_cattle_export produces a non-empty CSV with the cattle header row', async () => {
    const download = await generateAndDownload(
      owner,
      'rpt_cattle_export',
      'csv',
    );
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('text/csv');
    const body = (download.body as Buffer).toString('utf-8');
    expect(body).toContain('Cattle Export');
    expect(body).toContain('TAG,Name,Gender,Breed');
  }, 20_000);

  it('rpt_milk_export produces a non-empty CSV with the milk log header row', async () => {
    const download = await generateAndDownload(owner, 'rpt_milk_export', 'csv');
    expect(download.status).toBe(200);
    const body = (download.body as Buffer).toString('utf-8');
    expect(body).toContain('Milk Log Export');
    expect(body).toContain('Date,Session,TAG,Name,Yield (L)');
  }, 20_000);

  it('rpt_healthcare_export produces a non-empty CSV with the healthcare header row', async () => {
    const download = await generateAndDownload(
      owner,
      'rpt_healthcare_export',
      'csv',
    );
    expect(download.status).toBe(200);
    const body = (download.body as Buffer).toString('utf-8');
    expect(body).toContain('Healthcare Cases Export');
    expect(body).toContain('Case,TAG,Name,Diagnosis');
  }, 20_000);

  it('rpt_dashboard_export is PDF-only in the catalogue and generates a multi-section PDF', async () => {
    const catalogue = await request(ctx.app.getHttpServer() as App)
      .get(`${ctx.prefix}/reports`)
      .set(...bearer(owner));
    const groups = (
      catalogue.body as {
        data: {
          report_categories: Array<{
            category: string;
            reports: Array<{ id: string; formats: string[] }>;
          }>;
        };
      }
    ).data.report_categories;
    const dashboardDef = groups
      .flatMap((g) => g.reports)
      .find((r) => r.id === 'rpt_dashboard_export');
    expect(dashboardDef?.formats).toEqual(['pdf']);

    const download = await generateAndDownload(
      owner,
      'rpt_dashboard_export',
      'pdf',
    );
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('application/pdf');
    expect((download.body as Buffer).length).toBeGreaterThan(100);
  }, 20_000);

  it('a worker without reports.create is forbidden from all 4 new exports', async () => {
    for (const reportId of [
      'rpt_cattle_export',
      'rpt_milk_export',
      'rpt_healthcare_export',
      'rpt_dashboard_export',
    ]) {
      const res = await request(ctx.app.getHttpServer() as App)
        .post(`${ctx.prefix}/reports/generate`)
        .set(...bearer(worker))
        .send({
          reportId,
          format: reportId === 'rpt_dashboard_export' ? 'pdf' : 'csv',
        });
      expect(res.status).toBe(403);
    }
  });
});

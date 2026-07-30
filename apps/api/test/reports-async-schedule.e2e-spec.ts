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
 * RD-013(a)+(c): report generation now runs off a BullMQ queue instead of
 * inline in the request, and reports can be scheduled to auto-fire. Covers
 * the queued-generate → poll-to-completion → download path, plus schedule
 * CRUD + RBAC (`reports.schedule` is manager+, matching `reports.create`).
 */
describe('Reports — async generation + scheduling (RD-013)', () => {
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

  it('POST /reports/generate queues the job, worker polls to completion, then downloads', async () => {
    const generateRes = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(owner))
      .send({ reportId: 'rpt_open_cows', format: 'csv' });

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
      .set(...bearer(owner));
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('text/csv');
  }, 20_000);

  it('POST /reports/schedules creates a schedule; GET lists it; DELETE removes it', async () => {
    const create = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/schedules`)
      .set(...bearer(owner))
      .send({ reportId: 'rpt_monthly_pl', format: 'pdf', frequency: 'daily' });
    expect(create.status).toBe(201);
    const scheduleId = (create.body as { data: { id: string } }).data.id;
    expect(scheduleId).toBeTruthy();

    const list = await request(ctx.app.getHttpServer() as App)
      .get(`${ctx.prefix}/reports/schedules`)
      .set(...bearer(owner));
    expect(list.status).toBe(200);
    const ids = (
      list.body as { data: { schedules: Array<{ id: string }> } }
    ).data.schedules.map((s) => s.id);
    expect(ids).toContain(scheduleId);

    const del = await request(ctx.app.getHttpServer() as App)
      .delete(`${ctx.prefix}/reports/schedules/${scheduleId}`)
      .set(...bearer(owner));
    expect(del.status).toBe(204);
  });

  it('WEEKLY schedule without dayOfWeek is rejected', async () => {
    const res = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/schedules`)
      .set(...bearer(owner))
      .send({ reportId: 'rpt_open_cows', format: 'csv', frequency: 'weekly' });
    expect(res.status).toBe(400);
  });

  it('worker is forbidden from creating/deleting schedules (manager+ only)', async () => {
    const create = await request(ctx.app.getHttpServer() as App)
      .post(`${ctx.prefix}/reports/schedules`)
      .set(...bearer(worker))
      .send({ reportId: 'rpt_open_cows', format: 'csv', frequency: 'daily' });
    expect(create.status).toBe(403);
  });
});

import request from 'supertest';
import { PlatformAdminRole } from '@prisma/client';
import { createTestApp, TestContext } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { purgeAdminAudit } from './utils/admin-audit';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';

/**
 * Phase 5 operational visibility: queues + failed jobs, email delivery status, integration health. Throwaway
 * SUPPORT (read) and SUPER (retry) admins. Queue state belongs to whoever shares the Redis, so assertions are
 * about shape and safety, not exact counts.
 */
describe('Admin operations (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  const TOTP = 'JBSWY3DPEHPK3PXP';
  const stamp = Date.now();
  const adminIds: string[] = [];
  let support: string;
  let superT: string;
  let content: string;

  const api = (p: string) => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const get = (path: string, token: string) =>
    request(server()).get(api(path)).set('Authorization', `Bearer ${token}`);
  const dataOf = <T>(res: request.Response) => (res.body as { data: T }).data;

  async function makeAdmin(role: PlatformAdminRole): Promise<string> {
    const email = `p5-ops-${role.toLowerCase()}-${stamp}@rakhal.test`;
    const password = 'P5OpsE2Epass123';
    const admin = await prisma.platformAdmin.create({
      data: {
        email,
        name: `P5 ${role}`,
        passwordHash: await ctx.app.get(PasswordService).hashPassword(password),
        role,
        totpSecret: TOTP,
        totpEnabled: true,
      },
    });
    adminIds.push(admin.id);
    const res = await request(server())
      .post(api('/admin/auth/login'))
      .send({ email, password, code: currentTotpCode(TOTP) })
      .expect(201);
    return dataOf<{ accessToken: string }>(res).accessToken;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    support = await makeAdmin('SUPPORT_ADMIN');
    superT = await makeAdmin('SUPER_ADMIN');
    content = await makeAdmin('CONTENT_ADMIN');
  }, 40_000);

  afterAll(async () => {
    for (const id of adminIds) {
      await purgeAdminAudit(prisma, id);
      await prisma.platformAdmin
        .delete({ where: { id } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('lists the three queues with job counts', async () => {
    const res = await get('/admin/ops/queues', support).expect(200);
    const body = dataOf<{
      queues: {
        name: string;
        paused: boolean;
        counts: Record<string, number>;
      }[];
    }>(res);
    expect(body.queues.map((q) => q.name).sort()).toEqual([
      'email-queue',
      'outbox-queue',
      'reports-queue',
    ]);
    for (const q of body.queues) {
      expect(typeof q.paused).toBe('boolean');
      expect(typeof q.counts.failed).toBe('number');
      expect(typeof q.counts.waiting).toBe('number');
    }
  });

  it('lists failed jobs without ever returning job payloads; unknown queue is 404', async () => {
    const res = await get(
      '/admin/ops/queues/email-queue/failed?limit=5',
      support,
    ).expect(200);
    const body = dataOf<{ queue: string; jobs: Record<string, unknown>[] }>(
      res,
    );
    expect(body.queue).toBe('email-queue');
    expect(body.jobs.length).toBeLessThanOrEqual(5);
    for (const job of body.jobs) {
      expect(job).not.toHaveProperty('data');
      expect(job).not.toHaveProperty('returnvalue');
    }
    await get('/admin/ops/queues/not-a-queue/failed', support).expect(404);
  });

  it('retry: SUPER only, needs a reason, 404 for an unknown job', async () => {
    const path = '/admin/ops/queues/email-queue/failed/does-not-exist/retry';
    const reason = 'Provider outage resolved; replaying failed sends';
    await request(server())
      .post(api(path))
      .set('Authorization', `Bearer ${support}`)
      .send({ reason })
      .expect(403);
    await request(server())
      .post(api(path))
      .set('Authorization', `Bearer ${superT}`)
      .send({})
      .expect(400);
    await request(server())
      .post(api(path))
      .set('Authorization', `Bearer ${superT}`)
      .send({ reason })
      .expect(404);
  });

  it('email status: counts per window, masked recipients, no secrets', async () => {
    const res = await get('/admin/ops/email-status', support).expect(200);
    const body = dataOf<{
      provider: string;
      last24h: Record<string, number>;
      last7d: Record<string, number>;
      recentFailures: { to: string }[];
    }>(res);
    expect(['resend', 'smtp']).toContain(body.provider);
    for (const w of [body.last24h, body.last7d]) {
      expect(Object.keys(w).sort()).toEqual([
        'FAILED',
        'PROCESSING',
        'QUEUED',
        'SENT',
      ]);
    }
    expect(body.last7d.SENT).toBeGreaterThanOrEqual(body.last24h.SENT);
    for (const f of body.recentFailures) expect(f.to).toMatch(/^.\*\*\*@/);
  });

  it('integration health reports status only - never a configured value', async () => {
    const res = await get('/admin/ops/integrations', support).expect(200);
    const body = dataOf<{
      items: { key: string; status: string; detail: string }[];
    }>(res);
    const keys = body.items.map((i) => i.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'database',
        'redis',
        'email',
        'storage',
        'payments',
        'sentry',
      ]),
    );
    expect(body.items.find((i) => i.key === 'database')?.status).toBe('ok');
    expect(body.items.find((i) => i.key === 'redis')?.status).toBe('ok');

    const text = JSON.stringify(res.body);
    for (const secret of [
      process.env.JWT_ADMIN_SECRET,
      process.env.JWT_ACCESS_SECRET,
      process.env.RESEND_API_KEY,
      process.env.DATABASE_URL,
    ]) {
      if (secret) expect(text).not.toContain(secret);
    }
  });

  it('is gated by permission', async () => {
    // CONTENT_ADMIN has no system.read.
    await get('/admin/ops/queues', content).expect(403);
    await get('/admin/ops/integrations', content).expect(403);
    await request(server()).get(api('/admin/ops/queues')).expect(401);
  });
});

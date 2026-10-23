import request from 'supertest';
import { PlatformAdminRole } from '@prisma/client';
import { createTestApp, TestContext } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { purgeAdminAudit } from './utils/admin-audit';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';

/** Admin product insight (engagement, adoption, geography) and the security overview. */
describe('Admin insights (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  const TOTP = 'JBSWY3DPEHPK3PXP';
  const stamp = Date.now();
  const adminIds: string[] = [];
  let superT: string;
  let support: string;
  let billing: string;
  let content: string;

  const api = (p: string) => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const get = (p: string, t: string) =>
    request(server()).get(api(p)).set('Authorization', `Bearer ${t}`);
  const dataOf = <T>(res: request.Response) => (res.body as { data: T }).data;

  async function makeAdmin(role: PlatformAdminRole): Promise<string> {
    const email = `ins-${role.toLowerCase()}-${stamp}@rakhal.test`;
    const password = 'InsE2Epass12345';
    const admin = await prisma.platformAdmin.create({
      data: {
        email,
        name: `Ins ${role}`,
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
    superT = await makeAdmin('SUPER_ADMIN');
    support = await makeAdmin('SUPPORT_ADMIN');
    billing = await makeAdmin('BILLING_ADMIN');
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

  it('engagement: shape and internal consistency', async () => {
    const res = await get('/admin/analytics/engagement', support).expect(200);
    const e = dataOf<{
      users: {
        total: number;
        active: { daily: number; weekly: number; monthly: number };
        dormant: number;
      };
      activation: { rate: number | null; signedUp: number; activated: number };
      retention: { d7: { rate: number | null }; d30: { rate: number | null } };
      farms: { total: number; withRecordsLast30Days: number };
      records: { cattleTracked: number };
      modules: { module: string; farms: number; records: number }[];
      dailyActiveUsers: { day: string; count: number }[];
      geography: {
        unspecifiedFarms: number;
        divisions: { name: string; farms: number }[];
      };
    }>(res);

    expect(e.users.active.daily).toBeLessThanOrEqual(e.users.active.weekly);
    expect(e.users.active.weekly).toBeLessThanOrEqual(e.users.active.monthly);
    expect(e.users.active.monthly).toBeLessThanOrEqual(e.users.total);
    expect(e.activation.activated).toBeLessThanOrEqual(e.activation.signedUp);
    expect(e.farms.withRecordsLast30Days).toBeLessThanOrEqual(e.farms.total);
    expect(e.dailyActiveUsers).toHaveLength(30);
    const adoption = e.modules.map((m) => m.farms);
    expect([...adoption].sort((a, b) => b - a)).toEqual(adoption);
    for (const r of [e.retention.d7.rate, e.retention.d30.rate]) {
      if (r !== null) expect(r).toBeLessThanOrEqual(100);
    }
    expect(e.geography.divisions.every((d) => d.farms > 0)).toBe(true);
  });

  it('security overview: counts, lists and permission', async () => {
    const res = await get('/admin/security/overview', support).expect(200);
    const s = dataOf<{
      counts: { activeSessions: number; signIns24h: number; signIns7d: number };
      recentSignIns: { createdAt: string; user: { email: string } }[];
      needsAttention: { failedLoginAttempts: number }[];
    }>(res);
    expect(s.counts.signIns24h).toBeLessThanOrEqual(s.counts.signIns7d);
    expect(s.recentSignIns.length).toBeLessThanOrEqual(25);
    const times = s.recentSignIns.map((r) => new Date(r.createdAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times); // newest first
    // Credentials must never leave the API.
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|refreshToken/);
  });

  it('is permission gated and requires a token', async () => {
    await get('/admin/security/overview', superT).expect(200);
    await get('/admin/security/overview', billing).expect(403);
    await get('/admin/security/overview', content).expect(403);
    await get('/admin/analytics/engagement', content).expect(403);
    await request(server()).get(api('/admin/security/overview')).expect(401);
  });

  it('directory rows carry last-active and cattle counts', async () => {
    const users = dataOf<Record<string, unknown>[]>(
      await get('/admin/users?limit=5', support).expect(200),
    );
    for (const u of users) {
      expect(u).toHaveProperty('lastActiveAt');
      expect(typeof u.ownedFarmCount).toBe('number');
    }
    const overview = dataOf<{
      users: { activeLastDay: number; activeLast30Days: number };
      farms: { newThisMonth: number };
    }>(await get('/admin/overview', content).expect(200));
    expect(overview.users.activeLastDay).toBeLessThanOrEqual(
      overview.users.activeLast30Days,
    );
    expect(overview.farms.newThisMonth).toBeGreaterThanOrEqual(0);
  });
});

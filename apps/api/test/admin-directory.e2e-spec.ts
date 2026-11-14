import request from 'supertest';
import { PlatformAdminRole } from '@prisma/client';
import { createTestApp, TestContext } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { purgeAdminAudit } from './utils/admin-audit';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';

/**
 * Phase 3 read-only directory (`/admin/farms`, `/admin/users`, `/admin/overview`).
 * Runs as throwaway SUPPORT and CONTENT admins so role gating is real and the
 * shared seeded admin is never touched.
 */
describe('Admin directory (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  const TOTP = 'JBSWY3DPEHPK3PXP';
  const stamp = Date.now();
  const password = 'P3DirectoryE2Epass1';
  const adminIds: string[] = [];
  let support: string;
  let content: string;

  const api = (p: string) => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const get = (path: string, token: string) =>
    request(server()).get(api(path)).set('Authorization', `Bearer ${token}`);

  /** Lists are hoisted by the response interceptor to `{ data: items[], meta }`. */
  const listOf = <T>(res: request.Response) => ({
    items: (res.body as { data: T[] }).data,
    meta: (
      res.body as {
        meta: { hasNextPage: boolean; endCursor: string; limit: number };
      }
    ).meta,
  });
  const dataOf = <T>(res: request.Response) => (res.body as { data: T }).data;

  async function makeAdmin(role: PlatformAdminRole): Promise<string> {
    const passwords = ctx.app.get(PasswordService);
    const email = `p3-${role.toLowerCase()}-${stamp}@rakhal.test`;
    const admin = await prisma.platformAdmin.create({
      data: {
        email,
        name: `P3 ${role}`,
        passwordHash: await passwords.hashPassword(password),
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
    content = await makeAdmin('CONTENT_ADMIN');
  }, 30_000);

  afterAll(async () => {
    for (const id of adminIds) {
      await purgeAdminAudit(prisma, id);
      await prisma.platformAdmin
        .delete({ where: { id } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  interface FarmRow {
    id: string;
    name: string;
    status: string;
    owner: { email: string };
    memberCount: number;
  }

  it('lists farms with owner, member count and latest subscription; no secrets', async () => {
    const res = await get('/admin/farms?limit=5', support).expect(200);
    const { items, meta } = listOf<FarmRow>(res);
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(meta.limit).toBe(5);
    expect(items[0].owner.email).toContain('@');
    expect(typeof items[0].memberCount).toBe('number');
    expect(JSON.stringify(res.body)).not.toMatch(
      /passwordHash|totpSecret|refreshToken/,
    );
  });

  it('searches farms by owner email and filters by status', async () => {
    const all = await get('/admin/farms?limit=1', support).expect(200);
    const owner = listOf<FarmRow>(all).items[0].owner.email;

    const found = await get(
      `/admin/farms?search=${encodeURIComponent(owner)}`,
      support,
    ).expect(200);
    const items = listOf<FarmRow>(found).items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((f) => f.owner.email === owner)).toBe(true);

    const none = await get(
      `/admin/farms?search=zzz-no-such-farm-${stamp}`,
      support,
    ).expect(200);
    expect(listOf<FarmRow>(none).items).toHaveLength(0);

    await get('/admin/farms?status=NOT_A_STATUS', support).expect(400);
  });

  it('paginates farms with a cursor', async () => {
    const page1 = listOf<FarmRow>(
      await get('/admin/farms?limit=1', support).expect(200),
    );
    if (!page1.meta.hasNextPage) return; // single-farm dev DB: nothing to page
    const page2 = listOf<FarmRow>(
      await get(
        `/admin/farms?limit=1&cursor=${encodeURIComponent(page1.meta.endCursor)}`,
        support,
      ).expect(200),
    );
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
  });

  it('farm detail has members and activity; unknown id is 404', async () => {
    const list = await get('/admin/farms?limit=1', support).expect(200);
    const id = listOf<FarmRow>(list).items[0].id;
    const res = await get(`/admin/farms/${id}`, support).expect(200);
    const farm = dataOf<{
      id: string;
      members: { email: string; role: string }[];
      cattleRecords: number;
      subscriptionHistory: unknown[];
    }>(res);
    expect(farm.id).toBe(id);
    expect(Array.isArray(farm.members)).toBe(true);
    expect(typeof farm.cattleRecords).toBe('number');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|totpSecret/);
    await get('/admin/farms/does-not-exist', support).expect(404);
  });

  it('lists and searches users; detail shows memberships and never secrets', async () => {
    const list = await get('/admin/users?limit=5', support).expect(200);
    const users = listOf<{ id: string; email: string; farmCount: number }>(
      list,
    ).items;
    expect(users.length).toBeGreaterThan(0);
    const target = users.find((u) => u.farmCount > 0) ?? users[0];

    const found = await get(
      `/admin/users?search=${encodeURIComponent(target.email)}`,
      support,
    ).expect(200);
    expect(
      listOf<{ id: string }>(found).items.some((u) => u.id === target.id),
    ).toBe(true);

    const res = await get(`/admin/users/${target.id}`, support).expect(200);
    const user = dataOf<{
      mfaConfigured: boolean;
      activeSessionCount: number;
      memberships: unknown[];
    }>(res);
    expect(typeof user.mfaConfigured).toBe('boolean');
    expect(typeof user.activeSessionCount).toBe('number');
    expect(Array.isArray(user.memberships)).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(
      /passwordHash|secret|backupCodes|refreshToken/i,
    );
    await get('/admin/users/does-not-exist', support).expect(404);
  });

  it('overview counters are internally consistent and zero-filled', async () => {
    const res = await get('/admin/overview', content).expect(200);
    const o = dataOf<{
      farms: {
        total: number;
        byStatus: Record<string, number>;
        newLast7Days: number;
        newLast30Days: number;
      };
      users: { total: number; blocked: number };
      signups: { days: number; farms: { day: string; count: number }[] };
    }>(res);
    expect(Object.values(o.farms.byStatus).reduce((a, b) => a + b, 0)).toBe(
      o.farms.total,
    );
    expect(o.farms.newLast7Days).toBeLessThanOrEqual(o.farms.newLast30Days);
    expect(o.users.blocked).toBeLessThanOrEqual(o.users.total);
    expect(o.signups.farms).toHaveLength(o.signups.days);
    const days = o.signups.farms.map((d) => d.day);
    expect([...days].sort()).toEqual(days); // ascending, one point per day
    expect(new Set(days).size).toBe(days.length);
  });

  it('enforces permissions server-side', async () => {
    // CONTENT_ADMIN has neither farm.read nor user.read.
    await get('/admin/farms', content).expect(403);
    await get('/admin/users', content).expect(403);
    // Unauthenticated / garbage tokens never get in.
    await request(server()).get(api('/admin/farms')).expect(401);
    await get('/admin/farms', 'not-a-token').expect(401);
  });
});

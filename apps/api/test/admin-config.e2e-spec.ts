import request from 'supertest';
import { PlatformAdminRole } from '@prisma/client';
import { createTestApp, TestContext } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { purgeAdminAudit } from './utils/admin-audit';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';
import { AdminPlatformConfigService } from '../src/modules/admin/application/services/admin-platform-config.service';

/** Phase 5 feature flags + platform settings. Keys are namespaced per run and removed afterwards. */
describe('Admin platform config (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  const TOTP = 'JBSWY3DPEHPK3PXP';
  const stamp = Date.now();
  const adminIds: string[] = [];
  const flagKey = `e2e.flag.${stamp}`;
  const settingKey = `e2e.setting.${stamp}`;
  const reason = 'Piloting the new flow with one farm first';
  let superT: string;
  let support: string;
  let superId: string;

  const api = (p: string) => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const as = (token: string) => ({
    get: (p: string) =>
      request(server()).get(api(p)).set('Authorization', `Bearer ${token}`),
    post: (p: string, b?: object) =>
      request(server())
        .post(api(p))
        .set('Authorization', `Bearer ${token}`)
        .send(b),
    patch: (p: string, b?: object) =>
      request(server())
        .patch(api(p))
        .set('Authorization', `Bearer ${token}`)
        .send(b),
    put: (p: string, b?: object) =>
      request(server())
        .put(api(p))
        .set('Authorization', `Bearer ${token}`)
        .send(b),
    del: (p: string, b?: object) =>
      request(server())
        .delete(api(p))
        .set('Authorization', `Bearer ${token}`)
        .send(b),
  });
  const dataOf = <T>(res: request.Response) => (res.body as { data: T }).data;

  async function makeAdmin(
    role: PlatformAdminRole,
  ): Promise<{ id: string; token: string }> {
    const email = `p5-cfg-${role.toLowerCase()}-${stamp}@rakhal.test`;
    const password = 'P5CfgE2Epass1234';
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
    return {
      id: admin.id,
      token: dataOf<{ accessToken: string }>(res).accessToken,
    };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    const s = await makeAdmin('SUPER_ADMIN');
    superT = s.token;
    superId = s.id;
    support = (await makeAdmin('SUPPORT_ADMIN')).token;
  }, 40_000);

  afterAll(async () => {
    await prisma.platformFeatureFlag.deleteMany({
      where: { key: { startsWith: 'e2e.flag.' } },
    });
    await prisma.platformSetting.deleteMany({
      where: { key: { startsWith: 'e2e.setting.' } },
    });
    for (const id of adminIds) {
      await purgeAdminAudit(prisma, id);
      await prisma.platformAdmin
        .delete({ where: { id } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('flag lifecycle: create, evaluate, update with before/after audit, delete', async () => {
    const created = await as(superT)
      .post('/admin/config/flags', {
        key: flagKey,
        description: 'pilot',
        reason,
      })
      .expect(201);
    expect(dataOf<{ enabled: boolean }>(created).enabled).toBe(false);

    const config = ctx.app.get(AdminPlatformConfigService);
    expect(await config.isEnabled(flagKey, 'farm-1')).toBe(false);
    expect(await config.isEnabled('e2e.flag.does-not-exist')).toBe(false);

    // Pilot farm only.
    await as(superT)
      .patch(`/admin/config/flags/${flagKey}`, { farmIds: ['farm-1'], reason })
      .expect(200);
    expect(await config.isEnabled(flagKey, 'farm-1')).toBe(true);
    expect(await config.isEnabled(flagKey, 'farm-2')).toBe(false);

    // Globally on.
    await as(superT)
      .patch(`/admin/config/flags/${flagKey}`, { enabled: true, reason })
      .expect(200);
    expect(await config.isEnabled(flagKey, 'farm-2')).toBe(true);

    const row = await prisma.platformAdminAuditLog.findFirstOrThrow({
      where: { action: 'FEATURE_FLAG_UPDATED', entityId: flagKey },
      orderBy: { createdAt: 'desc' },
    });
    expect((row.before as { enabled: boolean }).enabled).toBe(false);
    expect((row.after as { enabled: boolean }).enabled).toBe(true);
    expect((row.metadata as { reason: string }).reason).toBe(reason);
    expect(row.adminId).toBe(superId);

    await as(superT)
      .del(`/admin/config/flags/${flagKey}`, { reason })
      .expect(200);
    expect(await config.isEnabled(flagKey)).toBe(false);
  });

  it('validates flags: key shape, duplicates, reason, unknown flag', async () => {
    await as(superT)
      .post('/admin/config/flags', { key: 'Bad Key', reason })
      .expect(400);
    await as(superT)
      .post('/admin/config/flags', { key: `e2e.flag.noreason.${stamp}` })
      .expect(400);
    await as(superT)
      .post('/admin/config/flags', { key: `e2e.flag.dup.${stamp}`, reason })
      .expect(201);
    await as(superT)
      .post('/admin/config/flags', { key: `e2e.flag.dup.${stamp}`, reason })
      .expect(409);
    await as(superT)
      .patch('/admin/config/flags/e2e.flag.nope', { enabled: true, reason })
      .expect(404);
    await as(superT)
      .patch(`/admin/config/flags/e2e.flag.dup.${stamp}`, { enabled: true })
      .expect(400); // no reason
  });

  it('settings: upsert with audit; refuses secret-looking keys and oversized values', async () => {
    const first = await as(superT)
      .put(`/admin/config/settings/${settingKey}`, {
        value: { limit: 5 },
        reason,
      })
      .expect(200);
    expect(dataOf<{ value: { limit: number } }>(first).value.limit).toBe(5);
    await as(superT)
      .put(`/admin/config/settings/${settingKey}`, {
        value: { limit: 9 },
        reason,
      })
      .expect(200);

    const row = await prisma.platformAdminAuditLog.findFirstOrThrow({
      where: { action: 'PLATFORM_SETTING_SET', entityId: settingKey },
      orderBy: { createdAt: 'desc' },
    });
    expect((row.before as { value: { limit: number } }).value.limit).toBe(5);
    expect((row.after as { value: { limit: number } }).value.limit).toBe(9);

    await as(superT)
      .put('/admin/config/settings/e2e.setting.api_key', {
        value: 'abc',
        reason,
      })
      .expect(400);
    await as(superT)
      .put(`/admin/config/settings/${settingKey}.big`, {
        value: 'x'.repeat(5000),
        reason,
      })
      .expect(400);

    const list = await as(superT).get('/admin/config/settings').expect(200);
    expect(
      dataOf<{ key: string }[]>(list).some((s) => s.key === settingKey),
    ).toBe(true);
  });

  it('SUPPORT_ADMIN can read but never change config', async () => {
    await as(support).get('/admin/config/flags').expect(200);
    await as(support).get('/admin/config/settings').expect(200);
    await as(support)
      .post('/admin/config/flags', { key: `e2e.flag.denied.${stamp}`, reason })
      .expect(403);
    await as(support)
      .put(`/admin/config/settings/${settingKey}`, { value: 1, reason })
      .expect(403);
    await request(server()).get(api('/admin/config/flags')).expect(401);
  });
});

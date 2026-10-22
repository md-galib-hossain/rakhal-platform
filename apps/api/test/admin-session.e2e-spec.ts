import request from 'supertest';
import { purgeAdminAudit } from './utils/admin-audit';
import { createTestApp, TestContext } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';
import { AdminTokenService } from '../src/modules/admin/application/services/admin-token.service';

/**
 * P2-01 — platform-admin sessions: refresh rotation + reuse detection, logout,
 * revoke. Uses a **throwaway admin** this suite creates, so revoking sessions
 * can never disturb the shared seeded admin other suites log in as (RD-078).
 */
describe('Admin sessions (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let adminId: string;
  const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
  const email = `p2-01-${Date.now()}@rakhal.test`;
  const password = 'P201SessionE2E123';

  interface LoginData {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  }

  const api = (path: string) => `${ctx.prefix}${path}`;
  const server = () => ctx.app.getHttpServer();

  async function login(): Promise<LoginData> {
    const res = await request(server())
      .post(api('/admin/auth/login'))
      .send({ email, password, code: currentTotpCode(TOTP_SECRET) })
      .expect(201);
    return (res.body as { data: LoginData }).data;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    const passwords = ctx.app.get(PasswordService);
    const admin = await prisma.platformAdmin.create({
      data: {
        email,
        name: 'P2-01 Session Admin',
        passwordHash: await passwords.hashPassword(password),
        role: 'SUPPORT_ADMIN',
        totpSecret: TOTP_SECRET,
        totpEnabled: true,
      },
    });
    adminId = admin.id;
  }, 30_000);

  afterAll(async () => {
    await purgeAdminAudit(prisma, adminId);
    await prisma.platformAdmin.delete({ where: { id: adminId } });
    await ctx.app.close();
  });

  it('login issues an access + refresh token bound to a session', async () => {
    const s = await login();
    expect(s.refreshToken.length).toBeGreaterThan(40);
    const list = await request(server())
      .get(api('/admin/auth/sessions'))
      .set('Authorization', `Bearer ${s.accessToken}`)
      .expect(200);
    const rows = (list.body as { data: { id: string; current: boolean }[] })
      .data;
    expect(rows.find((r) => r.id === s.sessionId)?.current).toBe(true);
    // Only the hash is stored, never the raw token.
    const row = await prisma.platformAdminSession.findUniqueOrThrow({
      where: { id: s.sessionId },
    });
    expect(row.refreshTokenHash).not.toBe(s.refreshToken);
  });

  it('GET /admin/auth/me returns identity + grants and no secrets', async () => {
    const s = await login();
    const res = await request(server())
      .get(api('/admin/auth/me'))
      .set('Authorization', `Bearer ${s.accessToken}`)
      .expect(200);
    const me = (
      res.body as {
        data: {
          email: string;
          role: string;
          mustChangePassword: boolean;
          permissions: string[];
        };
      }
    ).data;
    expect(me.email).toBe(email);
    expect(me.role).toBe('SUPPORT_ADMIN');
    expect(me.mustChangePassword).toBe(false);
    expect(me.permissions).toContain('user.*');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|totpSecret/);
  });

  it('refresh rotates the token; replaying the old one revokes the session', async () => {
    const s = await login();

    const rotated = await request(server())
      .post(api('/admin/auth/refresh'))
      .send({ refreshToken: s.refreshToken })
      .expect(200);
    const next = (rotated.body as { data: LoginData }).data;
    expect(next.refreshToken).not.toBe(s.refreshToken);
    expect(next.sessionId).toBe(s.sessionId);

    // New access token works.
    await request(server())
      .get(api('/admin/auth/sessions'))
      .set('Authorization', `Bearer ${next.accessToken}`)
      .expect(200);

    // Replaying the already-rotated token = theft signal.
    await request(server())
      .post(api('/admin/auth/refresh'))
      .send({ refreshToken: s.refreshToken })
      .expect(401);

    // The whole session is now dead, including the legitimately-rotated token.
    await request(server())
      .get(api('/admin/auth/sessions'))
      .set('Authorization', `Bearer ${next.accessToken}`)
      .expect(401);
    await request(server())
      .post(api('/admin/auth/refresh'))
      .send({ refreshToken: next.refreshToken })
      .expect(401);

    const audit = await prisma.platformAdminAuditLog.findFirst({
      where: { adminId, action: 'SESSION_REUSE_DETECTED' },
    });
    expect(audit?.entityId).toBe(s.sessionId);
  });

  it('logout kills the access token and the refresh token immediately', async () => {
    const s = await login();
    await request(server())
      .post(api('/admin/auth/logout'))
      .set('Authorization', `Bearer ${s.accessToken}`)
      .expect(200);
    await request(server())
      .get(api('/admin/auth/sessions'))
      .set('Authorization', `Bearer ${s.accessToken}`)
      .expect(401);
    await request(server())
      .post(api('/admin/auth/refresh'))
      .send({ refreshToken: s.refreshToken })
      .expect(401);
  });

  it("revokes another of the admin's sessions by id, and 404s on unknown ids", async () => {
    const a = await login();
    const b = await login();

    await request(server())
      .delete(api(`/admin/auth/sessions/${b.sessionId}`))
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    await request(server())
      .get(api('/admin/auth/sessions'))
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(401);
    await request(server())
      .get(api('/admin/auth/sessions'))
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);

    await request(server())
      .delete(api('/admin/auth/sessions/does-not-exist'))
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(404);
  });

  it('logout-others keeps only the calling session', async () => {
    const a = await login();
    const b = await login();
    const res = await request(server())
      .post(api('/admin/auth/logout-others'))
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    expect(
      (res.body as { data: { revoked: number } }).data.revoked,
    ).toBeGreaterThanOrEqual(1);
    await request(server())
      .get(api('/admin/auth/sessions'))
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(401);
    await request(server())
      .get(api('/admin/auth/sessions'))
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
  });

  it('rejects a legacy admin token that has no session id', async () => {
    const tokens = ctx.app.get(AdminTokenService);
    const legacy = await tokens.sign({
      sub: adminId,
      role: 'SUPPORT_ADMIN',
      type: 'platform_admin',
    } as never);
    await request(server())
      .get(api('/admin/auth/sessions'))
      .set('Authorization', `Bearer ${legacy}`)
      .expect(401);
  });

  it('a deactivated admin cannot refresh', async () => {
    const s = await login();
    await prisma.platformAdmin.update({
      where: { id: adminId },
      data: { isActive: false },
    });
    try {
      await request(server())
        .post(api('/admin/auth/refresh'))
        .send({ refreshToken: s.refreshToken })
        .expect(401);
    } finally {
      await prisma.platformAdmin.update({
        where: { id: adminId },
        data: { isActive: true },
      });
    }
  });

  it('refresh rejects an unknown token without leaking why', async () => {
    const res = await request(server())
      .post(api('/admin/auth/refresh'))
      .send({ refreshToken: 'not-a-real-token' })
      .expect(401);
    expect(JSON.stringify(res.body)).toContain('Invalid refresh token');
  });
});

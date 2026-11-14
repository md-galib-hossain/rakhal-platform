import request from 'supertest';
import { PlatformAdminRole } from '@prisma/client';
import { createTestApp, TestContext } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { purgeAdminAudit } from './utils/admin-audit';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import { LegalConsentService } from '../src/modules/compliance/application/services/legal-consent.service';

/**
 * Phase 4 controlled support operations. Everything targets a throwaway farm
 * owner + farm this suite creates, driven by throwaway SUPER/SUPPORT admins, so
 * no shared seeded account is ever suspended, blocked or signed out.
 */
describe('Admin support actions (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  const TOTP = 'JBSWY3DPEHPK3PXP';
  const stamp = Date.now();
  const adminPassword = 'P4SupportE2Epass1';
  const adminIds: string[] = [];
  const userIds: string[] = [];
  const farmIds: string[] = [];
  let superToken: string;
  let supportToken: string;

  const api = (p: string) => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const post = (path: string, token: string, body?: object) =>
    request(server())
      .post(api(path))
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  const reason = 'Support ticket 4821: suspected abuse reported by owner';

  async function makeAdmin(role: PlatformAdminRole): Promise<string> {
    const email = `p4-${role.toLowerCase()}-${stamp}@rakhal.test`;
    const admin = await prisma.platformAdmin.create({
      data: {
        email,
        name: `P4 ${role}`,
        passwordHash: await ctx.app
          .get(PasswordService)
          .hashPassword(adminPassword),
        role,
        totpSecret: TOTP,
        totpEnabled: true,
      },
    });
    adminIds.push(admin.id);
    const res = await request(server())
      .post(api('/admin/auth/login'))
      .send({ email, password: adminPassword, code: currentTotpCode(TOTP) })
      .expect(201);
    return (res.body as { data: { accessToken: string } }).data.accessToken;
  }

  /** A fresh farm owner + farm that this test may suspend, block and sign out freely. */
  async function makeTenant() {
    const passwords = ctx.app.get(PasswordService);
    const email = `p4-owner-${stamp}-${userIds.length}@rakhal.test`;
    const password = 'P4OwnerE2Epass123';
    const user = await prisma.user.create({
      data: {
        email,
        name: 'P4 Owner',
        passwordHash: await passwords.hashPassword(password),
        isEmailVerified: true,
      },
      select: { id: true },
    });
    userIds.push(user.id);
    await ctx.app.get(LegalConsentService).recordConsent(user.id, []);
    const farm = await ctx.app.get(FarmService).create(user.id, {
      name: `P4 Farm ${stamp} ${farmIds.length}`,
    });
    farmIds.push(farm.id);

    const login = () =>
      request(server()).post(api('/auth/login')).send({ email, password });
    const res = await login().expect(201);
    const token = (res.body as { data: { accessToken: string } }).data
      .accessToken;
    return {
      userId: user.id,
      email,
      farmId: farm.id,
      farmName: farm.name,
      token,
      login,
    };
  }

  /** Any farm-scoped route works as a probe; the farm guard runs before the handler. */
  const farmRoute = (token: string) =>
    request(server())
      .get(api('/cattle'))
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    superToken = await makeAdmin('SUPER_ADMIN');
    supportToken = await makeAdmin('SUPPORT_ADMIN');
  }, 40_000);

  afterAll(async () => {
    for (const id of adminIds) {
      await purgeAdminAudit(prisma, id);
      await prisma.platformAdmin
        .delete({ where: { id } })
        .catch(() => undefined);
    }
    for (const id of farmIds) {
      await prisma.farm.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of userIds) {
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
    await ctx.app.close();
  });

  describe('farm suspend / reactivate', () => {
    it('requires a reason and an exact confirmation', async () => {
      const t = await makeTenant();
      const path = `/admin/farms/${t.farmId}/suspend`;
      await post(path, superToken, { confirm: t.farmName }).expect(400); // no reason
      await post(path, superToken, {
        reason: 'too short',
        confirm: t.farmName,
      }).expect(400);
      await post(path, superToken, { reason, confirm: 'wrong name' }).expect(
        400,
      );
      await post(path, superToken, { reason }).expect(400); // no confirm
      // Nothing changed.
      await farmRoute(t.token).expect(200);
    });

    it('suspends with immediate enforcement, is idempotent, and reactivates', async () => {
      const t = await makeTenant();
      await farmRoute(t.token).expect(200);

      const res = await post(`/admin/farms/${t.farmId}/suspend`, superToken, {
        reason,
        confirm: t.farmName,
      }).expect(200);
      expect((res.body as { data: { changed: boolean } }).data.changed).toBe(
        true,
      );

      // The owner's very next farm request is refused.
      await farmRoute(t.token).expect(403);

      // Repeating is a no-op and writes no second audit row.
      const again = await post(`/admin/farms/${t.farmId}/suspend`, superToken, {
        reason,
        confirm: t.farmName,
      }).expect(200);
      expect((again.body as { data: { changed: boolean } }).data.changed).toBe(
        false,
      );
      expect(
        await prisma.platformAdminAuditLog.count({
          where: { action: 'FARM_SUSPENDED', entityId: t.farmId },
        }),
      ).toBe(1);

      const row = await prisma.platformAdminAuditLog.findFirstOrThrow({
        where: { action: 'FARM_SUSPENDED', entityId: t.farmId },
      });
      expect((row.before as { status: string }).status).toBe('ACTIVE');
      expect((row.after as { status: string }).status).toBe('SUSPENDED');
      expect((row.metadata as { reason: string }).reason).toBe(reason);
      expect(row.sessionId).toBeTruthy();

      await post(`/admin/farms/${t.farmId}/reactivate`, superToken, {
        reason: 'Resolved: payment received and verified',
        confirm: t.farmName,
      }).expect(200);
      await farmRoute(t.token).expect(200);
    });

    it('is SUPER_ADMIN only, and 404s on an unknown farm', async () => {
      const t = await makeTenant();
      await post(`/admin/farms/${t.farmId}/suspend`, supportToken, {
        reason,
        confirm: t.farmName,
      }).expect(403);
      await farmRoute(t.token).expect(200);
      await post('/admin/farms/does-not-exist/suspend', superToken, {
        reason,
        confirm: 'x',
      }).expect(404);
    });
  });

  describe('user block / unblock', () => {
    it('blocks (signing the user out at once) and unblocks (sign-in works again)', async () => {
      const t = await makeTenant();
      await farmRoute(t.token).expect(200);

      await post(`/admin/users/${t.userId}/block`, supportToken, {
        reason,
        confirm: 'someone-else@rakhal.test',
      }).expect(400);

      const res = await post(`/admin/users/${t.userId}/block`, supportToken, {
        reason,
        confirm: t.email,
      }).expect(200);
      expect((res.body as { data: { changed: boolean } }).data.changed).toBe(
        true,
      );

      await farmRoute(t.token).expect(401); // existing session is dead
      await t.login().expect(401); // cannot sign in again

      const again = await post(`/admin/users/${t.userId}/block`, supportToken, {
        reason,
        confirm: t.email,
      }).expect(200);
      expect((again.body as { data: { changed: boolean } }).data.changed).toBe(
        false,
      );

      await post(`/admin/users/${t.userId}/unblock`, supportToken, {
        reason: 'Verified identity by phone; false positive',
        confirm: t.email,
      }).expect(200);
      await t.login().expect(201);

      const row = await prisma.platformAdminAuditLog.findFirstOrThrow({
        where: { action: 'USER_BLOCKED', entityId: t.userId },
      });
      expect((row.before as { isBlocked: boolean }).isBlocked).toBe(false);
      expect((row.after as { isBlocked: boolean }).isBlocked).toBe(true);
    });
  });

  describe('password reset + session revoke', () => {
    it('sends a reset (optionally signing the user out) without exposing any secret', async () => {
      const t = await makeTenant();
      await post(`/admin/users/${t.userId}/send-password-reset`, supportToken, {
        reason,
        confirm: 'wrong@rakhal.test',
      }).expect(400);

      const keep = await post(
        `/admin/users/${t.userId}/send-password-reset`,
        supportToken,
        {
          reason,
          confirm: t.email,
        },
      ).expect(200);
      expect(JSON.stringify(keep.body)).not.toMatch(/token|password/i);
      await farmRoute(t.token).expect(200); // still signed in

      const out = await post(
        `/admin/users/${t.userId}/send-password-reset`,
        supportToken,
        {
          reason,
          confirm: t.email,
          revokeSessions: true,
        },
      ).expect(200);
      expect(
        (out.body as { data: { revokedSessions: number } }).data
          .revokedSessions,
      ).toBeGreaterThanOrEqual(1);
      await farmRoute(t.token).expect(401);

      await post(
        '/admin/users/does-not-exist/send-password-reset',
        supportToken,
        {
          reason,
          confirm: 'x@y.z',
        },
      ).expect(404);
    });

    it('revoke-sessions needs a reason + confirmation and kills the session', async () => {
      const t = await makeTenant();
      await post(
        `/admin/users/${t.userId}/revoke-sessions`,
        supportToken,
      ).expect(400);
      await farmRoute(t.token).expect(200);

      await post(`/admin/users/${t.userId}/revoke-sessions`, supportToken, {
        reason,
        confirm: t.email,
      }).expect(200);
      await farmRoute(t.token).expect(401);

      const row = await prisma.platformAdminAuditLog.findFirstOrThrow({
        where: { action: 'USER_SESSIONS_REVOKED', entityId: t.userId },
      });
      expect((row.metadata as { reason: string }).reason).toBe(reason);
    });
  });
});

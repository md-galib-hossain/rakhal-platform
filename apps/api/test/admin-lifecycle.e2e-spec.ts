import request from 'supertest';
import { PlatformAdminRole } from '@prisma/client';
import { createTestApp, TestContext } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { purgeAdminAudit } from './utils/admin-audit';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';

/**
 * P2-04 structured audit + P2-05 admin lifecycle. Everything runs as a
 * throwaway SUPER_ADMIN this suite creates (never the shared seeded admin), and
 * onboards created admins through the real flow: temp password -> 2FA setup ->
 * forced password change.
 */
describe('Admin lifecycle + structured audit (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  const stamp = Date.now();
  const actorEmail = `p2-05-actor-${stamp}@rakhal.test`;
  const actorPassword = 'P205ActorE2Epass1';
  const actorTotp = 'JBSWY3DPEHPK3PXP';
  const createdIds: string[] = [];
  const failedEmails: string[] = [];
  let actorId: string;
  let actorToken: string;

  const api = (p: string) => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const data = <T>(res: request.Response) => (res.body as { data: T }).data;

  function loginRaw(email: string, password: string, code?: string) {
    return request(server())
      .post(api('/admin/auth/login'))
      .set('User-Agent', 'lifecycle-e2e/1.0')
      .send({ email, password, ...(code ? { code } : {}) });
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    const passwords = ctx.app.get(PasswordService);
    const actor = await prisma.platformAdmin.create({
      data: {
        email: actorEmail,
        name: 'P2-05 Actor',
        passwordHash: await passwords.hashPassword(actorPassword),
        role: 'SUPER_ADMIN',
        totpSecret: actorTotp,
        totpEnabled: true,
      },
    });
    actorId = actor.id;
    createdIds.push(actorId);
    const res = await loginRaw(
      actorEmail,
      actorPassword,
      currentTotpCode(actorTotp),
    ).expect(201);
    actorToken = data<{ accessToken: string }>(res).accessToken;
  }, 30_000);

  afterAll(async () => {
    // Targets first, the actor last: the actor's audit rows reference the targets by id only.
    for (const id of [...createdIds].reverse()) {
      await purgeAdminAudit(prisma, id, id === actorId ? failedEmails : []);
      await prisma.platformAdmin
        .delete({ where: { id } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  /** create -> setup 2FA -> enable -> login; returns the target's access token (password still temporary). */
  async function onboard(role: PlatformAdminRole) {
    const email = `p2-05-${role.toLowerCase()}-${stamp}-${createdIds.length}@rakhal.test`;
    const created = await request(server())
      .post(api('/admin/admins'))
      .set('Authorization', `Bearer ${actorToken}`)
      .send({ email, name: `P2-05 ${role}`, role })
      .expect(201);
    const body = data<{
      admin: { id: string; mustChangePassword: boolean };
      temporaryPassword: string;
    }>(created);
    createdIds.push(body.admin.id);
    expect(body.admin.mustChangePassword).toBe(true);

    const first = await loginRaw(email, body.temporaryPassword).expect(201);
    const { setupToken, twoFactorSetupRequired } = data<{
      setupToken: string;
      twoFactorSetupRequired: boolean;
    }>(first);
    expect(twoFactorSetupRequired).toBe(true);

    const setup = await request(server())
      .post(api('/admin/auth/2fa/setup'))
      .set('Authorization', `Bearer ${setupToken}`)
      .expect(201);
    const { secret } = data<{ secret: string }>(setup);
    await request(server())
      .post(api('/admin/auth/2fa/enable'))
      .set('Authorization', `Bearer ${setupToken}`)
      .send({ code: currentTotpCode(secret) })
      .expect(201);

    const full = await loginRaw(
      email,
      body.temporaryPassword,
      currentTotpCode(secret),
    ).expect(201);
    return {
      id: body.admin.id,
      email,
      secret,
      temporaryPassword: body.temporaryPassword,
      token: data<{ accessToken: string }>(full).accessToken,
    };
  }

  const STRONG = 'Another-Strong-Pass-9';

  it('onboards an admin: temp password blocks every route until changed', async () => {
    const t = await onboard('SUPPORT_ADMIN');

    const blocked = await request(server())
      .get(api('/admin/audit'))
      .set('Authorization', `Bearer ${t.token}`)
      .expect(403);
    expect(JSON.stringify(blocked.body)).toContain('PASSWORD_CHANGE_REQUIRED');

    await request(server())
      .post(api('/admin/auth/change-password'))
      .set('Authorization', `Bearer ${t.token}`)
      .send({ currentPassword: t.temporaryPassword, newPassword: 'short1A' })
      .expect(400);
    await request(server())
      .post(api('/admin/auth/change-password'))
      .set('Authorization', `Bearer ${t.token}`)
      .send({ currentPassword: 'wrong-current-pw', newPassword: STRONG })
      .expect(401);
    await request(server())
      .post(api('/admin/auth/change-password'))
      .set('Authorization', `Bearer ${t.token}`)
      .send({ currentPassword: t.temporaryPassword, newPassword: STRONG })
      .expect(200);

    await request(server())
      .get(api('/admin/audit'))
      .set('Authorization', `Bearer ${t.token}`)
      .expect(200);
  });

  it('a non-SUPER admin cannot manage admins (server-side)', async () => {
    const t = await onboard('SUPPORT_ADMIN');
    await request(server())
      .post(api('/admin/auth/change-password'))
      .set('Authorization', `Bearer ${t.token}`)
      .send({ currentPassword: t.temporaryPassword, newPassword: STRONG })
      .expect(200);
    await request(server())
      .get(api('/admin/admins'))
      .set('Authorization', `Bearer ${t.token}`)
      .expect(403);
    await request(server())
      .post(api('/admin/admins'))
      .set('Authorization', `Bearer ${t.token}`)
      .send({
        email: `x-${stamp}@rakhal.test`,
        name: 'X',
        role: 'SUPER_ADMIN',
      })
      .expect(403);
  });

  it('rejects a duplicate email and never returns secrets', async () => {
    const t = await onboard('CONTENT_ADMIN');
    await request(server())
      .post(api('/admin/admins'))
      .set('Authorization', `Bearer ${actorToken}`)
      .send({ email: t.email, name: 'Dup', role: 'CONTENT_ADMIN' })
      .expect(409);

    const list = await request(server())
      .get(api('/admin/admins'))
      .set('Authorization', `Bearer ${actorToken}`)
      .expect(200);
    const text = JSON.stringify(list.body);
    expect(text).not.toContain('passwordHash');
    expect(text).not.toContain('totpSecret');
    expect(text).not.toContain(t.secret);
  });

  it('role change is audited with before/after; self role change is refused', async () => {
    const t = await onboard('CONTENT_ADMIN');
    await request(server())
      .patch(api(`/admin/admins/${t.id}`))
      .set('Authorization', `Bearer ${actorToken}`)
      .set('User-Agent', 'lifecycle-e2e/1.0')
      .send({ role: 'BILLING_ADMIN' })
      .expect(200);

    const row = await prisma.platformAdminAuditLog.findFirstOrThrow({
      where: { action: 'ADMIN_ROLE_CHANGED', entityId: t.id },
    });
    expect((row.before as { role: string }).role).toBe('CONTENT_ADMIN');
    expect((row.after as { role: string }).role).toBe('BILLING_ADMIN');
    expect(row.adminId).toBe(actorId);
    expect(row.sessionId).toBeTruthy();
    expect(row.requestId).toBeTruthy();
    expect(row.userAgent).toBe('lifecycle-e2e/1.0');

    await request(server())
      .patch(api(`/admin/admins/${actorId}`))
      .set('Authorization', `Bearer ${actorToken}`)
      .send({ role: 'SUPPORT_ADMIN' })
      .expect(400);
  });

  it('deactivate revokes sessions immediately; cannot deactivate self; activate restores login', async () => {
    const t = await onboard('SUPPORT_ADMIN');
    await request(server())
      .post(api(`/admin/admins/${actorId}/deactivate`))
      .set('Authorization', `Bearer ${actorToken}`)
      .expect(400);

    await request(server())
      .post(api(`/admin/admins/${t.id}/deactivate`))
      .set('Authorization', `Bearer ${actorToken}`)
      .expect(200);
    await request(server())
      .get(api('/admin/auth/sessions'))
      .set('Authorization', `Bearer ${t.token}`)
      .expect(401);
    await loginRaw(
      t.email,
      t.temporaryPassword,
      currentTotpCode(t.secret),
    ).expect(401);

    await request(server())
      .post(api(`/admin/admins/${t.id}/activate`))
      .set('Authorization', `Bearer ${actorToken}`)
      .expect(200);
    await loginRaw(
      t.email,
      t.temporaryPassword,
      currentTotpCode(t.secret),
    ).expect(201);
  });

  it('reset-2fa forces re-enrolment; reset-password issues a new temp password and kills sessions', async () => {
    const t = await onboard('SUPPORT_ADMIN');

    await request(server())
      .post(api(`/admin/admins/${t.id}/reset-2fa`))
      .set('Authorization', `Bearer ${actorToken}`)
      .expect(200);
    await request(server())
      .get(api('/admin/auth/sessions'))
      .set('Authorization', `Bearer ${t.token}`)
      .expect(401);
    const again = await loginRaw(t.email, t.temporaryPassword).expect(201);
    expect(
      data<{ twoFactorSetupRequired: boolean }>(again).twoFactorSetupRequired,
    ).toBe(true);

    const reset = await request(server())
      .post(api(`/admin/admins/${t.id}/reset-password`))
      .set('Authorization', `Bearer ${actorToken}`)
      .expect(200);
    const fresh = data<{
      temporaryPassword: string;
      admin: { mustChangePassword: boolean };
    }>(reset);
    expect(fresh.temporaryPassword).not.toBe(t.temporaryPassword);
    expect(fresh.admin.mustChangePassword).toBe(true);
    await loginRaw(t.email, t.temporaryPassword).expect(401);

    await request(server())
      .post(api(`/admin/admins/${actorId}/reset-password`))
      .set('Authorization', `Bearer ${actorToken}`)
      .expect(400);
  });

  it('records failed logins (unknown email + wrong code) without leaking the reason', async () => {
    const ghost = `ghost-${stamp}@rakhal.test`;
    failedEmails.push(ghost);
    const res = await loginRaw(ghost, 'Whatever-Pass-1234').expect(401);
    expect(JSON.stringify(res.body)).not.toMatch(/UNKNOWN|BAD_/);

    const unknown = await prisma.platformAdminAuditLog.findFirstOrThrow({
      where: { action: 'LOGIN_FAILED', actorEmail: ghost },
    });
    expect(unknown.adminId).toBeNull();
    expect(unknown.outcome).toBe('FAILURE');
    expect((unknown.metadata as { reason: string }).reason).toBe(
      'UNKNOWN_ADMIN',
    );

    await loginRaw(actorEmail, actorPassword, '000000').expect(401);
    const badCode = await prisma.platformAdminAuditLog.findFirstOrThrow({
      where: { action: 'LOGIN_FAILED', adminId: actorId },
      orderBy: { createdAt: 'desc' },
    });
    expect((badCode.metadata as { reason: string }).reason).toBe('BAD_TOTP');
  });

  it('successful login stores user agent, session and request id', async () => {
    const res = await loginRaw(
      actorEmail,
      actorPassword,
      currentTotpCode(actorTotp),
    ).expect(201);
    const { sessionId } = data<{ sessionId: string }>(res);
    const row = await prisma.platformAdminAuditLog.findFirstOrThrow({
      where: { action: 'LOGIN', adminId: actorId, sessionId },
    });
    expect(row.userAgent).toBe('lifecycle-e2e/1.0');
    expect(row.requestId).toBeTruthy();
  });

  it('the audit table is append-only at the database level', async () => {
    const row = await prisma.platformAdminAuditLog.findFirstOrThrow({
      where: { adminId: actorId },
    });
    await expect(
      prisma.platformAdminAuditLog.update({
        where: { id: row.id },
        data: { entityType: 'TAMPERED' },
      }),
    ).rejects.toThrow(/append-only/);
    await expect(
      prisma.platformAdminAuditLog.delete({ where: { id: row.id } }),
    ).rejects.toThrow(/append-only/);
    await expect(
      prisma.platformAdminAuditLog.deleteMany({ where: { id: row.id } }),
    ).rejects.toThrow(/append-only/);
    expect(
      await prisma.platformAdminAuditLog.count({ where: { id: row.id } }),
    ).toBe(1);
  });
});

import request from 'supertest';
import { createTestApp, TestContext } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { purgeAdminAudit } from './utils/admin-audit';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';

/**
 * P2-06 — per-account login lockout (read from the audit trail). Uses a
 * throwaway admin so the shared seeded admin can never be locked out under
 * other suites.
 */
describe('Admin login lockout (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let adminId: string;
  const TOTP = 'JBSWY3DPEHPK3PXP';
  const email = `p2-06-${Date.now()}@rakhal.test`;
  const password = 'P206LockoutE2Epass1';

  const login = (pw: string, code?: string) =>
    request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/auth/login`)
      .send({ email, password: pw, ...(code ? { code } : {}) });

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    const passwords = ctx.app.get(PasswordService);
    const admin = await prisma.platformAdmin.create({
      data: {
        email,
        name: 'P2-06 Lockout',
        passwordHash: await passwords.hashPassword(password),
        role: 'SUPPORT_ADMIN',
        totpSecret: TOTP,
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

  it('locks the account after 5 failures, even for the correct credentials', async () => {
    let wrong: request.Response | undefined;
    for (let i = 0; i < 5; i++) {
      wrong = await login('wrong-password-123').expect(401);
    }

    // Correct password + valid code is still refused while locked, and the client
    // cannot tell a lockout from a wrong password (same status, same message).
    const locked = await login(password, currentTotpCode(TOTP)).expect(401);
    const message = (r: request.Response) =>
      (r.body as { message: string }).message;
    expect(message(locked)).toBe(message(wrong!));

    const lockedRow = await prisma.platformAdminAuditLog.findFirstOrThrow({
      where: { adminId, action: 'LOGIN_FAILED' },
      orderBy: { createdAt: 'desc' },
    });
    expect((lockedRow.metadata as { reason: string }).reason).toBe('LOCKED');
  });

  it('signing in works again once the failures leave the window', async () => {
    // The audit table is append-only; clearing goes through the purge flag exactly
    // like a retention job would (stands in for 15 minutes passing).
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('rakhal.audit_purge', 'on', true)`;
      await tx.platformAdminAuditLog.deleteMany({
        where: { adminId, action: 'LOGIN_FAILED' },
      });
    });

    const ok = await login(password, currentTotpCode(TOTP)).expect(201);
    expect(
      (ok.body as { data: { accessToken: string } }).data.accessToken,
    ).toBeTruthy();
  });
});

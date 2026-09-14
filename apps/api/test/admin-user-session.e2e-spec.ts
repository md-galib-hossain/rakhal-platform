import request from 'supertest';
import { createTestApp, TestContext } from './utils/e2e';
import { AdminTotpService } from '../src/modules/admin/application/services/admin-totp.service';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import { LegalConsentService } from '../src/modules/compliance/application/services/legal-consent.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';

/**
 * New admin-triggered force-revoke of a farm user's sessions
 * (`POST /admin/users/:userId/revoke-sessions`). Verifies the admin route
 * itself works and that a revoked user's next authenticated request 401s —
 * proves this is a real DB-level revoke, not a no-op.
 *
 * RD-078: this test used to revoke the **shared seeded** `owner@demo.rakhal.test`
 * account's sessions — root-caused live (re-ran the failing suites with
 * `--maxWorkers=3` and grepped the actual guard rejection: `SessionGuard`
 * logged `status: "REVOKED"`, not a stale-permissions or admin-token issue as
 * this row's own original note guessed). Every other e2e suite that happens
 * to log in as that same demo owner concurrently — including the other two
 * admin suites — got its session yanked mid-run. Fixed by revoking a
 * dedicated throwaway farm user this suite creates and logs in as itself,
 * matching the row's own prescribed direction (scope the revocation to an
 * account this suite owns) — just applied to the *farm user* being revoked,
 * not the admin doing the revoking.
 */
describe('Admin force-revoke user sessions (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  // Matches prisma/seed.ts's DEMO_ADMIN_TOTP_SECRET — demo-only, non-secret.
  const DEMO_ADMIN_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
  const tempUserIds: string[] = [];
  const tempFarmIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    for (const farmId of tempFarmIds) {
      await prisma.farm
        .delete({ where: { id: farmId } })
        .catch(() => undefined);
    }
    for (const userId of tempUserIds) {
      await prisma.user
        .delete({ where: { id: userId } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  /** A dedicated farm owner this suite creates, logs in as, and revokes — never
   * the shared seeded demo owner, so this test can't step on any other
   * concurrently-running suite's session. */
  async function makeThrowawayFarmOwner(): Promise<{
    userId: string;
    token: string;
  }> {
    const passwordService = ctx.app.get(PasswordService);
    const email = `rd078-revoke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@rakhal.test`;
    const password = 'RD078RevokeE2E123';
    const user = await prisma.user.create({
      data: {
        email,
        name: 'RD-078 Revoke Target',
        passwordHash: await passwordService.hashPassword(password),
        isEmailVerified: true,
      },
      select: { id: true },
    });
    tempUserIds.push(user.id);

    const legal = ctx.app.get(LegalConsentService);
    await legal.recordConsent(user.id, []);

    const farmService = ctx.app.get(FarmService);
    const farm = await farmService.create(user.id, {
      name: `RD-078 Revoke Target Farm ${Date.now()}`,
    });
    tempFarmIds.push(farm.id);

    const login = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/auth/login`)
      .send({ email, password })
      .expect(201);
    const token = (login.body as { data?: { accessToken?: string } }).data
      ?.accessToken;
    if (!token)
      throw new Error('Throwaway farm owner login returned no accessToken');
    return { userId: user.id, token };
  }

  async function adminBearer(): Promise<string> {
    const totp = ctx.app.get(AdminTotpService);
    const res = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/auth/login`)
      .send({
        email: 'admin@rakhal.test',
        password: 'AdminPass123',
        code: totp.currentCode(DEMO_ADMIN_TOTP_SECRET),
      })
      .expect(201);
    const token = (res.body as { data?: { accessToken?: string } }).data
      ?.accessToken;
    if (!token) throw new Error('Admin login returned no accessToken');
    return token;
  }

  it("revokes a farm user's sessions and their next request 401s", async () => {
    const server = ctx.app.getHttpServer();

    const { userId, token: ownerToken } = await makeThrowawayFarmOwner();

    await request(server)
      .get(`${ctx.prefix}/auth/me`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const adminToken = await adminBearer();
    const revoke = await request(server)
      .post(`${ctx.prefix}/admin/users/${userId}/revoke-sessions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect((revoke.body as { success?: boolean }).success).toBe(true);

    await request(server)
      .get(`${ctx.prefix}/auth/me`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(401);
  });
});

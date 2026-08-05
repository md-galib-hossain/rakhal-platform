import request from 'supertest';
import { createTestApp, TestContext } from './utils/e2e';
import { AdminTotpService } from '../src/modules/admin/application/services/admin-totp.service';

/**
 * New admin-triggered force-revoke of a farm user's sessions
 * (`POST /admin/users/:userId/revoke-sessions`). Verifies the admin route
 * itself works and that a revoked user's next authenticated request 401s —
 * proves this is a real DB-level revoke, not a no-op.
 */
describe('Admin force-revoke user sessions (e2e)', () => {
  let ctx: TestContext;
  // Matches prisma/seed.ts's DEMO_ADMIN_TOTP_SECRET — demo-only, non-secret.
  const DEMO_ADMIN_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

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

    const ownerLogin = await request(server)
      .post(`${ctx.prefix}/auth/login`)
      .send({ email: 'owner@demo.rakhal.test', password: 'DemoPass123' })
      .expect(201);
    const ownerToken = (ownerLogin.body as { data?: { accessToken?: string } })
      .data?.accessToken as string;

    const me = await request(server)
      .get(`${ctx.prefix}/auth/me`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const userId = (me.body as { data?: { id?: string } }).data?.id;

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

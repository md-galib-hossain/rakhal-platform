import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';

/**
 * RAKHAL-259 (passwordHash leak fix) + RAKHAL-260 (permissions on `/auth/me`).
 * Found while building the frontend's auth session layer (RFE-003): `GET /auth/me`
 * returned the raw Prisma `User` row, including `passwordHash` in plaintext, and
 * exposed no way for a client to learn its own `resource.action` permission strings.
 */
describe('GET /auth/me — safe fields + permissions (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('never returns passwordHash or any password field', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/auth/me`)
      .set(...bearer(owner))
      .expect(200);

    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(data)).not.toMatch(/\$argon2/);
  });

  it('still returns the expected safe profile fields', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/auth/me`)
      .set(...bearer(owner))
      .expect(200);

    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      email: 'owner@demo.rakhal.test',
      isEmailVerified: expect.any(Boolean),
    });
  });

  it("includes the caller's resource.action permission strings for the token's farm", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/auth/me`)
      .set(...bearer(owner))
      .expect(200);

    const data = (res.body as { data: { permissions: string[] } }).data;
    expect(Array.isArray(data.permissions)).toBe(true);
    // Demo owner's role is seeded with broad access — expect at least one grant.
    expect(data.permissions.length).toBeGreaterThan(0);
  });

  it('degrades to an empty permissions array for a bootstrap-scoped token instead of failing', async () => {
    const boot = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/auth/login`)
      .send({
        email: 'owner@demo.rakhal.test',
        password: 'DemoPass123',
        farmId: 'bootstrap',
      });
    const bootToken = (boot.body as { data: { accessToken: string } }).data
      .accessToken;

    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/auth/me`)
      .set('Authorization', `Bearer ${bootToken}`)
      .expect(200);

    const data = (res.body as { data: { permissions: string[] } }).data;
    expect(data.permissions).toEqual([]);
  });
});

import request from 'supertest';
import { createTestApp, TestContext } from './utils/e2e';

/**
 * WP5a: a native client (`X-Client: mobile`) has no cookie jar. It gets the
 * refresh token in the login body, rotates it through the refresh body with no
 * CSRF dance, and a browser-style request that DOES send the refresh cookie
 * still needs a valid CSRF token.
 */
describe('Auth native client (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  type LoginData = {
    accessToken?: string;
    refreshToken?: string;
    farmId?: string;
  };

  async function mobileLogin() {
    const res = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/auth/login`)
      .set('X-Client', 'mobile')
      .set('X-Device-Name', 'jest-phone')
      .send({ email: 'owner@demo.rakhal.test', password: 'DemoPass123' })
      .expect(201);
    return {
      res,
      data: (res.body as { data: LoginData }).data,
    };
  }

  it('login returns the refresh token in the body and sets no refresh cookie', async () => {
    const { res, data } = await mobileLogin();
    const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];

    expect(data.refreshToken).toEqual(expect.any(String));
    expect(setCookie.some((c) => c.startsWith('rakhal_refresh='))).toBe(false);
  });

  it('a browser login (no X-Client) is unchanged: cookie set, no body token', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/auth/login`)
      .send({ email: 'owner@demo.rakhal.test', password: 'DemoPass123' })
      .expect(201);
    const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];

    expect(setCookie.some((c) => c.startsWith('rakhal_refresh='))).toBe(true);
    expect((res.body as { data: LoginData }).data.refreshToken).toBeUndefined();
  });

  it('refreshes with the body token and no CSRF, rotating the token', async () => {
    const server = ctx.app.getHttpServer();
    const { data } = await mobileLogin();

    const first = await request(server)
      .post(`${ctx.prefix}/auth/refresh`)
      .set('X-Client', 'mobile')
      .send({ farmId: data.farmId, refreshToken: data.refreshToken })
      .expect(201);
    const next = (first.body as { data: LoginData }).data;
    expect(next.accessToken).toEqual(expect.any(String));
    expect(next.refreshToken).toEqual(expect.any(String));
    expect(next.refreshToken).not.toBe(data.refreshToken);

    // The rotated token keeps working.
    await request(server)
      .post(`${ctx.prefix}/auth/refresh`)
      .set('X-Client', 'mobile')
      .send({ farmId: data.farmId, refreshToken: next.refreshToken })
      .expect(201);
  });

  it('rejects a bogus body refresh token', async () => {
    await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/auth/refresh`)
      .send({ farmId: '', refreshToken: 'not-a-real-token' })
      .expect(401);
  });

  it('still requires CSRF when the refresh cookie is sent, even with a body token', async () => {
    const server = ctx.app.getHttpServer();
    const { data } = await mobileLogin();

    await request(server)
      .post(`${ctx.prefix}/auth/refresh`)
      .set('Cookie', `rakhal_refresh=${data.refreshToken}`)
      .send({ farmId: data.farmId, refreshToken: data.refreshToken })
      .expect(403);
  });

  it('logs out with a bearer token and no CSRF, revoking the refresh token', async () => {
    const server = ctx.app.getHttpServer();
    const { data } = await mobileLogin();

    await request(server)
      .post(`${ctx.prefix}/auth/logout`)
      .set('Authorization', `Bearer ${data.accessToken}`)
      .send({})
      .expect(201);

    await request(server)
      .post(`${ctx.prefix}/auth/refresh`)
      .send({ farmId: data.farmId, refreshToken: data.refreshToken })
      .expect(401);
  });
});

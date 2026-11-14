import request from 'supertest';
import { createTestApp, TestContext } from './utils/e2e';

/**
 * Regression test for the refresh-token rotation race that caused frequent
 * forced logouts: two near-simultaneous `/auth/refresh` calls with the same
 * (still-cookied) refresh token used to have the second treated as reuse,
 * revoking the whole session family. `AuthService.refresh()` now replays the
 * first rotation's result for a short grace window instead.
 */
describe('Auth refresh race (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  function extractCookie(setCookie: string[] | undefined, name: string) {
    const header = setCookie?.find((c) => c.startsWith(`${name}=`));
    if (!header) throw new Error(`Cookie ${name} not set`);
    return header.split(';')[0].split('=')[1];
  }

  it('two concurrent refresh calls with the same token both succeed', async () => {
    const server = ctx.app.getHttpServer();

    const login = await request(server)
      .post(`${ctx.prefix}/auth/login`)
      .send({ email: 'owner@demo.rakhal.test', password: 'DemoPass123' })
      .expect(201);
    const refreshToken = extractCookie(
      login.headers['set-cookie'] as unknown as string[],
      'rakhal_refresh',
    );
    const farmId = (login.body as { data?: { farmId?: string } }).data?.farmId;

    const csrfRes = await request(server)
      .get(`${ctx.prefix}/auth/csrf`)
      .set('Cookie', `rakhal_refresh=${refreshToken}`)
      .expect(200);
    const csrfToken = (csrfRes.body as { data?: { csrfToken?: string } }).data
      ?.csrfToken;
    const csrfCookie = extractCookie(
      csrfRes.headers['set-cookie'] as unknown as string[],
      'rakhal_csrf',
    );
    const cookieHeader = `rakhal_refresh=${refreshToken}; rakhal_csrf=${csrfCookie}`;

    const [first, second] = await Promise.all([
      request(server)
        .post(`${ctx.prefix}/auth/refresh`)
        .set('Cookie', cookieHeader)
        .set('X-CSRF-Token', csrfToken as string)
        .send({ farmId }),
      request(server)
        .post(`${ctx.prefix}/auth/refresh`)
        .set('Cookie', cookieHeader)
        .set('X-CSRF-Token', csrfToken as string)
        .send({ farmId }),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(
      (first.body as { data?: { accessToken?: string } }).data?.accessToken,
    ).toEqual(expect.any(String));
    expect(
      (second.body as { data?: { accessToken?: string } }).data?.accessToken,
    ).toEqual(expect.any(String));
  });
});

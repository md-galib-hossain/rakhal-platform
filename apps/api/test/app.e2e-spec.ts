import request from 'supertest';
import { createTestApp, TestContext } from './utils/e2e';

describe('App bootstrap (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/v1/auth/csrf issues a token + cookie', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/auth/csrf`)
      .expect(200);

    const body = res.body as { data?: { csrfToken?: string } };
    expect(body.data?.csrfToken).toEqual(expect.any(String));
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('rakhal_csrf')]),
    );
  });
});

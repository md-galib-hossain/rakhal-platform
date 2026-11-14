import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Transfers are retired: a farm has exactly one financial account (one-account-per-farm), so
 * there is nothing to transfer between. `POST /finance/transfers` answers 409 for everyone who
 * passes the permission gate; the read routes stay so historical transfers remain visible.
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Finance V2 — Transfers retired (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;
  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('POST /finance/transfers is 409 for the owner', async () => {
    await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/finance/transfers`)
      .set(...auth(owner))
      .send({ fromAccountId: 'a', toAccountId: 'b', amount: 1 })
      .expect(409);
  });

  it('POST /finance/transfers is still 403 for a worker (permission gate first)', async () => {
    await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/finance/transfers`)
      .set(...auth(worker))
      .send({})
      .expect(403);
  });

  it('GET /finance/transfers still lists history', async () => {
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/finance/transfers`)
      .set(...auth(owner))
      .expect(200);
  });
});

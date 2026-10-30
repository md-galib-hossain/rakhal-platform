import request from 'supertest';
import { createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-478: GET /animal-events/types serves the code catalogue behind the
 * standard guard chain; a worker (cattle.read) can read it.
 * Requires dev stack + `pnpm seed`.
 */
describe('GET /animal-events/types (e2e)', () => {
  let ctx: TestContext;
  const api = (p: string) => `${ctx.prefix}${p}`;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('rejects an anonymous caller', async () => {
    await request(ctx.app.getHttpServer())
      .get(api('/animal-events/types'))
      .expect(401);
  });

  it('owner and worker both read the full catalogue with chip eligibility', async () => {
    for (const [email, pw] of [
      ['owner@demo.rakhal.test', 'DemoPass123'],
      ['worker@demo.rakhal.test', 'WorkerPass123'],
    ]) {
      const user = await loginAs(ctx, email, pw);
      const res = await request(ctx.app.getHttpServer())
        .get(api('/animal-events/types'))
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
      const types = res.body.data as {
        type: string;
        appliesTo: Record<string, string>;
      }[];
      // 24 catalogue types, plus any custom types this farm has defined.
      expect(
        types.filter((t) => !(t as { customTypeId?: string }).customTypeId),
      ).toHaveLength(24);
      const heat = types.find((t) => t.type === 'HEAT')!;
      expect(heat.appliesTo.MALE).toBe('BLOCK');
      expect(heat.appliesTo.PREGNANT).toBe('WARN');
      expect(types.map((t) => t.type)).toEqual(
        expect.arrayContaining(['ENTER_FATTENING', 'LEAVE_FATTENING']),
      );
    }
  });
});

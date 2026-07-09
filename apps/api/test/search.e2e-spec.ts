import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';

/**
 * RAKHAL-257 — global cross-entity search (Postgres pg_trgm). Proves a farm
 * member can find a cattle by a substring of its tag/name, that a too-short
 * query returns nothing, and that the endpoint is authenticated.
 */
interface SearchHit {
  id: string;
  label: string;
  link: string;
}
interface SearchResponse {
  query: string;
  results: { cattle: SearchHit[]; [k: string]: SearchHit[] };
  total: number;
}

describe('Global search (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let cattleId: string;
  let tagNumber: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const list = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/cattle`)
      .set(...bearer(owner))
      .expect(200);
    const items = (list.body as { data: { id: string; tagNumber: string }[] })
      .data;
    if (!items?.length) throw new Error('no demo cattle — run `pnpm seed`');
    cattleId = items[0].id;
    tagNumber = items[0].tagNumber;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('finds a cattle by its tag number', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/search`)
      .set(...bearer(owner))
      .query({ q: tagNumber })
      .expect(200);
    const data = (res.body as { data: SearchResponse }).data;
    expect(data.total).toBeGreaterThanOrEqual(1);
    const hit = data.results.cattle.find((c) => c.id === cattleId);
    expect(hit).toBeDefined();
    expect(hit?.link).toBe(`/cattle/${cattleId}`);
  });

  it('is fuzzy — a partial substring still matches', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/search`)
      .set(...bearer(owner))
      // A prefix of the tag can match several cattle that share it; a wide limit
      // ensures the target is in the returned set.
      .query({
        q: tagNumber.slice(0, Math.max(2, tagNumber.length - 1)),
        limit: 20,
      })
      .expect(200);
    const data = (res.body as { data: SearchResponse }).data;
    expect(data.results.cattle.some((c) => c.id === cattleId)).toBe(true);
  });

  it('returns nothing for a too-short query', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/search`)
      .set(...bearer(owner))
      .query({ q: 'x' })
      .expect(200);
    expect((res.body as { data: SearchResponse }).data.total).toBe(0);
  });

  it('rejects an unauthenticated search (401)', async () => {
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/search`)
      .query({ q: 'test' })
      .expect(401);
  });
});

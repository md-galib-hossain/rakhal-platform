import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Feed Distribution (§12.5) e2e. Builds a concentration from seeded ingredients,
 * logs distributions (planned-default + actual/refusal overrides), and asserts
 * cost-from-actual, list/detail, validation, and RBAC (worker may LOG via
 * `feed.distribution-log` but cannot READ — has no `feed.read`).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Distribution (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let prisma: PrismaService;

  let ingredientA: { id: string; price: number; name: string };
  let ingredientB: { id: string; price: number };
  let concentrationId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const round2 = (n: number) => Math.round(n * 100) / 100;

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    prisma = ctx.app.get(PrismaService);

    const ings = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    const list = ings.body.data as Array<{
      id: string;
      name_en: string;
      effective_price_per_kg: number;
    }>;
    expect(list.length).toBeGreaterThanOrEqual(2);
    ingredientA = {
      id: list[0].id,
      price: list[0].effective_price_per_kg,
      name: list[0].name_en,
    };
    ingredientB = { id: list[1].id, price: list[1].effective_price_per_kg };

    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        name: `E2E Distribution Formula ${Date.now()}`,
        items: [
          { ingredientId: ingredientA.id, amountKg: 4 },
          { ingredientId: ingredientB.id, amountKg: 2 },
        ],
      })
      .expect(201);
    concentrationId = conc.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('logs a distribution defaulting actual = planned, cost from actual', async () => {
    const res = await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({ concentrationId, distributedAt: '2026-06-15' })
      .expect(201);

    const d = res.body.data;
    expect(d.total_planned_kg).toBe(6);
    expect(d.total_actual_kg).toBe(6);
    const expectedCost = round2(4 * ingredientA.price + 2 * ingredientB.price);
    expect(d.total_actual_cost).toBe(expectedCost);
    expect(d.items).toHaveLength(2);
  });

  it('logs actual/refusal overrides and reflects them in cost', async () => {
    const res = await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({
        concentrationId,
        items: [
          { ingredientId: ingredientA.id, actualKg: 5, refusalKg: 1 },
          // ingredientB omitted → falls back to planned 2kg
        ],
      })
      .expect(201);

    const d = res.body.data;
    expect(d.total_actual_kg).toBe(7); // 5 + 2
    expect(d.total_refusal_kg).toBe(1);
    expect(d.total_actual_cost).toBe(
      round2(5 * ingredientA.price + 2 * ingredientB.price),
    );
  });

  it('lists and fetches distributions for the farm', async () => {
    const list = await request(server())
      .get(api('/feed/distributions'))
      .set(...auth(owner))
      .expect(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data.length).toBeGreaterThanOrEqual(2);
    expect(list.body.meta).toHaveProperty('hasNextPage');

    const id = list.body.data[0].id as string;
    const detail = await request(server())
      .get(api(`/feed/distributions/${id}`))
      .set(...auth(owner))
      .expect(200);
    expect(detail.body.data.id).toBe(id);
    expect(Array.isArray(detail.body.data.items)).toBe(true);
  });

  it('serves a feed-efficiency summary', async () => {
    // The concentration has no group, but the endpoint requires a real group;
    // create a throwaway group to assert the shape resolves (zero distributions).
    const grp = await request(server())
      .post(api('/settings/feed-groups'))
      .set(...auth(owner))
      .send({ name: `E2E Eff Group ${Date.now()}` })
      .expect(201);
    const groupId = grp.body.data.id as string;

    const res = await request(server())
      .get(api(`/feed/efficiency?feedGroupId=${groupId}&month=2026-06`))
      .set(...auth(owner))
      .expect(200);
    expect(res.body.data).toMatchObject({
      feed_group_id: groupId,
      period: '2026-06',
      distributions: 0,
    });
    expect(res.body.data).toHaveProperty('feed_cost_per_litre');
  });

  it('decrements a matching kg-unit forage on log (§15.3)', async () => {
    // Hermetic: remove any same-named forage left by a prior run so the
    // name→forage match is unambiguous (the decrement keys on ingredient name).
    await prisma.forage.deleteMany({
      where: { farmId: owner.farmId, name: ingredientA.name },
    });

    // A forage named exactly like ingredient A, in kg, is the match target.
    const forage = await request(server())
      .post(api('/inventory/forages'))
      .set(...auth(owner))
      .send({
        name: ingredientA.name,
        type: 'ROUGHAGE',
        unit: 'kg',
        currentStock: 100,
        costPerUnit: 10,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    const forageId = forage.body.data.id as string;

    // Default-planned distribution → ingredient A actual = 4 kg.
    const dist = await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({ concentrationId })
      .expect(201);
    expect(dist.body.data.forage_decrements).toBeGreaterThanOrEqual(1);

    const after = await request(server())
      .get(api(`/inventory/forages/${forageId}`))
      .set(...auth(owner))
      .expect(200);
    expect(after.body.data.currentStock).toBe(96); // 100 − 4

    await prisma.forage.deleteMany({ where: { id: forageId } });
  });

  describe('validation + RBAC', () => {
    it('404s an unknown concentration', async () => {
      await request(server())
        .post(api('/feed/distributions'))
        .set(...auth(owner))
        .send({ concentrationId: 'does-not-exist' })
        .expect(404);
    });

    it('400s an ingredient not in the concentration', async () => {
      await request(server())
        .post(api('/feed/distributions'))
        .set(...auth(owner))
        .send({
          concentrationId,
          items: [{ ingredientId: 'not-in-formula', actualKg: 1 }],
        })
        .expect(400);
    });

    it('400s a farmId in the body (forbidNonWhitelisted)', async () => {
      await request(server())
        .post(api('/feed/distributions'))
        .set(...auth(owner))
        .send({ concentrationId, farmId: 'x' })
        .expect(400);
    });

    it('lets a worker LOG a distribution (feed.distribution-log)', async () => {
      await request(server())
        .post(api('/feed/distributions'))
        .set(...auth(worker))
        .send({ concentrationId })
        .expect(201);
    });

    it('forbids a worker from READING distributions (no feed.read)', async () => {
      await request(server())
        .get(api('/feed/distributions'))
        .set(...auth(worker))
        .expect(403);
    });
  });
});

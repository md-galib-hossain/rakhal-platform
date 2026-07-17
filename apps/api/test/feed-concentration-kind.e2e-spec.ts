import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Feed Formulator — Phase 7 of the epic in
 * `C:\Users\mdgal\.claude\plans\composed-pondering-teapot.md` (2026-07-18, no ticket #): splitting
 * "Concentrate Mixer" from "Feed Mixture" via an explicit, immutable `kind` discriminator instead of
 * the old implicit "does it have a target" heuristic. Covers: a template's target fields are nulled
 * server-side even if the caller sends them; a mixture without target fields is rejected; `finalize`
 * only works on a template; `kind` filters `GET /feed/concentrations`; bulk-delete archives multiple
 * rows scoped to the caller's farm.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — concentration kind split (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let ingredientId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const created = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Kind Split Base Ingredient ${Date.now()}`,
        nutrientGroup: 'ENERGY',
        pricePerKg: 15,
        dmPct: 90,
        cpPct: 12,
        meMjPerKgDm: 10,
      })
      .expect(201);
    ingredientId = created.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('a CONCENTRATE_TEMPLATE has its target fields nulled server-side even if sent anyway', async () => {
    const created = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Sneaky Target Template ${Date.now()}`,
        // A future frontend bug (or a hand-crafted request) sending target fields on a template must
        // not resurrect the old bug where everything ended up bucketed as a mixture.
        targetType: 'GROUP',
        targetWeightKg: 400,
        targetMilkL: 15,
        items: [{ ingredientId, amountKg: 10 }],
      })
      .expect(201);
    expect(created.body.data.kind).toBe('CONCENTRATE_TEMPLATE');
    expect(created.body.data.target_weight_kg).toBeNull();
    expect(created.body.data.target_milk_l).toBeNull();
    expect(created.body.data.balance_score).toBeNull();
  });

  it('a FEED_MIXTURE requires targetWeightKg/targetMilkL', async () => {
    await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Incomplete Mixture ${Date.now()}`,
        items: [{ ingredientId, amountKg: 10 }],
      })
      .expect(400);
  });

  it('a real FEED_MIXTURE gets a balance score', async () => {
    const created = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Real Mixture ${Date.now()}`,
        targetType: 'INDIVIDUAL',
        targetWeightKg: 400,
        targetMilkL: 15,
        items: [{ ingredientId, amountKg: 10 }],
      })
      .expect(201);
    expect(created.body.data.kind).toBe('FEED_MIXTURE');
    expect(created.body.data.balance_score).not.toBeNull();
  });

  it('finalize only works on a CONCENTRATE_TEMPLATE, not a FEED_MIXTURE', async () => {
    const mixture = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Mixture Cannot Finalize ${Date.now()}`,
        targetType: 'INDIVIDUAL',
        targetWeightKg: 400,
        targetMilkL: 15,
        items: [{ ingredientId, amountKg: 10 }],
      })
      .expect(201);

    await request(server())
      .post(api(`/feed/concentrations/${mixture.body.data.id}/finalize`))
      .set(...auth(owner))
      .expect(400);

    const template = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Template Can Finalize ${Date.now()}`,
        items: [{ ingredientId, amountKg: 10 }],
      })
      .expect(201);

    await request(server())
      .post(api(`/feed/concentrations/${template.body.data.id}/finalize`))
      .set(...auth(owner))
      .expect(201);
  });

  it('GET /feed/concentrations?kind= filters server-side', async () => {
    const marker = Date.now();
    await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Kind Filter Template ${marker}`,
        items: [{ ingredientId, amountKg: 5 }],
      })
      .expect(201);
    await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Kind Filter Mixture ${marker}`,
        targetType: 'INDIVIDUAL',
        targetWeightKg: 400,
        targetMilkL: 15,
        items: [{ ingredientId, amountKg: 5 }],
      })
      .expect(201);

    const templates = await request(server())
      .get(api('/feed/concentrations?kind=CONCENTRATE_TEMPLATE'))
      .set(...auth(owner))
      .expect(200);
    const templateNames = (
      templates.body.data as Array<{ name: string; kind: string }>
    ).map((c) => c.name);
    expect(templateNames).toContain(`E2E Kind Filter Template ${marker}`);
    expect(templateNames).not.toContain(`E2E Kind Filter Mixture ${marker}`);
    expect(
      (templates.body.data as Array<{ kind: string }>).every(
        (c) => c.kind === 'CONCENTRATE_TEMPLATE',
      ),
    ).toBe(true);

    const mixtures = await request(server())
      .get(api('/feed/concentrations?kind=FEED_MIXTURE'))
      .set(...auth(owner))
      .expect(200);
    const mixtureNames = (
      mixtures.body.data as Array<{ name: string; kind: string }>
    ).map((c) => c.name);
    expect(mixtureNames).toContain(`E2E Kind Filter Mixture ${marker}`);
    expect(mixtureNames).not.toContain(`E2E Kind Filter Template ${marker}`);
  });

  it('bulk-delete archives multiple rows scoped to the farm', async () => {
    const a = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Bulk Delete A ${Date.now()}`,
        items: [{ ingredientId, amountKg: 5 }],
      })
      .expect(201);
    const b = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Bulk Delete B ${Date.now()}`,
        items: [{ ingredientId, amountKg: 5 }],
      })
      .expect(201);

    const result = await request(server())
      .post(api('/feed/concentrations/bulk-delete'))
      .set(...auth(owner))
      .send({ ids: [a.body.data.id, b.body.data.id] })
      .expect(201);
    expect(result.body.data.deleted).toBe(2);

    await request(server())
      .get(api(`/feed/concentrations/${a.body.data.id}`))
      .set(...auth(owner))
      .expect(404);
    await request(server())
      .get(api(`/feed/concentrations/${b.body.data.id}`))
      .set(...auth(owner))
      .expect(404);
  });
});

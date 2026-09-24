import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { seededCashAccountId } from './utils/finance';
import { concentrateDerivedIngredientId, stockIngredient } from './utils/feed';

/**
 * Feed Formulator — Phase 7 of the epic in
 * `C:\Users\mdgal\.claude\plans\composed-pondering-teapot.md` (2026-07-18, no ticket #): splitting
 * "Concentrate Mixer" from "Feed Mixture" via an explicit, immutable `kind` discriminator instead of
 * the old implicit "does it have a target" heuristic. Covers: a template's target fields are nulled
 * server-side even if the caller sends them; a mixture without target fields is rejected; `finalize`
 * behaves differently by kind (updated Phase 12.2, 2026-07-18 — a mixture can now finalize too, but
 * produces stock only, no ingredient promotion; RAKHAL-421 2026-09-13, closes RD-080 — a template's
 * finalize also produces a `FeedStock` lot now (`kind: CONCENTRATE_TEMPLATE`), replacing the
 * 2026-07-19-then-RAKHAL-406 detour through a plain Inventory `FeedItem`; only the ingredient
 * promotion remains template-only); `kind` filters `GET /feed/concentrations`;
 * bulk-delete archives multiple rows scoped to the caller's farm.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — concentration kind split (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  /** RD-077: RAKHAL-393 made this mandatory on a TMR finalize. */
  let financialAccountId: string;
  let ownerUserId: string;
  let ingredientId: string;
  /** RAKHAL-425: every FEED_MIXTURE below needs one line using this. */
  let concentrateIngredientId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    financialAccountId = await seededCashAccountId(ctx, owner);
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;

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
    // Finalize consumes inventory (no wallet, no buying) — stock the base ingredient at its price.
    await stockIngredient(ctx, owner, ingredientId, { costPerKg: 15 });
    concentrateIngredientId = await concentrateDerivedIngredientId(ctx, owner);
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

  it('a FEED_MIXTURE requires targetWeightKg/targetMilkL when no cow/group target is given', async () => {
    await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Incomplete Mixture ${Date.now()}`,
        durationDays: 30,
        items: [{ ingredientId, amountKg: 10 }],
      })
      .expect(400);
  });

  it('a FEED_MIXTURE requires durationDays', async () => {
    await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E No Duration Mixture ${Date.now()}`,
        targetType: 'INDIVIDUAL',
        targetWeightKg: 400,
        targetMilkL: 15,
        items: [{ ingredientId, amountKg: 10 }],
      })
      .expect(400);
  });

  it('a FEED_MIXTURE built purely from catalogue ingredients — no concentrate-derived line — is rejected (RAKHAL-425)', async () => {
    const res = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E No Concentrate Line Mixture ${Date.now()}`,
        targetType: 'INDIVIDUAL',
        targetWeightKg: 400,
        targetMilkL: 15,
        durationDays: 30,
        items: [{ ingredientId, amountKg: 10 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Concentrate Mixer');
  });

  it('a FEED_MIXTURE targeting a real cow resolves targetWeightKg/targetMilkL from her records when omitted (Phase 12.3, 2026-07-18)', async () => {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-KIND-${Date.now()}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
        lastWeightKg: 425,
      },
    });

    const created = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Auto-Resolved Mixture ${Date.now()}`,
        targetType: 'INDIVIDUAL',
        cattleId: cow.id,
        durationDays: 30,
        // targetWeightKg/targetMilkL deliberately omitted — must resolve from the cow's own
        // record (weight) and fall back to 0/assumed (no milk logs for this brand-new test cow),
        // not 400 just because the manual fields were left blank.
        items: [
          { ingredientId, amountKg: 10 },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(201);
    expect(created.body.data.target_weight_kg).toBeCloseTo(425, 1);
    expect(created.body.data.target_milk_l).toBeCloseTo(0, 1);
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
        durationDays: 30,
        items: [
          { ingredientId, amountKg: 10 },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(201);
    expect(created.body.data.kind).toBe('FEED_MIXTURE');
    expect(created.body.data.balance_score).not.toBeNull();
  });

  it('finalize behaves differently by kind — CONCENTRATE_TEMPLATE promotes an ingredient AND produces stock, FEED_MIXTURE produces stock only (RAKHAL-421)', async () => {
    const mixture = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Mixture Finalize ${Date.now()}`,
        targetType: 'INDIVIDUAL',
        targetWeightKg: 400,
        targetMilkL: 15,
        durationDays: 30,
        items: [
          { ingredientId, amountKg: 10 },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(201);

    const mixtureFinalized = await request(server())
      .post(api(`/feed/concentrations/${mixture.body.data.id}/finalize`))
      .set(...auth(owner))
      .send({ paymentMethod: 'CASH', financialAccountId })
      .expect(201);
    // A Feed Mixture (TMR) is the final ration, not an intermediate recipe — finalize produces
    // only a FeedStock lot, never a reusable ingredient (user request 2026-07-18).
    expect(mixtureFinalized.body.data.ingredient).toBeNull();
    expect(mixtureFinalized.body.data.stock).toBeTruthy();
    expect(mixtureFinalized.body.data.stock.produced_qty_kg).toBeCloseTo(10, 1);

    const listAfterMixtureFinalize = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    expect(
      (listAfterMixtureFinalize.body.data as Array<{ id: string }>).some(
        (i) => i.id === mixture.body.data.id,
      ),
    ).toBe(false);

    const template = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Template Can Finalize ${Date.now()}`,
        items: [{ ingredientId, amountKg: 10 }],
      })
      .expect(201);

    const templateFinalized = await request(server())
      .post(api(`/feed/concentrations/${template.body.data.id}/finalize`))
      .set(...auth(owner))
      // RAKHAL-428: unlinked cost now requires a financialAccountId.
      .send({ financialAccountId })
      .expect(201);
    // RAKHAL-421 (closes RD-080): a Concentrate Mixer finalize now also produces a FeedStock
    // batch (kind: CONCENTRATE_TEMPLATE) alongside the promoted ingredient — the earlier
    // 2026-07-19 "virtual, no inventory at all" stance is superseded.
    expect(templateFinalized.body.data.ingredient).toBeTruthy();
    expect(templateFinalized.body.data.stock).toBeTruthy();
    expect(templateFinalized.body.data.stock.kind).toBe('CONCENTRATE_TEMPLATE');
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
        durationDays: 30,
        items: [
          { ingredientId, amountKg: 5 },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
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

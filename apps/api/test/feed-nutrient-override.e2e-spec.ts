import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Feed Formulator — unified nutrient schema, Phase 1 (2026-07-17, no ticket #). Extends
 * `FeedIngredientOverride` to the full 12-nutrient set (ADF/Calcium/Phosphorus/TDN added; RDP/RUP/
 * Starch wired up — previously dead columns). Asserts a farm can override one of the new fields on
 * an ingredient, that `resolveEffective` merges it correctly (untouched fields fall through), and
 * that `computeTotals` picks up the new fields' contribution in a concentration — including the
 * RDP/RUP-off-CP basis (not off-DM).
 *
 * Overrides a **freshly-created custom ingredient** (own row, own farm) rather than a shared
 * catalogue row: e2e suites run in parallel Jest workers against one shared dev DB, and a seeded
 * catalogue ingredient's override can be touched by other concurrently-running suites/seed data —
 * a custom ingredient created inside this test is exclusively ours.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — nutrient override (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function ownIngredient(): Promise<string> {
    const created = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Override Target ${Date.now()}-${Math.random()}`,
        nutrientGroup: 'ENERGY',
        pricePerKg: 25,
      })
      .expect(201);
    return created.body.data.id as string;
  }

  it('overrides ADF/Calcium/Phosphorus/TDN and leaves other fields at catalogue values', async () => {
    const ingredientId = await ownIngredient();
    const res = await request(server())
      .post(api(`/feed/ingredients/${ingredientId}/override`))
      .set(...auth(owner))
      .send({
        customAdfPct: 12,
        customCalciumPct: 0.5,
        customPhosphorusPct: 0.3,
        customTdnPct: 68,
      })
      .expect(201);
    expect(res.body.data.customAdfPct).toBe(12);
    expect(res.body.data.customCalciumPct).toBe(0.5);

    const list = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    const ing = (
      list.body.data as Array<{ id: string; nutrition: Record<string, number> }>
    ).find((i) => i.id === ingredientId);
    expect(ing?.nutrition.adf_pct).toBe(12);
    expect(ing?.nutrition.calcium_pct).toBe(0.5);
    expect(ing?.nutrition.phosphorus_pct).toBe(0.3);
    expect(ing?.nutrition.tdn_pct).toBe(68);
    // Untouched field falls through to the custom ingredient's own baseline (fatPct=0 quick-add default).
    expect(ing?.nutrition.fat_pct).toBe(0);
  });

  it('computes RDP/RUP contribution off cp_kg (not dm_kg) in a concentration', async () => {
    const ingredientId = await ownIngredient();
    await request(server())
      .post(api(`/feed/ingredients/${ingredientId}/override`))
      .set(...auth(owner))
      .send({
        customDmPct: 90,
        customCpPct: 20,
        customRdpPct: 60, // 60% of CP is RDP
        customRupPct: 40,
      })
      .expect(201);

    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E RDP/RUP Basis Check ${Date.now()}`,
        items: [{ ingredientId, amountKg: 10 }],
      })
      .expect(201);

    const totals = conc.body.data.totals;
    // dm_kg = 10 * 0.90 = 9; cp_kg = 9 * 0.20 = 1.8; rdp_kg = 1.8 * 0.60 = 1.08 (off CP, not DM)
    expect(totals.dm_kg).toBeCloseTo(9, 2);
    expect(totals.cp_kg).toBeCloseTo(1.8, 2);
    expect(totals.rdp_kg).toBeCloseTo(1.08, 2);
    expect(totals.rup_kg).toBeCloseTo(0.72, 2);
  });
});

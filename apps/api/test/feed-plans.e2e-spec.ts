import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-455 (MILESTONE 27) — Feed Plans: CRUD + `/fit`. Covers line validation (only feedable
 * things, kind-appropriate, no duplicates, kg > 0), name uniqueness among ACTIVE plans, "made for"
 * reference capture, soft delete, supply-vs-requirement fit, RBAC, and that a plan never moves stock.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Plans (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;

  let feedItemId: string;
  let tmrId: string;
  let concentrateId: string;
  let cow: string;
  const created: string[] = [];

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const stamp = Date.now();
  const nm = (l: string) => `E2E Plan ${l} ${stamp}`;

  const itemLine = (kg = 10) => ({
    lineType: 'FEED_ITEM',
    feedItemId,
    kgPerDay: kg,
  });
  const tmrLine = (kg = 5) => ({
    lineType: 'PREPARED',
    concentrationId: tmrId,
    kgPerDay: kg,
  });

  const post = (body: Record<string, unknown>, u: AuthedUser = owner) =>
    request(server())
      .post(api('/feed/plans'))
      .set(...auth(u))
      .send(body);

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');

    const c = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({ tagNumber: `E2E-PLAN-${stamp}`, gender: 'FEMALE', weightKg: 400 })
      .expect(201);
    cow = c.body.data.id as string;

    const ing = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Plan Ingredient ${stamp}`,
        pricePerKg: 8,
        dmPct: 35,
        cpPct: 8,
      })
      .expect(201);
    const fi = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E Plan Silage ${stamp}`,
        feedClass: 'FORAGE',
        ingredientId: ing.body.data.id,
        unitId: 'unit_kg',
        currentStock: 500,
        costPerUnit: 8,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    feedItemId = fi.body.data.id as string;

    const mk = async (kind: 'FEED_MIXTURE' | 'CONCENTRATE_TEMPLATE') => {
      const recipe = await prisma.feedConcentration.create({
        data: {
          farmId: owner.farmId,
          kind,
          name: `E2E Plan ${kind} ${stamp}`,
          createdBy: 'e2e-test-setup',
        },
      });
      const profile = await prisma.nutritionProfile.create({
        data: {
          farmId: owner.farmId,
          dmPct: 90,
          cpPct: 16,
          meMjPerKgDm: 10,
          fatPct: 3,
          ndfPct: 30,
          rdpPct: 60,
          rupPct: 40,
          starchPct: 20,
          adfPct: 20,
          calciumPct: 1,
          phosphorusPct: 0.5,
          tdnPct: 70,
          nutritionSource: 'REFERENCE',
          createdBy: 'e2e-test-setup',
        },
      });
      await prisma.feedStock.create({
        data: {
          farmId: owner.farmId,
          kind,
          sourceConcentrationId: recipe.id,
          sourceConcentrationVersion: 1,
          producedAt: new Date(),
          producedQtyKg: 100,
          currentStockKg: 100,
          producedCostTk: 800,
          createdBy: 'e2e-test-setup',
          nutritionProfileId: profile.id,
        },
      });
      return recipe.id;
    };
    tmrId = await mk('FEED_MIXTURE');
    concentrateId = await mk('CONCENTRATE_TEMPLATE');
  }, 40_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('creates a plan over a bought item + a made recipe, without touching stock', async () => {
    const before = await prisma.feedItemBatch.aggregate({
      where: { feedItemId },
      _sum: { currentStock: true },
    });
    const res = await post({
      name: nm('Main'),
      lines: [itemLine(10), tmrLine(5)],
    }).expect(201);
    created.push(res.body.data.id as string);
    const d = res.body.data as {
      total_kg_per_day: number;
      lines: Array<{ name: string; line_type: string }>;
      kind: string;
    };
    expect(d.kind).toBe('PLAN');
    expect(d.total_kg_per_day).toBe(15);
    expect(d.lines.map((l) => l.line_type)).toEqual(['FEED_ITEM', 'PREPARED']);
    expect(d.lines[0].name).toContain('E2E Plan Silage');

    const after = await prisma.feedItemBatch.aggregate({
      where: { feedItemId },
      _sum: { currentStock: true },
    });
    expect(after._sum.currentStock).toBe(before._sum.currentStock);
  });

  it('lists with search + cursor meta, and gets by id', async () => {
    const list = await request(server())
      .get(api(`/feed/plans?search=${encodeURIComponent(nm('Main'))}`))
      .set(...auth(owner))
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta).toBeDefined();
    const id = list.body.data[0].id as string;
    await request(server())
      .get(api(`/feed/plans/${id}`))
      .set(...auth(owner))
      .expect(200);
  });

  describe('validation', () => {
    it('rejects a duplicate line target', async () => {
      await post({
        name: nm('Dup'),
        lines: [itemLine(5), itemLine(6)],
      }).expect(400);
    });

    it('rejects an unknown feed item (catalogue-only ingredients are not feedable)', async () => {
      await post({
        name: nm('Ghost'),
        lines: [{ lineType: 'FEED_ITEM', feedItemId: 'nope', kgPerDay: 3 }],
      }).expect(400);
    });

    it('rejects kgPerDay <= 0 and a line with no target', async () => {
      await post({ name: nm('Zero'), lines: [itemLine(0)] }).expect(400);
      await post({
        name: nm('Neither'),
        lines: [{ lineType: 'FEED_ITEM', kgPerDay: 3 }],
      }).expect(400);
    });

    it('rejects made-for both a cow and a group', async () => {
      await post({
        name: nm('Both'),
        madeForCattleId: cow,
        madeForAnimalGroupId: 'x',
        lines: [itemLine()],
      }).expect(400);
    });

    it('enforces shortcut shape: TMR_SHORTCUT is exactly one TMR recipe line', async () => {
      await post({
        name: nm('BadTmr'),
        kind: 'TMR_SHORTCUT',
        lines: [tmrLine(5), itemLine(2)],
      }).expect(400);
      await post({
        name: nm('WrongKind'),
        kind: 'TMR_SHORTCUT',
        lines: [
          { lineType: 'PREPARED', concentrationId: concentrateId, kgPerDay: 3 },
        ],
      }).expect(400);
      const ok = await post({
        name: nm('GoodTmr'),
        kind: 'TMR_SHORTCUT',
        lines: [tmrLine(20)],
      }).expect(201);
      created.push(ok.body.data.id as string);
    });

    it('409s a duplicate ACTIVE name (case-insensitive); an archived name can be reused', async () => {
      await post({
        name: nm('main').toUpperCase(),
        lines: [itemLine()],
      }).expect(409);
      const a = await post({ name: nm('Reuse'), lines: [itemLine()] }).expect(
        201,
      );
      await request(server())
        .delete(api(`/feed/plans/${a.body.data.id}`))
        .set(...auth(owner))
        .expect(200);
      const b = await post({ name: nm('Reuse'), lines: [itemLine()] }).expect(
        201,
      );
      created.push(b.body.data.id as string);
    });
  });

  it('captures the reference requirement when made for a cow', async () => {
    const res = await post({
      name: nm('ForCow'),
      madeForCattleId: cow,
      lines: [itemLine(12), tmrLine(4)],
    }).expect(201);
    created.push(res.body.data.id as string);
    expect(res.body.data.reference_requirement).toMatchObject({
      basis: 'COW',
      headcount: 1,
    });
    expect(res.body.data.reference_requirement.dm_kg).toBeGreaterThan(0);
  });

  it('PATCH: name-only keeps the lines; lines replace the whole set', async () => {
    const res = await post({ name: nm('Patch'), lines: [itemLine(8)] }).expect(
      201,
    );
    const id = res.body.data.id as string;
    created.push(id);

    const renamed = await request(server())
      .patch(api(`/feed/plans/${id}`))
      .set(...auth(owner))
      .send({ name: nm('Patched') })
      .expect(200);
    expect(renamed.body.data.lines).toHaveLength(1);

    const replaced = await request(server())
      .patch(api(`/feed/plans/${id}`))
      .set(...auth(owner))
      .send({ lines: [tmrLine(6), itemLine(2)] })
      .expect(200);
    expect(replaced.body.data.lines).toHaveLength(2);
    expect(replaced.body.data.total_kg_per_day).toBe(8);
  });

  describe('fit', () => {
    it('returns per-line supply and per-cow delta vs requirement', async () => {
      const res = await post({
        name: nm('Fit'),
        lines: [itemLine(10), tmrLine(5)],
      }).expect(201);
      const id = res.body.data.id as string;
      created.push(id);

      const fit = await request(server())
        .get(api(`/feed/plans/${id}/fit?cattleIds=${cow},ghost-cow`))
        .set(...auth(owner))
        .expect(200);
      const d = fit.body.data as {
        lines: Array<{ density: unknown; stock_ok: boolean }>;
        supply: { as_fed_kg: number; dm_kg: number };
        supply_complete: boolean;
        cows: Array<{
          cattle_id: string;
          requirement: { dm_kg: number };
          delta_pct: { dm: number | null };
        }>;
        missing_cattle_ids: string[];
      };
      expect(d.lines).toHaveLength(2);
      expect(d.lines.every((l) => l.density != null && l.stock_ok)).toBe(true);
      expect(d.supply_complete).toBe(true);
      expect(d.supply.as_fed_kg).toBe(15);
      // TMR 5 kg × 90 % = 4.5 kg DM, plus silage 10 kg × 35 % = 3.5 kg DM.
      expect(d.supply.dm_kg).toBeCloseTo(8, 1);
      expect(d.cows).toHaveLength(1);
      expect(d.cows[0].cattle_id).toBe(cow);
      expect(d.cows[0].delta_pct.dm).not.toBeNull();
      expect(d.missing_cattle_ids).toEqual(['ghost-cow']);
    });

    it('400s with no cattleIds and no made-for cow; defaults to the made-for cow', async () => {
      const noRef = await post({
        name: nm('FitNoRef'),
        lines: [itemLine()],
      }).expect(201);
      created.push(noRef.body.data.id as string);
      await request(server())
        .get(api(`/feed/plans/${noRef.body.data.id}/fit`))
        .set(...auth(owner))
        .expect(400);

      const withRef = await post({
        name: nm('FitRef'),
        madeForCattleId: cow,
        lines: [itemLine()],
      }).expect(201);
      created.push(withRef.body.data.id as string);
      const fit = await request(server())
        .get(api(`/feed/plans/${withRef.body.data.id}/fit`))
        .set(...auth(owner))
        .expect(200);
      expect(fit.body.data.cows[0].cattle_id).toBe(cow);
    });
  });

  describe('soft delete', () => {
    it('archives, hides from the default list, blocks edits, still readable by id', async () => {
      const res = await post({ name: nm('Arch'), lines: [itemLine()] }).expect(
        201,
      );
      const id = res.body.data.id as string;
      await request(server())
        .delete(api(`/feed/plans/${id}`))
        .set(...auth(owner))
        .expect(200);

      const list = await request(server())
        .get(api(`/feed/plans?search=${encodeURIComponent(nm('Arch'))}`))
        .set(...auth(owner))
        .expect(200);
      expect(list.body.data).toHaveLength(0);
      const all = await request(server())
        .get(
          api(
            `/feed/plans?includeArchived=true&search=${encodeURIComponent(nm('Arch'))}`,
          ),
        )
        .set(...auth(owner))
        .expect(200);
      expect(all.body.data).toHaveLength(1);

      await request(server())
        .patch(api(`/feed/plans/${id}`))
        .set(...auth(owner))
        .send({ name: nm('Nope') })
        .expect(404);
      await request(server())
        .get(api(`/feed/plans/${id}`))
        .set(...auth(owner))
        .expect(200);
    });
  });

  describe('RBAC', () => {
    it('worker reads (incl. fit) but cannot create / update / delete', async () => {
      const id = created[0];
      await request(server())
        .get(api('/feed/plans'))
        .set(...auth(worker))
        .expect(200);
      await request(server())
        .get(api(`/feed/plans/${id}/fit?cattleIds=${cow}`))
        .set(...auth(worker))
        .expect(200);
      await post({ name: nm('W'), lines: [itemLine()] }, worker).expect(403);
      await request(server())
        .patch(api(`/feed/plans/${id}`))
        .set(...auth(worker))
        .send({ name: nm('W2') })
        .expect(403);
      await request(server())
        .delete(api(`/feed/plans/${id}`))
        .set(...auth(worker))
        .expect(403);
    });

    it('manager can create', async () => {
      const res = await post(
        { name: nm('Mgr'), lines: [itemLine()] },
        manager,
      ).expect(201);
      created.push(res.body.data.id as string);
    });

    it('400s a farmId in the body (no tenant override)', async () => {
      await post({
        name: nm('Farm'),
        lines: [itemLine()],
        farmId: 'x',
      }).expect(400);
    });
  });
});

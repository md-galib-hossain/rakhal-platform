import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-458 (MILESTONE 27) — supply vs requirement: per-cow `planned_supply` + `fit` on the Feeding
 * Grid (with a per-section summary), tunable tolerance bands, `/feed/plans/:id/fit` severity, the cow's
 * `program` endpoint, `today-requirement` and the DMI comparison resolving through plans.
 * (docs/EPIC_FEED_PROGRAMS.md §5, §6.)
 *
 * Requires the dev stack up + `pnpm seed`. Applied assignments and the farm's setting changes are
 * reverted in afterAll.
 */
describe('Feed program fit (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;

  let feedItemId: string;
  let itemName: string;
  let tmrId: string;
  let lotId: string;
  let planId: string;
  let itemLineId: string;
  let tmrLineId: string;
  let cowX: string;
  let cowY: string;
  let group: string;
  const stamp = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  type Fit = {
    severity: 'ok' | 'warn' | 'bad';
    estimated: boolean;
    dm: { delta_pct: number | null; severity: string };
    cp: { delta_pct: number | null; severity: string };
    me: { delta_pct: number | null; severity: string };
  };
  const grid = async () => {
    const r = await request(server())
      .get(api(`/feed/grid?date=${today}`))
      .set(...auth(owner))
      .expect(200);
    return r.body.data as {
      sections: Array<{
        plan_id: string;
        cattle_ids: string[];
        fit_summary: {
          ok: number;
          warn: number;
          bad: number;
          estimated: number;
        };
      }>;
      cows: Array<{
        cattle_id: string;
        program_section_id: string | null;
        planned_supply: {
          dm_kg: number;
          cp_kg: number;
          me_mj: number;
          complete: boolean;
        } | null;
        fit: Fit | null;
        requirement: { dm_kg: number } | null;
      }>;
    };
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');

    const mkCow = async (l: string) =>
      (
        await request(server())
          .post(api('/cattle'))
          .set(...auth(owner))
          .send({
            tagNumber: `E2E-PF-${l}-${stamp}`,
            gender: 'FEMALE',
            weightKg: 400,
          })
          .expect(201)
      ).body.data.id as string;
    [cowX, cowY] = await Promise.all([mkCow('X'), mkCow('Y')]);

    const ing = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E PF Ingredient ${stamp}`,
        pricePerKg: 8,
        dmPct: 35,
        cpPct: 8,
      })
      .expect(201);
    itemName = `E2E PF Silage ${stamp}`;
    feedItemId = (
      await request(server())
        .post(api('/inventory/feed-items'))
        .set(...auth(owner))
        .send({
          name: itemName,
          feedClass: 'FORAGE',
          ingredientId: ing.body.data.id,
          unitId: 'unit_kg',
          currentStock: 500,
          costPerUnit: 8,
          purchaseDate: new Date().toISOString(),
        })
        .expect(201)
    ).body.data.id as string;

    tmrId = (
      await prisma.feedConcentration.create({
        data: {
          farmId: owner.farmId,
          kind: 'FEED_MIXTURE',
          name: `E2E PF TMR ${stamp}`,
          createdBy: 'e2e-test-setup',
        },
      })
    ).id;
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
    lotId = (
      await prisma.feedStock.create({
        data: {
          farmId: owner.farmId,
          kind: 'FEED_MIXTURE',
          sourceConcentrationId: tmrId,
          sourceConcentrationVersion: 1,
          producedAt: new Date(),
          producedQtyKg: 100,
          currentStockKg: 100,
          producedCostTk: 800,
          createdBy: 'e2e-test-setup',
          nutritionProfileId: profile.id,
        },
      })
    ).id;

    const plan = await request(server())
      .post(api('/feed/plans'))
      .set(...auth(owner))
      .send({
        name: `E2E PF Plan ${stamp}`,
        lines: [
          { lineType: 'FEED_ITEM', feedItemId, kgPerDay: 10 },
          { lineType: 'PREPARED', concentrationId: tmrId, kgPerDay: 5 },
        ],
      })
      .expect(201);
    planId = plan.body.data.id as string;
    const lines = plan.body.data.lines as Array<{
      id: string;
      line_type: string;
    }>;
    itemLineId = lines.find((l) => l.line_type === 'FEED_ITEM')!.id;
    tmrLineId = lines.find((l) => l.line_type === 'PREPARED')!.id;

    group = (
      await request(server())
        .post(api('/animal-groups'))
        .set(...auth(owner))
        .send({ name: `E2E PF Group ${stamp}` })
        .expect(201)
    ).body.data.id as string;
    await request(server())
      .post(api(`/animal-groups/${group}/members`))
      .set(...auth(owner))
      .send({ cattleIds: [cowX, cowY] })
      .expect(201);
    await request(server())
      .post(api(`/feed/plans/${planId}/apply`))
      .set(...auth(owner))
      .send({ targetType: 'GROUP', animalGroupId: group })
      .expect(201);
  }, 60_000);

  afterAll(async () => {
    await request(server())
      .delete(api('/feed/requirement-settings'))
      .set(...auth(owner));
    await prisma.feedPlanAssignment.updateMany({
      where: { planId, removedAt: null },
      data: { removedAt: new Date(), removedBy: 'e2e-cleanup' },
    });
    await ctx.app.close();
  });

  it('grid: each cow on the program carries planned supply and a fit; the section carries a summary', async () => {
    const g = await grid();
    const x = g.cows.find((c) => c.cattle_id === cowX)!;
    expect(x.program_section_id).not.toBeNull();
    // silage 10 kg x 35 % + TMR 5 kg x 90 % = 3.5 + 4.5 = 8 kg DM.
    expect(x.planned_supply?.dm_kg).toBeCloseTo(8, 1);
    expect(x.planned_supply?.complete).toBe(true);
    expect(x.fit).not.toBeNull();
    expect(['ok', 'warn', 'bad']).toContain(x.fit!.severity);
    expect(typeof x.fit!.estimated).toBe('boolean');
    expect(x.fit!.dm.delta_pct).not.toBeNull();

    const sec = g.sections.find((s) => s.plan_id === planId)!;
    const { ok, warn, bad } = sec.fit_summary;
    expect(ok + warn + bad).toBe(2);
  });

  it('a cow with no program has no planned supply and no fit', async () => {
    const lone = (
      await request(server())
        .post(api('/cattle'))
        .set(...auth(owner))
        .send({
          tagNumber: `E2E-PF-L-${stamp}`,
          gender: 'FEMALE',
          weightKg: 400,
        })
        .expect(201)
    ).body.data.id as string;
    const c = (await grid()).cows.find((r) => r.cattle_id === lone)!;
    // (The shared demo farm may have a herd default, so only assert the pair is consistent.)
    expect(c.planned_supply === null).toBe(c.fit === null);
  });

  it('the tolerance bands are tunable per farm and change the verdict', async () => {
    const before = (await grid()).cows.find((c) => c.cattle_id === cowX)!;
    expect(before.fit!.dm.severity).not.toBe('ok'); // 8 kg vs ~10 kg need: about -20 %

    await request(server())
      .put(api('/feed/requirement-settings'))
      .set(...auth(owner))
      .send({ changes: { alertDryMatterBelowPct: 60 } })
      .expect(200);
    const after = (await grid()).cows.find((c) => c.cattle_id === cowX)!;
    expect(after.fit!.dm.severity).toBe('ok');
    expect(after.fit!.dm.delta_pct).toBe(before.fit!.dm.delta_pct); // same number, different band

    await request(server())
      .put(api('/feed/requirement-settings'))
      .set(...auth(owner))
      .send({ changes: { alertDryMatterBelowPct: 150 } })
      .expect(400); // out of the declared 0-100 bounds

    await request(server())
      .delete(api('/feed/requirement-settings'))
      .set(...auth(owner))
      .expect(200);
  });

  it('GET /feed/plans/:id/fit returns a fit per cow', async () => {
    const r = await request(server())
      .get(api(`/feed/plans/${planId}/fit?cattleIds=${cowX},${cowY}`))
      .set(...auth(owner))
      .expect(200);
    const cows = r.body.data.cows as Array<{ fit: Fit }>;
    expect(cows).toHaveLength(2);
    for (const c of cows) {
      expect(['ok', 'warn', 'bad']).toContain(c.fit.severity);
    }
  });

  it('GET /feed/plans/:id/fit returns the FULL nutrient table per cow; unmeasured is never a silent 0', async () => {
    const r = await request(server())
      .get(api(`/feed/plans/${planId}/fit?cattleIds=${cowX}`))
      .set(...auth(owner))
      .expect(200);
    const rows = r.body.data.cows[0].nutrients as Array<{
      key: string;
      supply: number | null;
      requirement: number | null;
      severity: string;
      measured: boolean;
    }>;
    expect(rows.map((n) => n.key)).toEqual([
      'dm',
      'cp',
      'me',
      'fat',
      'ndf',
      'adf',
      'tdn',
      'calcium',
      'phosphorus',
      'ca_p_ratio',
      'rdp_pct',
      'rup_pct',
      'starch',
    ]);
    for (const n of rows) {
      expect(['ok', 'warn', 'bad', 'unknown']).toContain(n.severity);
      // a nutrient a fed lot doesn't carry is flagged, and judged neither ok nor bad
      if (!n.measured) expect(n.severity).toBe('unknown');
    }
    // the dm/cp/me rows agree with the existing fit
    const fit = r.body.data.cows[0].fit as Fit;
    const worst = ['dm', 'cp', 'me']
      .map((k) => rows.find((n) => n.key === k)?.severity)
      .filter((s) => s !== 'unknown');
    if (worst.includes('bad')) expect(fit.severity).toBe('bad');
    // every line now names the raw lot profile it was judged on
    for (const l of r.body.data.lines as Array<{ nutrition: unknown }>) {
      expect(l).toHaveProperty('nutrition');
    }
  });

  it('POST /feed/plans/preview-fit: unsaved lines vs a saved animal or hand-entered figures, read-only', async () => {
    const plansBefore = await prisma.feedPlan.count({
      where: { farmId: owner.farmId },
    });
    const lines = [{ lineType: 'FEED_ITEM', feedItemId, kgPerDay: 4 }];

    // hand-entered animal: weight + milk, no cow needed
    const manual = await request(server())
      .post(api('/feed/plans/preview-fit'))
      .set(...auth(owner))
      .send({ lines, manual: { weightKg: 450, milkTargetL: 15 } })
      .expect(201);
    const m = manual.body.data;
    expect(m.requirement_full.dm_kg).toBeGreaterThan(0);
    expect(m.flags).toEqual([]); // every input is the farmer's own
    expect(m.nutrients).toHaveLength(13);
    expect(m.supply.as_fed_kg).toBe(4);
    expect(m.lines).toHaveLength(1);

    // a saved animal
    const cow = await request(server())
      .post(api('/feed/plans/preview-fit'))
      .set(...auth(owner))
      .send({ lines, cattleId: cowX })
      .expect(201);
    expect(cow.body.data.requirement_full.dm_kg).toBeGreaterThan(0);

    // an empty editor still shows the requirement
    const blank = await request(server())
      .post(api('/feed/plans/preview-fit'))
      .set(...auth(owner))
      .send({ lines: [], manual: { weightKg: 450, milkTargetL: 15 } })
      .expect(201);
    expect(blank.body.data.supply.as_fed_kg).toBe(0);
    expect(blank.body.data.requirement_full.dm_kg).toBeGreaterThan(0);

    // exactly one of cattleId / manual
    await request(server())
      .post(api('/feed/plans/preview-fit'))
      .set(...auth(owner))
      .send({ lines })
      .expect(400);
    await request(server())
      .post(api('/feed/plans/preview-fit'))
      .set(...auth(owner))
      .send({
        lines,
        cattleId: cowX,
        manual: { weightKg: 450, milkTargetL: 15 },
      })
      .expect(400);

    // read-only: nothing was created
    expect(
      await prisma.feedPlan.count({ where: { farmId: owner.farmId } }),
    ).toBe(plansBefore);
  });

  it('GET /feed/cattle/:id/program: the plan, how it reaches her, resolved lines', async () => {
    const r = await request(server())
      .get(api(`/feed/cattle/${cowX}/program`))
      .set(...auth(owner))
      .expect(200);
    const p = r.body.data.program;
    expect(p).toMatchObject({
      plan_id: planId,
      via: 'GROUP',
      group_id: group,
      conflict: false,
    });
    expect(p.lines).toHaveLength(2);
    const tmr = p.lines.find(
      (l: { line_id: string }) => l.line_id === tmrLineId,
    );
    expect(tmr.source).toEqual({
      source_type: 'FEED_STOCK',
      feed_item_id: null,
      feed_stock_id: lotId,
    });
    await request(server())
      .get(api(`/feed/cattle/${cowX}/program`))
      .set(...auth(worker))
      .expect(200);
    await request(server())
      .get(api('/feed/cattle/no-such-cow/program'))
      .set(...auth(owner))
      .expect(404);
  });

  it('today-requirement resolves through plans: lines x resolved heads', async () => {
    const r = await request(server())
      .get(api('/feed/today-requirement'))
      .set(...auth(owner))
      .expect(200);
    expect(r.body.data.has_active_ration).toBe(true);
    const row = (
      r.body.data.by_ration as Array<{
        plan_id: string;
        headcount: number;
        total_kg: number;
      }>
    ).find((x) => x.plan_id === planId)!;
    expect(row.headcount).toBe(2);
    expect(row.total_kg).toBe(30); // (10 + 5) kg x 2 cows
    const silage = (
      r.body.data.by_ingredient as Array<{ name: string; total_kg: number }>
    ).find((i) => i.name === itemName)!;
    expect(silage.total_kg).toBeGreaterThanOrEqual(20);
  });

  it('DMI comparison reports the program and counts the grid feeding', async () => {
    await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date: today,
        entries: [
          {
            cattleId: cowX,
            lines: [
              {
                planLineId: itemLineId,
                sourceType: 'FEED_ITEM',
                feedItemId,
                offeredKg: 10,
              },
              {
                planLineId: tmrLineId,
                sourceType: 'FEED_STOCK',
                feedStockId: lotId,
                offeredKg: 5,
              },
            ],
          },
        ],
      })
      .expect(201);
    const r = await request(server())
      .get(api(`/feed/cattle/${cowX}/dmi?date=${today}`))
      .set(...auth(owner))
      .expect(200);
    expect(r.body.data.match_level).toBe('GROUP');
    expect(r.body.data.program).toMatchObject({
      plan_id: planId,
      via: 'GROUP',
    });
    expect(r.body.data.actual_dmi_kg).toBeCloseTo(8, 1);
  });
});

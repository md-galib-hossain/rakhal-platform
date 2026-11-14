import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-457 (MILESTONE 27) — Feeding Grid × programs: additive `sections[]` + per-cow program /
 * requirement fields, multi-line confirm with plan snapshots, proportional refusal split, stock moving
 * exactly once per source, moving sections on an individual apply, falling back on remove, and the
 * RD-109 draft-save race. (docs/EPIC_FEED_PROGRAMS.md §6, §10.)
 *
 * Requires the dev stack up + `pnpm seed`. Everything applied here is ended again in afterAll.
 */
describe('Feeding Grid programs (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;

  let feedItemId: string;
  let tmrId: string;
  let lotId: string;
  let planId: string;
  let itemLineId: string;
  let tmrLineId: string;
  let cowX: string;
  let cowY: string;
  let group: string;
  const stamp = Date.now();
  const DAY = '2026-04-15';

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const grid = async (date = DAY) => {
    const r = await request(server())
      .get(api(`/feed/grid?date=${date}`))
      .set(...auth(owner))
      .expect(200);
    return r.body.data as {
      sections: Array<{
        id: string;
        plan_id: string;
        via: string;
        cattle_ids: string[];
        lines: Array<{
          line_id: string;
          line_type: string;
          prefill_kg: number;
          kg_per_day: number;
          stock_ok: boolean;
          source: {
            source_type: string;
            feed_item_id: string | null;
            feed_stock_id: string | null;
          } | null;
        }>;
      }>;
      cows: Array<{
        cattle_id: string;
        program_section_id: string | null;
        program_conflict: boolean;
        planned_kg_by_line: Record<string, number>;
        requirement: { dm_kg: number; flags: string[] } | null;
        drafts: Array<{
          plan_line_id: string | null;
          offered_kg: number;
          refusal_kg: number | null;
        }>;
        confirmed_offered_kg: number | null;
      }>;
    };
  };

  const itemStock = async () =>
    (
      await request(server())
        .get(api(`/inventory/feed-items/${feedItemId}`))
        .set(...auth(owner))
        .expect(200)
    ).body.data.currentStock as number;
  const lotStock = async () =>
    (await prisma.feedStock.findUniqueOrThrow({ where: { id: lotId } }))
      .currentStockKg;

  const apply = (body: Record<string, unknown>) =>
    request(server())
      .post(api(`/feed/plans/${planId}/apply`))
      .set(...auth(owner))
      .send(body);

  const singleLine = (
    cattleId: string,
    planLineId: string | null,
    kg: number,
  ) => ({
    cattleId,
    lines: [
      {
        ...(planLineId ? { planLineId } : {}),
        sourceType: 'FEED_ITEM',
        feedItemId,
        offeredKg: kg,
      },
    ],
  });

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
            tagNumber: `E2E-GP-${l}-${stamp}`,
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
        name: `E2E GP Ingredient ${stamp}`,
        pricePerKg: 8,
        dmPct: 35,
        cpPct: 8,
      })
      .expect(201);
    feedItemId = (
      await request(server())
        .post(api('/inventory/feed-items'))
        .set(...auth(owner))
        .send({
          name: `E2E GP Silage ${stamp}`,
          feedClass: 'FORAGE',
          ingredientId: ing.body.data.id,
          unitId: 'unit_kg',
          currentStock: 500,
          costPerUnit: 8,
          purchaseDate: new Date().toISOString(),
        })
        .expect(201)
    ).body.data.id as string;

    const recipe = await prisma.feedConcentration.create({
      data: {
        farmId: owner.farmId,
        kind: 'FEED_MIXTURE',
        name: `E2E GP TMR ${stamp}`,
        createdBy: 'e2e-test-setup',
      },
    });
    tmrId = recipe.id;
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
        name: `E2E GP Plan ${stamp}`,
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
        .send({ name: `E2E GP Group ${stamp}` })
        .expect(201)
    ).body.data.id as string;
    await request(server())
      .post(api(`/animal-groups/${group}/members`))
      .set(...auth(owner))
      .send({ cattleIds: [cowX, cowY] })
      .expect(201);
  }, 60_000);

  afterAll(async () => {
    await prisma.feedPlanAssignment.updateMany({
      where: { planId, removedAt: null },
      data: { removedAt: new Date(), removedBy: 'e2e-cleanup' },
    });
    await ctx.app.close();
  });

  it('a plan does nothing until applied: no section for it on the grid', async () => {
    const g = await grid();
    expect(g.sections.find((s) => s.plan_id === planId)).toBeUndefined();
  });

  it('applied to a group: one section with the plan lines, resolved sources, densities and pre-fill; cows carry planned kg + requirement', async () => {
    await apply({ targetType: 'GROUP', animalGroupId: group }).expect(201);
    const g = await grid();
    const sec = g.sections.find((s) => s.plan_id === planId)!;
    expect(sec.via).toBe('GROUP');
    expect(sec.cattle_ids.sort()).toEqual([cowX, cowY].sort());
    expect(sec.lines).toHaveLength(2);

    const item = sec.lines.find((l) => l.line_id === itemLineId)!;
    expect(item.source).toEqual({
      source_type: 'FEED_ITEM',
      feed_item_id: feedItemId,
      feed_stock_id: null,
    });
    const tmr = sec.lines.find((l) => l.line_id === tmrLineId)!;
    expect(tmr.source).toEqual({
      source_type: 'FEED_STOCK',
      feed_item_id: null,
      feed_stock_id: lotId,
    });
    expect(tmr.stock_ok).toBe(true);
    for (const l of sec.lines) {
      expect(l.prefill_kg).toBeGreaterThan(0);
      expect(l.prefill_kg).toBeLessThanOrEqual(l.kg_per_day);
    }

    const x = g.cows.find((c) => c.cattle_id === cowX)!;
    expect(x.program_section_id).toBe(sec.id);
    expect(x.program_conflict).toBe(false);
    expect(x.planned_kg_by_line[itemLineId]).toBe(item.prefill_kg);
    expect(x.requirement?.dm_kg).toBeGreaterThan(0);
    expect(Array.isArray(x.requirement?.flags)).toBe(true);
  });

  it('multi-line confirm: stock moves once per source, plan snapshots are written, refusal splits proportionally', async () => {
    const itemBefore = await itemStock();
    const lotBefore = await lotStock();
    // plannedKg is what the grid pre-fills: the plan line's whole daily kg.
    const sec = (await grid()).sections.find((x) => x.plan_id === planId)!;
    const prefill = (id: string) =>
      sec.lines.find((l) => l.line_id === id)!.prefill_kg;

    const res = await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date: DAY,
        entries: [
          {
            cattleId: cowX,
            refusalKg: 3, // cow total: 2 kg on the 10 kg line, 1 kg on the 5 kg line
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
          {
            cattleId: cowY,
            lines: [
              {
                planLineId: itemLineId,
                sourceType: 'FEED_ITEM',
                feedItemId,
                offeredKg: 10,
                refusalKg: 0.5,
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

    // Once per source across both cows: 2 x 10 kg silage, 2 x 5 kg TMR.
    expect(await itemStock()).toBe(itemBefore - 20);
    expect(await lotStock()).toBe(lotBefore - 10);

    const items = await prisma.feedDistributionCattleItem.findMany({
      where: { distributionId: res.body.data.id as string },
    });
    expect(items).toHaveLength(4);
    for (const i of items) {
      expect(i.feedPlanId).toBe(planId);
      expect(i.feedPlanLineId).toBe(i.feedItemId ? itemLineId : tmrLineId);
      expect(i.plannedKg).toBe(prefill(i.feedItemId ? itemLineId : tmrLineId));
    }
    const x = items.filter((i) => i.cattleId === cowX);
    expect(x.find((i) => i.feedItemId)!.refusalKg).toBe(2);
    expect(x.find((i) => i.feedStockId)!.refusalKg).toBe(1);
    const y = items.filter((i) => i.cattleId === cowY);
    expect(y.find((i) => i.feedItemId)!.refusalKg).toBe(0.5); // explicit per-line value wins
    expect(y.find((i) => i.feedStockId)!.refusalKg).toBe(0);

    // One aggregate distribution line per distinct source.
    const dist = await prisma.feedDistribution.findUniqueOrThrow({
      where: { id: res.body.data.id as string },
      include: { items: true },
    });
    expect(dist.items).toHaveLength(2);
  });

  it('an extra (off-plan) line and a stale plan line id carry no snapshot and do not block the confirm', async () => {
    const res = await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date: '2026-04-16',
        entries: [
          singleLine(cowX, null, 2),
          singleLine(cowY, 'plan-line-that-was-edited-away', 3),
        ],
      })
      .expect(201);
    const items = await prisma.feedDistributionCattleItem.findMany({
      where: { distributionId: res.body.data.id as string },
    });
    expect(items).toHaveLength(2);
    for (const i of items) {
      expect(i.feedPlanId).toBeNull();
      expect(i.feedPlanLineId).toBeNull();
      expect(i.plannedKg).toBeNull();
    }
  });

  it('the old single-source entry shape still works', async () => {
    await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date: '2026-04-17',
        entries: [
          {
            cattleId: cowX,
            offeredKg: 4,
            sourceType: 'FEED_ITEM',
            feedItemId,
          },
        ],
      })
      .expect(201);
  });

  it('drafts carry their plan line + refusal; the same source twice for one cow is a 400', async () => {
    await request(server())
      .post(api('/feed/grid/draft'))
      .set(...auth(owner))
      .send({
        date: '2026-04-18',
        entries: [
          {
            cattleId: cowX,
            lines: [
              {
                planLineId: itemLineId,
                sourceType: 'FEED_ITEM',
                feedItemId,
                offeredKg: 9,
                refusalKg: 1,
              },
              {
                planLineId: tmrLineId,
                sourceType: 'FEED_STOCK',
                feedStockId: lotId,
                offeredKg: 4,
              },
            ],
          },
        ],
      })
      .expect(201);
    const x = (await grid('2026-04-18')).cows.find(
      (c) => c.cattle_id === cowX,
    )!;
    expect(x.drafts).toHaveLength(2);
    expect(x.drafts.find((d) => d.plan_line_id === itemLineId)).toMatchObject({
      offered_kg: 9,
      refusal_kg: 1,
    });

    await request(server())
      .post(api('/feed/grid/draft'))
      .set(...auth(owner))
      .send({
        date: '2026-04-18',
        entries: [
          {
            cattleId: cowY,
            lines: [
              { sourceType: 'FEED_ITEM', feedItemId, offeredKg: 1 },
              { sourceType: 'FEED_ITEM', feedItemId, offeredKg: 2 },
            ],
          },
        ],
      })
      .expect(400);
  });

  it('RD-109: two concurrent saves of the same cow/date/source never 500', async () => {
    const body = {
      date: '2026-04-19',
      sourceType: 'FEED_ITEM',
      feedItemId,
      entries: [{ cattleId: cowY, offeredKg: 6 }],
    };
    const [a, b] = await Promise.all([
      request(server())
        .post(api('/feed/grid/draft'))
        .set(...auth(owner))
        .send(body),
      request(server())
        .post(api('/feed/grid/draft'))
        .set(...auth(owner))
        .send(body),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(
      await prisma.feedFeedingDraft.count({
        where: {
          cattleId: cowY,
          feedItemId,
          logDate: new Date('2026-04-19T00:00:00Z'),
        },
      }),
    ).toBe(1);
  });

  it('an individual program moves the cow to its own section; removing it falls back to the group', async () => {
    const own = await request(server())
      .post(api('/feed/plans'))
      .set(...auth(owner))
      .send({
        name: `E2E GP Own ${stamp}`,
        lines: [{ lineType: 'FEED_ITEM', feedItemId, kgPerDay: 7 }],
      })
      .expect(201);
    const ownId = own.body.data.id as string;
    const applied = await request(server())
      .post(api(`/feed/plans/${ownId}/apply`))
      .set(...auth(owner))
      .send({ targetType: 'INDIVIDUAL', cattleIds: [cowX] })
      .expect(201);

    const g = await grid();
    const x = g.cows.find((c) => c.cattle_id === cowX)!;
    const y = g.cows.find((c) => c.cattle_id === cowY)!;
    const xSection = g.sections.find((s) => s.id === x.program_section_id)!;
    expect(xSection.plan_id).toBe(ownId);
    expect(xSection.via).toBe('INDIVIDUAL');
    expect(y.program_section_id).not.toBe(x.program_section_id);

    const assignmentId = applied.body.data.assignments[0].id as string;
    await request(server())
      .post(api(`/feed/plan-assignments/${assignmentId}/remove`))
      .set(...auth(owner))
      .expect(201);
    const back = (await grid()).cows.find((c) => c.cattle_id === cowX)!;
    expect(back.program_section_id).toBe(y.program_section_id);

    await request(server())
      .delete(api(`/feed/plans/${ownId}`))
      .set(...auth(owner))
      .expect(200);
  });

  it('void: a voided row is no longer confirmed today (453 regression through the new sections)', async () => {
    const before = (await grid()).cows.find((c) => c.cattle_id === cowY)!;
    expect(before.confirmed_offered_kg).toBe(15);
    const item = await prisma.feedDistributionCattleItem.findFirstOrThrow({
      where: { cattleId: cowY, feedPlanLineId: itemLineId, voidedAt: null },
    });
    await request(server())
      .post(
        api(
          `/feed/grid/distributions/${item.distributionId}/cattle/${item.id}/void`,
        ),
      )
      .set(...auth(owner))
      .send({ reason: 'e2e' })
      .expect(201);
    expect(
      (await grid()).cows.find((c) => c.cattle_id === cowY)!
        .confirmed_offered_kg,
    ).toBe(5);
  });

  it('RBAC: a worker sees the sections but cannot apply', async () => {
    const r = await request(server())
      .get(api(`/feed/grid?date=${DAY}`))
      .set(...auth(worker))
      .expect(200);
    expect(r.body.data.sections.length).toBeGreaterThan(0);
    await request(server())
      .post(api(`/feed/plans/${planId}/apply`))
      .set(...auth(worker))
      .send({ targetType: 'HERD' })
      .expect(403);
  });
});

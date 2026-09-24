import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-456 (MILESTONE 27) — Apply / Remove a feed plan: one active assignment per target, apply
 * replaces atomically, precedence individual → group → herd, group-overlap guard (409 with the
 * conflicting cows), archive refused while applied, RBAC, and the `resolved-ration` shim.
 *
 * Requires the dev stack up + `pnpm seed`. Every applied assignment is removed again at the end (the
 * HERD default in particular would otherwise leak into other suites on the shared demo farm).
 */
describe('Feed plan assignments (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;

  let tmrId: string;
  let feedItemId: string;
  let planTmr: string; // TMR_SHORTCUT: 1 PREPARED line (shim-visible)
  let planMix: string; // 2 lines (item + tmr)
  let cowA: string;
  let cowB: string;
  let cowC: string;
  let cowD: string;
  let g1: string;
  let g2: string;
  let originalHerd: {
    planId: string;
    appliedBy: string;
    appliedAt: Date;
  } | null = null;
  const stamp = Date.now();

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const apply = (
    planId: string,
    body: Record<string, unknown>,
    u: AuthedUser = owner,
  ) =>
    request(server())
      .post(api(`/feed/plans/${planId}/apply`))
      .set(...auth(u))
      .send(body);

  const resolved = async (cattleId: string) => {
    const r = await request(server())
      .get(api(`/feed/cattle/${cattleId}/resolved-ration`))
      .set(...auth(owner))
      .expect(200);
    return r.body.data as {
      match_level: string | null;
      concentration: { id: string } | null;
    };
  };

  const activeFor = async (cattleId: string) => {
    const r = await request(server())
      .get(api(`/feed/plan-assignments?cattleId=${cattleId}&status=ACTIVE`))
      .set(...auth(owner))
      .expect(200);
    return r.body.data as Array<{ id: string; plan_id: string }>;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    // Applying HERD replaces the farm's herd default — remember it so afterAll can put it back.
    originalHerd = await prisma.feedPlanAssignment.findFirst({
      where: { farmId: owner.farmId, targetType: 'HERD', removedAt: null },
      select: { planId: true, appliedBy: true, appliedAt: true },
    });
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');

    const mkCow = async (l: string) =>
      (
        await request(server())
          .post(api('/cattle'))
          .set(...auth(owner))
          .send({
            tagNumber: `E2E-PA-${l}-${stamp}`,
            gender: 'FEMALE',
            weightKg: 400,
          })
          .expect(201)
      ).body.data.id as string;
    [cowA, cowB, cowC, cowD] = await Promise.all(
      ['A', 'B', 'C', 'D'].map(mkCow),
    );

    const ing = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E PA Ingredient ${stamp}`,
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
          name: `E2E PA Silage ${stamp}`,
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
          name: `E2E PA TMR ${stamp}`,
          createdBy: 'e2e-test-setup',
        },
      })
    ).id;

    const mkPlan = async (
      name: string,
      lines: Array<Record<string, unknown>>,
      kind?: string,
    ) =>
      (
        await request(server())
          .post(api('/feed/plans'))
          .set(...auth(owner))
          .send({ name: `${name} ${stamp}`, kind, lines })
          .expect(201)
      ).body.data.id as string;
    const tmrLine = (kg: number) => ({
      lineType: 'PREPARED',
      concentrationId: tmrId,
      kgPerDay: kg,
    });
    planTmr = await mkPlan('E2E PA TMR plan', [tmrLine(20)], 'TMR_SHORTCUT');
    planMix = await mkPlan('E2E PA Mix plan', [
      { lineType: 'FEED_ITEM', feedItemId, kgPerDay: 10 },
      tmrLine(5),
    ]);

    const mkGroup = async (l: string, members: string[]) => {
      const g = await request(server())
        .post(api('/animal-groups'))
        .set(...auth(owner))
        .send({ name: `E2E PA ${l} ${stamp}` })
        .expect(201);
      await request(server())
        .post(api(`/animal-groups/${g.body.data.id}/members`))
        .set(...auth(owner))
        .send({ cattleIds: members })
        .expect(201);
      return g.body.data.id as string;
    };
    g1 = await mkGroup('G1', [cowB, cowC]);
    g2 = await mkGroup('G2', [cowC, cowD]);
  }, 60_000);

  afterAll(async () => {
    // End anything this suite left applied (HERD in particular).
    await prisma.feedPlanAssignment.updateMany({
      where: { planId: { in: [planTmr, planMix] }, removedAt: null },
      data: { removedAt: new Date(), removedBy: 'e2e-cleanup' },
    });
    const herdNow = await prisma.feedPlanAssignment.findFirst({
      where: { farmId: owner.farmId, targetType: 'HERD', removedAt: null },
    });
    if (originalHerd && !herdNow) {
      await prisma.feedPlanAssignment.create({
        data: { farmId: owner.farmId, targetType: 'HERD', ...originalHerd },
      });
    }
    await ctx.app.close();
  });

  it('applies to several cows; the shim resolves the TMR; the plan reports where it is applied', async () => {
    const res = await apply(planTmr, {
      targetType: 'INDIVIDUAL',
      cattleIds: [cowA, cowB],
    }).expect(201);
    expect(res.body.data.assignments).toHaveLength(2);
    expect(res.body.data.replaced).toHaveLength(0);

    const r = await resolved(cowA);
    expect(r.match_level).toBe('INDIVIDUAL');

    const plan = await request(server())
      .get(api(`/feed/plans/${planTmr}`))
      .set(...auth(owner))
      .expect(200);
    expect(plan.body.data.applied_to.cattle_ids.sort()).toEqual(
      [cowA, cowB].sort(),
    );
  });

  it('apply REPLACES the target’s active program and keeps the ended row', async () => {
    const res = await apply(planMix, {
      targetType: 'INDIVIDUAL',
      cattleIds: [cowA],
    }).expect(201);
    expect(res.body.data.replaced).toHaveLength(1);
    expect(res.body.data.replaced[0].plan_id).toBe(planTmr);

    const active = await activeFor(cowA);
    expect(active).toHaveLength(1);
    expect(active[0].plan_id).toBe(planMix);

    const all = await request(server())
      .get(api(`/feed/plan-assignments?cattleId=${cowA}`))
      .set(...auth(owner))
      .expect(200);
    expect(all.body.data).toHaveLength(2);
    const ended = await request(server())
      .get(api(`/feed/plan-assignments?cattleId=${cowA}&status=ENDED`))
      .set(...auth(owner))
      .expect(200);
    expect(ended.body.data).toHaveLength(1);

    // A multi-line plan is not "a TMR ration": the shim reports none (its fit is on /fit).
    expect((await resolved(cowA)).match_level).toBeNull();
  });

  it('precedence: individual beats group; group beats nothing; removing the individual falls back', async () => {
    await apply(planTmr, { targetType: 'GROUP', animalGroupId: g1 }).expect(
      201,
    );
    // B has her own individual program (planTmr via the first test), C only the group's.
    expect((await resolved(cowB)).match_level).toBe('INDIVIDUAL');
    expect((await resolved(cowC)).match_level).toBe('GROUP');

    const bAssignment = (await activeFor(cowB)).find(
      (a) => a.plan_id === planTmr,
    )!;
    await request(server())
      .post(api(`/feed/plan-assignments/${bAssignment.id}/remove`))
      .set(...auth(owner))
      .expect(201);
    expect((await resolved(cowB)).match_level).toBe('GROUP');

    // Removing twice is refused.
    await request(server())
      .post(api(`/feed/plan-assignments/${bAssignment.id}/remove`))
      .set(...auth(owner))
      .expect(409);
  });

  it('overlap guard: applying to a group whose member is on another group’s program is 409 with the cows', async () => {
    // C is in G1 (has planTmr) and G2 → applying to G2 must be refused and name C.
    const res = await apply(planMix, {
      targetType: 'GROUP',
      animalGroupId: g2,
    }).expect(409);
    expect(res.body.details.conflicting_cattle).toEqual([
      expect.objectContaining({ cattle_id: cowC, group_id: g1 }),
    ]);

    // Once C has her own individual program the individual one wins, so the overlap no longer bites.
    await apply(planMix, {
      targetType: 'INDIVIDUAL',
      cattleIds: [cowC],
    }).expect(201);
    await apply(planMix, { targetType: 'GROUP', animalGroupId: g2 }).expect(
      201,
    );
  });

  it('an individual apply reports the cows leaving a group program', async () => {
    const res = await apply(planTmr, {
      targetType: 'INDIVIDUAL',
      cattleIds: [cowD],
    }).expect(201);
    // D was on G2's program (planMix) → the confirm text needs to say she leaves it.
    expect(res.body.data.leaves_group_program).toEqual([
      expect.objectContaining({ cattle_id: cowD, plan_id: planMix }),
    ]);
  });

  it('herd default applies to a cow with nothing else, and is removable', async () => {
    // Use a fresh cow with no individual/group program.
    const lone = (
      await request(server())
        .post(api('/cattle'))
        .set(...auth(owner))
        .send({
          tagNumber: `E2E-PA-L-${stamp}`,
          gender: 'FEMALE',
          weightKg: 400,
        })
        .expect(201)
    ).body.data.id as string;
    // (No baseline assertion: the shared demo farm may already have a herd default.)
    const res = await apply(planTmr, { targetType: 'HERD' }).expect(201);
    expect((await resolved(lone)).match_level).toBe('HERD');
    const herdAssignment = res.body.data.assignments[0].id as string;
    await request(server())
      .post(api(`/feed/plan-assignments/${herdAssignment}/remove`))
      .set(...auth(owner))
      .expect(201);
    expect((await resolved(lone)).match_level).toBeNull();
  });

  describe('archive guard', () => {
    it('409s while applied; "remove from all & delete" ends them and archives', async () => {
      await request(server())
        .delete(api(`/feed/plans/${planTmr}`))
        .set(...auth(owner))
        .expect(409);
      const res = await request(server())
        .delete(api(`/feed/plans/${planTmr}?removeAssignments=true`))
        .set(...auth(owner))
        .expect(200);
      expect(res.body.data.removed_assignments).toBeGreaterThan(0);
      expect(await activeFor(cowA)).toHaveLength(1); // cowA still on planMix
      expect((await activeFor(cowD)).every((a) => a.plan_id !== planTmr)).toBe(
        true,
      );
    });

    it('an archived plan cannot be applied', async () => {
      await apply(planTmr, { targetType: 'HERD' }).expect(404);
    });
  });

  describe('validation + RBAC', () => {
    it('validates the target shape', async () => {
      await apply(planMix, { targetType: 'INDIVIDUAL' }).expect(400);
      await apply(planMix, { targetType: 'GROUP' }).expect(400);
      await apply(planMix, {
        targetType: 'INDIVIDUAL',
        cattleIds: ['no-such-cow'],
      }).expect(404);
      await apply(planMix, {
        targetType: 'GROUP',
        animalGroupId: 'no-such-group',
      }).expect(404);
      await apply('no-such-plan', { targetType: 'HERD' }).expect(404);
      await apply(planMix, { targetType: 'HERD', farmId: 'x' }).expect(400);
    });

    it('worker can list but not apply or remove', async () => {
      await request(server())
        .get(api('/feed/plan-assignments'))
        .set(...auth(worker))
        .expect(200);
      await apply(planMix, { targetType: 'HERD' }, worker).expect(403);
      const anyActive = (await activeFor(cowA))[0];
      await request(server())
        .post(api(`/feed/plan-assignments/${anyActive.id}/remove`))
        .set(...auth(worker))
        .expect(403);
    });
  });
});

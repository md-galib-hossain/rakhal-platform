import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Feed Formulator — cow-driven requirements, Phase 2 of the epic in
 * `C:\Users\mdgal\.claude\plans\composed-pondering-teapot.md` (2026-07-17, no ticket #).
 * `GET /feed/requirements` now accepts `cattleId` (auto-derives weight/BCS/gestation/milk yield from
 * real records, falling back to manual fields when incomplete) or `feedGroupId` (averages across
 * members, returns both `per_cow` and `group_total`). Also proves the domain's new late-gestation
 * and BCS-deviation formula terms actually move the output through this data-wiring path, not just
 * in the pure unit spec.
 *
 * Creates its own isolated `Cattle`/`ReproductionProfile`/`Pregnancy`/`MilkLogEntry`/`FeedGroup` rows
 * via Prisma (unique tag numbers) rather than mutating shared seeded cattle — e2e suites run in
 * parallel Jest workers against one shared dev DB (lesson learned from the Phase 1 nutrient-override
 * spec's flake).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — cow-driven requirements (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;

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
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createCow(overrides: {
    lastWeightKg?: number;
    lastBcs?: number;
  }) {
    return prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-REQ-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
        lastWeightKg: overrides.lastWeightKg,
        lastBcs: overrides.lastBcs,
      },
    });
  }

  it('returns 404 for a cattleId outside the farm', async () => {
    await request(server())
      .get(api('/feed/requirements'))
      .set(...auth(owner))
      .query({ cattleId: 'nonexistent-id' })
      .expect(404);
  });

  it('auto-derives weight from Cattle.lastWeightKg, falls back to manual milk target', async () => {
    const cow = await createCow({ lastWeightKg: 450 });
    const res = await request(server())
      .get(api('/feed/requirements'))
      .set(...auth(owner))
      .query({ cattleId: cow.id, milkTargetL: 20 })
      .expect(200);

    expect(res.body.data.inputs.weight_kg).toBe(450);
    expect(res.body.data.inputs.milk_target_l).toBe(20);
    expect(res.body.data.data_source.weight).toBe('cattle_record');
    expect(res.body.data.data_source.milk_yield).toBe('manual');
    // v2 (RAKHAL-258) NRC-2001 FCM/DIM formula, no dim supplied → mid-lactation curve default.
    expect(res.body.data.requirements.dm_kg).toBeCloseTo(16.36, 1);
  });

  it('400s when neither the cattle record nor a manual weight is available', async () => {
    const cow = await createCow({});
    await request(server())
      .get(api('/feed/requirements'))
      .set(...auth(owner))
      .query({ cattleId: cow.id })
      .expect(400);
  });

  it('pulls a 7-day average milk yield from real MilkLogEntry rows', async () => {
    const cow = await createCow({ lastWeightKg: 500 });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // 3 days of 15L morning sessions inside the 7-day window → avg = (15*3)/7 ≈ 6.4
    for (let i = 1; i <= 3; i++) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - i);
      await prisma.milkLogEntry.create({
        data: {
          farmId: owner.farmId,
          cattleId: cow.id,
          logDate: day,
          session: 'MORNING',
          yieldL: 15,
          submitted: true,
          // RD-077: `disposition` became required on MilkLogEntry; these fixtures predate it.
          disposition: 'SALEABLE',
          createdBy: ownerUserId,
        },
      });
    }

    const res = await request(server())
      .get(api('/feed/requirements'))
      .set(...auth(owner))
      .query({ cattleId: cow.id })
      .expect(200);

    expect(res.body.data.data_source.milk_yield).toBe('milk_log_7d_avg');
    expect(res.body.data.inputs.milk_target_l).toBeCloseTo(6.4, 1);
  });

  it('late-gestation and BCS terms move the output for a real cow', async () => {
    const baseline = await createCow({ lastWeightKg: 450, lastBcs: 3.0 });
    const baselineRes = await request(server())
      .get(api('/feed/requirements'))
      .set(...auth(owner))
      .query({ cattleId: baseline.id })
      .expect(200);

    const thinCow = await createCow({ lastWeightKg: 450, lastBcs: 2.0 });
    const thinRes = await request(server())
      .get(api('/feed/requirements'))
      .set(...auth(owner))
      .query({ cattleId: thinCow.id })
      .expect(200);
    expect(thinRes.body.data.requirements.me_mj).toBeGreaterThan(
      baselineRes.body.data.requirements.me_mj,
    );

    const lateGestationCow = await createCow({ lastWeightKg: 450 });
    const conceptionDate = new Date();
    conceptionDate.setUTCDate(conceptionDate.getUTCDate() - 250); // day 250 of gestation
    const profile = await prisma.reproductionProfile.create({
      data: { cattleId: lateGestationCow.id, reproductiveStatus: 'PREGNANT' },
    });
    const pregnancy = await prisma.pregnancy.create({
      data: {
        cattleId: lateGestationCow.id,
        conceptionDate,
        status: 'ACTIVE',
      },
    });
    await prisma.reproductionProfile.update({
      where: { id: profile.id },
      data: { currentPregnancyId: pregnancy.id },
    });

    const gestationRes = await request(server())
      .get(api('/feed/requirements'))
      .set(...auth(owner))
      .query({ cattleId: lateGestationCow.id })
      .expect(200);
    expect(gestationRes.body.data.inputs.gestation_days).toBeGreaterThanOrEqual(
      249,
    );
    expect(gestationRes.body.data.requirements.me_mj).toBeGreaterThan(
      baselineRes.body.data.requirements.me_mj,
    );
  });

  it('a feed group averages members and returns both per_cow and group_total', async () => {
    const a = await createCow({ lastWeightKg: 400 });
    const b = await createCow({ lastWeightKg: 500 });
    const group = await prisma.feedGroup.create({
      data: {
        farmId: owner.farmId,
        name: `E2E Requirements Group ${Date.now()}`,
      },
    });
    await prisma.cattle.updateMany({
      where: { id: { in: [a.id, b.id] } },
      data: { feedGroupId: group.id },
    });

    const res = await request(server())
      .get(api('/feed/requirements'))
      .set(...auth(owner))
      .query({ feedGroupId: group.id })
      .expect(200);

    expect(res.body.data.inputs.headcount).toBe(2);
    expect(res.body.data.inputs.weight_kg).toBe(450); // avg(400, 500)
    expect(res.body.data.group_total.dm_kg).toBeCloseTo(
      res.body.data.per_cow.dm_kg * 2,
      2,
    );
  });

  it('400s for an empty feed group', async () => {
    const group = await prisma.feedGroup.create({
      data: {
        farmId: owner.farmId,
        name: `E2E Empty Group ${Date.now()}`,
      },
    });
    await request(server())
      .get(api('/feed/requirements'))
      .set(...auth(owner))
      .query({ feedGroupId: group.id })
      .expect(400);
  });
});

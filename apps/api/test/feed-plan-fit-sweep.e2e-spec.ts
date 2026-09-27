import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  FeedPlanFitSweepService,
  OFF_TARGET_TASK_EVENT,
} from '../src/modules/feed/application/services/feed-plan-fit-sweep.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-459b (MILESTONE 27) — the daily plan-fit sweep: it stores one `FeedPlanFitDay` per (plan, cow, day)
 * (refreshed on a re-run) and raises ONE Task Hub task per plan per day when a cow was measured off target on
 * three consecutive days. An estimated day never counts. (docs/EPIC_FEED_PROGRAMS.md §9.)
 *
 * Requires the dev stack up + `pnpm seed`. The cow, plan assignment, fit rows and tasks are removed in afterAll.
 */
describe('Feed plan fit sweep (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let sweep: FeedPlanFitSweepService;
  let owner: AuthedUser;
  let cattleId: string;
  let planId: string;
  const stamp = Date.now();
  const DAY_MS = 86_400_000;
  const ymd = (offset: number) =>
    new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10);
  const asDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const digestTasks = () =>
    prisma.task.findMany({
      where: {
        farmId: owner.farmId,
        sourceEventType: OFF_TARGET_TASK_EVENT,
        sourceEventId: { startsWith: `${planId}:` },
      },
    });
  const seedHistory = (estimated: boolean) =>
    prisma.feedPlanFitDay.createMany({
      data: [-1, -2].map((o) => ({
        farmId: owner.farmId,
        planId,
        cattleId,
        date: asDate(ymd(o)),
        severity: 'BAD' as const,
        estimated,
      })),
      skipDuplicates: true,
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    sweep = ctx.app.get(FeedPlanFitSweepService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    // A dry cow with a recorded weight and body condition, so nothing about her requirement is assumed.
    cattleId = (
      await request(server())
        .post(api('/cattle'))
        .set(...auth(owner))
        .send({
          tagNumber: `E2E-459B-${stamp}`,
          gender: 'FEMALE',
          weightKg: 500,
        })
        .expect(201)
    ).body.data.id as string;
    await prisma.cattle.update({
      where: { id: cattleId },
      data: { productionStatus: 'DRY', lastBcs: 3 },
    });

    const ing = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E 459b Ingredient ${stamp}`,
        pricePerKg: 8,
        dmPct: 35,
        cpPct: 8,
      })
      .expect(201);
    const feedItemId = (
      await request(server())
        .post(api('/inventory/feed-items'))
        .set(...auth(owner))
        .send({
          name: `E2E 459b Silage ${stamp}`,
          feedClass: 'FORAGE',
          ingredientId: ing.body.data.id,
          unitId: 'unit_kg',
          currentStock: 500,
          costPerUnit: 8,
          purchaseDate: new Date().toISOString(),
        })
        .expect(201)
    ).body.data.id as string;

    // 1 kg of silage a day is nowhere near what a 500 kg cow needs: a measured BAD fit.
    planId = (
      await request(server())
        .post(api('/feed/plans'))
        .set(...auth(owner))
        .send({
          name: `E2E 459b Plan ${stamp}`,
          lines: [{ lineType: 'FEED_ITEM', feedItemId, kgPerDay: 1 }],
        })
        .expect(201)
    ).body.data.id as string;
    await request(server())
      .post(api(`/feed/plans/${planId}/apply`))
      .set(...auth(owner))
      .send({ targetType: 'INDIVIDUAL', cattleIds: [cattleId] })
      .expect(201);
  }, 60_000);

  afterAll(async () => {
    await prisma.task.deleteMany({
      where: {
        farmId: owner.farmId,
        sourceEventType: OFF_TARGET_TASK_EVENT,
        sourceEventId: { startsWith: `${planId}:` },
      },
    });
    await prisma.feedPlanFitDay.deleteMany({ where: { planId } });
    await prisma.feedPlanAssignment.updateMany({
      where: { planId, removedAt: null },
      data: { removedAt: new Date(), removedBy: 'e2e-cleanup' },
    });
    // The API also creates a reproduction profile for a new cow; it must go first.
    await prisma.reproductionProfile.deleteMany({ where: { cattleId } });
    await prisma.cattle.deleteMany({ where: { id: cattleId } });
    await ctx.app.close();
  });

  it('stores today for every cow on the plan, judged measured, and raises nothing without a history', async () => {
    await sweep.sweepFarm(owner.farmId);
    const rows = await prisma.feedPlanFitDay.findMany({ where: { planId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      cattleId,
      severity: 'BAD',
      estimated: false,
    });
    expect(await digestTasks()).toHaveLength(0);
  });

  it('a re-run refreshes the day instead of duplicating it', async () => {
    await sweep.sweepFarm(owner.farmId);
    await sweep.sweepFarm(owner.farmId);
    expect(
      await prisma.feedPlanFitDay.count({
        where: { planId, date: asDate(ymd(0)) },
      }),
    ).toBe(1);
  });

  it('three measured days off target raise exactly one task, and a re-run does not add another', async () => {
    await seedHistory(false);
    await sweep.sweepFarm(owner.farmId);
    const tasks = await digestTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      category: 'FEEDING',
      source: 'SYSTEM_AUTO',
      sourceEventId: `${planId}:${ymd(0)}`,
    });
    expect(tasks[0].details).toContain(`E2E-459B-${stamp}`);

    await sweep.sweepFarm(owner.farmId);
    expect(await digestTasks()).toHaveLength(1);
  });

  it('an estimated day breaks the streak, so an estimated history raises nothing', async () => {
    await prisma.task.deleteMany({
      where: {
        farmId: owner.farmId,
        sourceEventType: OFF_TARGET_TASK_EVENT,
        sourceEventId: { startsWith: `${planId}:` },
      },
    });
    await prisma.feedPlanFitDay.updateMany({
      where: { planId, date: asDate(ymd(-1)) },
      data: { estimated: true },
    });
    await sweep.sweepFarm(owner.farmId);
    expect(await digestTasks()).toHaveLength(0);
  });
});

/* eslint-disable @typescript-eslint/no-unsafe-argument */
import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-489: POST /animal-events/bulk (+ ?dryRun). A mixed herd: females can take a heat, a bull cannot.
 * Requires dev stack + `pnpm seed`.
 */
describe('POST /animal-events/bulk (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerId: string;
  let managerId: string;
  const run = Date.now();
  const DAY = 86_400_000;
  const api = (p: string) => `${ctx.prefix}${p}`;
  const day = (n: number) => new Date(Date.now() - n * DAY).toISOString();
  const heat = { detectionMethod: 'VISUAL' };

  const post = (u: AuthedUser, body: object, qs = '') =>
    request(ctx.app.getHttpServer())
      .post(api(`/animal-events/bulk${qs}`))
      .set('Authorization', `Bearer ${u.token}`)
      .send(body);

  async function cow(key: string, gender: 'FEMALE' | 'MALE' = 'FEMALE') {
    return prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-489-${key}-${run}`,
        gender,
        dateOfBirth: new Date(Date.now() - 1500 * DAY),
        createdBy: ownerId,
      },
    });
  }
  const headers = (ids: string[], type: string) =>
    prisma.animalEvent.count({
      where: { cattleId: { in: ids }, type: type as never },
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    ownerId = (
      await prisma.user.findFirstOrThrow({
        where: { email: 'owner@demo.rakhal.test' },
        select: { id: true },
      })
    ).id;
    managerId = (
      await prisma.user.findFirstOrThrow({
        where: { email: 'manager@demo.rakhal.test' },
        select: { id: true },
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('dry run reports eligible and skipped animals and writes nothing', async () => {
    const a = await cow('D1');
    const b = await cow('D2');
    const bull = await cow('DB', 'MALE');
    const ids = [a.id, b.id, bull.id];
    const res = await post(
      owner,
      { type: 'HEAT', eventAt: day(1), payload: heat, cattleIds: ids },
      '?dryRun=true',
    ).expect(201);
    expect(res.body.data.dryRun).toBe(true);
    expect(res.body.data.batchId).toBeNull();
    const byId = new Map(
      res.body.data.results.map((r: { cattleId: string }) => [r.cattleId, r]),
    );
    expect(byId.get(a.id)!.status).toBe('ELIGIBLE');
    expect(byId.get(bull.id)!.status).toBe('SKIPPED');
    expect(byId.get(bull.id)!.reason).toBe('EVENT_WRONG_SEX');
    expect(await headers(ids, 'HEAT')).toBe(0);
  });

  it('skipIneligible saves the eligible animals, skips the rest with a reason, one batch, one grouped notification', async () => {
    const cows = [await cow('S1'), await cow('S2'), await cow('S3')];
    const bull = await cow('SB', 'MALE');
    const ids = [...cows.map((c) => c.id), bull.id];
    const res = await post(owner, {
      type: 'HEAT',
      eventAt: day(1),
      payload: heat,
      cattleIds: ids,
      category: 'milking',
    }).expect(201);
    const d = res.body.data;
    expect(d.requested).toBe(4);
    expect(d.saved).toBe(3);
    expect(d.skipped).toBe(1);
    expect(d.batchId).toBeTruthy();
    expect(d.results.map((r: { cattleId: string }) => r.cattleId)).toEqual(ids);
    expect(
      d.results.find((r: { cattleId: string }) => r.cattleId === bull.id),
    ).toMatchObject({ status: 'SKIPPED', reason: 'EVENT_WRONG_SEX' });

    const batch = await prisma.animalEventBatch.findUniqueOrThrow({
      where: { id: d.batchId },
    });
    expect(batch).toMatchObject({
      requested: 4,
      saved: 3,
      category: 'milking',
    });
    expect(batch.skipped).toEqual([
      { cattleId: bull.id, reason: 'EVENT_WRONG_SEX' },
    ]);
    expect(
      await prisma.animalEvent.count({ where: { batchId: d.batchId } }),
    ).toBe(3);
    expect(await headers([bull.id], 'HEAT')).toBe(0);

    // One grouped notification (to the manager; the actor is not told about their own save).
    const notes = await prisma.notification.findMany({
      where: { dedupeKey: `bulk_event_recorded:${d.batchId}` },
    });
    expect(notes.map((n) => n.userId)).toEqual([managerId]);
    expect(notes[0].params).toMatchObject({ saved: 3, requested: 4 });
  });

  it('allOrNothing refuses the whole request when any animal is blocked', async () => {
    const a = await cow('A1');
    const bull = await cow('AB', 'MALE');
    const before = await prisma.animalEventBatch.count({
      where: { recordedById: ownerId },
    });
    const res = await post(owner, {
      type: 'HEAT',
      eventAt: day(1),
      payload: heat,
      cattleIds: [a.id, bull.id],
      mode: 'allOrNothing',
    }).expect(422);
    expect(res.body.details.eventCode).toBe('BULK_BLOCKED');
    const statuses = res.body.details.results.map(
      (r: { status: string }) => r.status,
    );
    expect(statuses).toEqual(['ELIGIBLE', 'BLOCKED']);
    expect(await headers([a.id, bull.id], 'HEAT')).toBe(0);
    expect(
      await prisma.animalEventBatch.count({ where: { recordedById: ownerId } }),
    ).toBe(before);
  });

  it('WEIGHT takes a value per animal; an animal without one is skipped', async () => {
    const a = await cow('W1');
    const b = await cow('W2');
    const c = await cow('W3');
    const res = await post(owner, {
      type: 'WEIGHT',
      eventAt: day(1),
      cattleIds: [a.id, b.id, c.id],
      values: { [a.id]: { weightKg: 410 }, [b.id]: { weightKg: 395.5 } },
    }).expect(201);
    expect(res.body.data.saved).toBe(2);
    expect(
      res.body.data.results.find(
        (r: { cattleId: string }) => r.cattleId === c.id,
      ),
    ).toMatchObject({ status: 'SKIPPED', reason: 'VALUES_MISSING' });
    const wa = await prisma.weightRecord.findFirstOrThrow({
      where: { cattleId: a.id },
    });
    const wb = await prisma.weightRecord.findFirstOrThrow({
      where: { cattleId: b.id },
    });
    expect([wa.weightKg, wb.weightKg]).toEqual([410, 395.5]);
    expect(await prisma.weightRecord.count({ where: { cattleId: c.id } })).toBe(
      0,
    );
  });

  it('an unknown animal is a 404 and nothing is written', async () => {
    const a = await cow('U1');
    await post(owner, {
      type: 'HEAT',
      eventAt: day(1),
      payload: heat,
      cattleIds: [a.id, 'does-not-exist'],
    }).expect(404);
    expect(await headers([a.id], 'HEAT')).toBe(0);
  });

  it('validates: at most 100 animals, values only for per-animal types, no stray values', async () => {
    const a = await cow('V1');
    await post(owner, {
      type: 'HEAT',
      eventAt: day(1),
      payload: heat,
      cattleIds: Array.from({ length: 101 }, (_, i) => `id-${i}`),
    }).expect(400);
    await post(owner, {
      type: 'HEAT',
      eventAt: day(1),
      payload: heat,
      cattleIds: [a.id],
      values: { [a.id]: { x: 1 } },
    }).expect(422);
    await post(owner, {
      type: 'WEIGHT',
      eventAt: day(1),
      cattleIds: [a.id],
      values: { other: { weightKg: 1 } },
    }).expect(400);
  });

  it('a worker (no cattle.bulk) is refused', async () => {
    const a = await cow('P1');
    await post(worker, {
      type: 'HEAT',
      eventAt: day(1),
      payload: heat,
      cattleIds: [a.id],
    }).expect(403);
  });

  it('two overlapping bulk saves in opposite id order both complete (sorted locks, no deadlock)', async () => {
    const cows = [await cow('L1'), await cow('L2'), await cow('L3')];
    const ids = cows.map((c) => c.id);
    const body = (list: string[], kg: number) => ({
      type: 'WEIGHT',
      eventAt: day(1),
      cattleIds: list,
      values: Object.fromEntries(list.map((id) => [id, { weightKg: kg }])),
    });
    const [r1, r2] = await Promise.all([
      post(owner, body(ids, 300)),
      post(owner, body([...ids].reverse(), 310)),
    ]);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect(
      await prisma.weightRecord.count({ where: { cattleId: { in: ids } } }),
    ).toBe(6);
  });
});

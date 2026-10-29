/* eslint-disable @typescript-eslint/no-unsafe-argument */
import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-479: GET /cattle/:id/events pages the AnimalEvent headers (created by
 * the DB trigger on each detail insert) with an (eventAt, type, id) cursor.
 * Requires dev stack + `pnpm seed`.
 */
describe('GET /cattle/:id/events (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let cattleId: string;
  const run = Date.now();
  const api = (p: string) => `${ctx.prefix}${p}`;
  const get = (u: AuthedUser, qs = '') =>
    request(ctx.app.getHttpServer())
      .get(api(`/cattle/${cattleId}/events${qs}`))
      .set('Authorization', `Bearer ${u.token}`);

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-479-${run}`,
        gender: 'FEMALE',
        createdBy: user.id,
      },
    });
    cattleId = cow.id;
    const sameDay = new Date('2026-09-01T06:00:00.000Z');
    for (let i = 0; i < 3; i++) {
      await prisma.heatEvent.create({
        data: {
          cattleId,
          heatDateTime: sameDay,
          detectionMethod: 'VISUAL',
        },
      });
      await prisma.weightRecord.create({
        data: { cattleId, weightKg: 300 + i, recordedDate: sameDay },
      });
    }
    await prisma.weightRecord.create({
      data: {
        cattleId,
        weightKg: 280,
        recordedDate: new Date('2026-08-01T06:00:00.000Z'),
      },
    });
  }, 60_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('every detail insert got exactly one header (trigger)', async () => {
    const n = await prisma.animalEvent.count({ where: { cattleId } });
    expect(n).toBe(7);
    const linked = await prisma.heatEvent.count({
      where: { cattleId, animalEventId: { not: null } },
    });
    expect(linked).toBe(3);
  });

  it('pages same-day rows with no duplicates or gaps, newest first', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res: request.Response = await get(
        owner,
        `?limit=2${cursor ? `&cursor=${cursor}` : ''}`,
      ).expect(200);
      const page = { items: res.body.data, meta: res.body.meta };
      for (const e of page.items) {
        seen.push(e.id);
        expect(e.detail).not.toBeNull();
      }
      cursor = page.meta.hasNextPage ? page.meta.endCursor : null;
      pages++;
    } while (cursor && pages < 10);
    expect(pages).toBe(4);
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
    const all = await get(owner, '?limit=100').expect(200);
    expect(all.body.data.map((e: { id: string }) => e.id)).toEqual(seen);
    expect(all.body.data[6].type).toBe('WEIGHT');
  });

  it('filters by group and hides voided unless includeVoided', async () => {
    const repro = await get(owner, '?group=REPRODUCTION').expect(200);
    expect(repro.body.data).toHaveLength(3);
    const one = await prisma.animalEvent.findFirstOrThrow({
      where: { cattleId, type: 'HEAT' },
    });
    await prisma.animalEvent.update({
      where: { id: one.id },
      data: { status: 'VOIDED' },
    });
    const hidden = await get(owner, '?group=REPRODUCTION').expect(200);
    expect(hidden.body.data).toHaveLength(2);
    const shown = await get(
      owner,
      '?group=REPRODUCTION&includeVoided=true',
    ).expect(200);
    expect(shown.body.data).toHaveLength(3);
  });

  it('worker can read; trigger syncs date edits and deletes', async () => {
    await get(worker).expect(200);
    const w = await prisma.weightRecord.findFirstOrThrow({
      where: { cattleId, weightKg: 280 },
    });
    await prisma.weightRecord.update({
      where: { id: w.id },
      data: { recordedDate: new Date('2026-07-01T06:00:00.000Z') },
    });
    const h = await prisma.animalEvent.findUniqueOrThrow({
      where: { id: w.animalEventId! },
    });
    expect(h.eventAt.toISOString()).toBe('2026-07-01T06:00:00.000Z');
    await prisma.weightRecord.delete({ where: { id: w.id } });
    expect(
      await prisma.animalEvent.count({ where: { id: w.animalEventId! } }),
    ).toBe(0);
  });

  it('unknown animal 404s', async () => {
    await request(ctx.app.getHttpServer())
      .get(api('/cattle/does-not-exist/events'))
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(404);
  });
});

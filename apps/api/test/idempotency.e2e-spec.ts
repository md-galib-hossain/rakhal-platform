import { randomUUID } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  loginAs,
  TestContext,
  ThrowawayOwner,
} from './utils/e2e';

/**
 * WP8a (mobile offline sync, ADR-006): per-route `Idempotency-Key` on the four writes the app queues offline, the
 * milk-log version check, and the tolerant replay answers. Needs the dev stack up + `pnpm seed`.
 */
describe('Idempotency-Key and offline conflict rules (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerId: string;
  let milkCowId: string;
  const tag = `E2E-WP8A-${Date.now()}`;
  const cleanupCattle: string[] = [];
  const cleanupTasks: string[] = [];
  const keys: string[] = [];
  let other: ThrowawayOwner | null = null;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const newKey = (): string => {
    const k = `e2e-${randomUUID()}`;
    keys.push(k);
    return k;
  };
  const dueTomorrow = () => new Date(Date.now() + 86_400_000).toISOString();

  // Far-future, randomized day so this suite never collides with seeded data or another run on the shared dev DB.
  const day = () =>
    new Date(
      Date.now() +
        (400 + Math.floor(Math.random() * 1000)) * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);
  const milkRow = (date: string) =>
    prisma.milkLogEntry.findUnique({
      where: {
        cattleId_logDate_session: {
          cattleId: milkCowId,
          logDate: new Date(`${date}T00:00:00.000Z`),
          session: 'MORNING',
        },
      },
    });
  const saveMilk = (
    date: string,
    entry: Record<string, unknown>,
    key?: string,
    as: AuthedUser = owner,
  ) => {
    const req = request(server())
      .post(api('/milk/log'))
      .set(...auth(as));
    if (key) req.set('Idempotency-Key', key);
    return req.send({
      date,
      session: 'MORNING',
      entries: [{ cattleId: milkCowId, ...entry }],
    });
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    ownerId = (
      await prisma.user.findFirstOrThrow({
        where: { email: 'owner@demo.rakhal.test' },
        select: { id: true },
      })
    ).id;
    const table = await request(server())
      .get(api(`/milk/log?date=${day()}`))
      .set(...auth(owner))
      .expect(200);
    const eligible = (
      table.body.data.entries as Array<{
        cattleId: string;
        withholding: boolean;
      }>
    ).find((e) => !e.withholding);
    if (!eligible)
      throw new Error('No milking cow in demo data: run `pnpm seed`.');
    milkCowId = eligible.cattleId;
  }, 30_000);

  afterAll(async () => {
    await prisma.milkLogEntry.deleteMany({
      where: {
        cattleId: milkCowId,
        logDate: { gt: new Date(Date.now() + 300 * 86_400_000) },
      },
    });
    await prisma.healthCase.deleteMany({
      where: { cattleId: { in: cleanupCattle } },
    });
    await prisma.task.deleteMany({ where: { id: { in: cleanupTasks } } });
    await prisma.cattle.updateMany({
      where: { id: { in: cleanupCattle } },
      data: { deletedAt: new Date() },
    });
    await prisma.idempotencyKey.deleteMany({ where: { key: { in: keys } } });
    if (other) await deleteThrowawayOwner(prisma, other);
    await ctx.app.close();
  });

  describe('POST /milk/log', () => {
    it('a replay returns the first response, flagged, and writes one row', async () => {
      const date = day();
      const key = newKey();
      const first = await saveMilk(date, { yieldL: 3 }, key).expect(201);
      expect(first.headers['idempotency-replayed']).toBeUndefined();
      expect(first.body.data).toMatchObject({ saved: 1, conflicts: [] });

      const again = await saveMilk(date, { yieldL: 3 }, key).expect(201);
      expect(again.headers['idempotency-replayed']).toBe('true');
      expect(again.body.data).toEqual(first.body.data);
      expect(
        await prisma.milkLogEntry.count({
          where: {
            cattleId: milkCowId,
            logDate: new Date(`${date}T00:00:00.000Z`),
          },
        }),
      ).toBe(1);
    });

    it('the same key with a different body is 422 and changes nothing', async () => {
      const date = day();
      const key = newKey();
      await saveMilk(date, { yieldL: 3 }, key).expect(201);
      const res = await saveMilk(date, { yieldL: 9 }, key).expect(422);
      expect(res.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
      expect((await milkRow(date))?.yieldL).toBe(3);
    });

    it('rejects a malformed key with 400', async () => {
      await saveMilk(day(), { yieldL: 3 }, 'short').expect(400);
    });

    it('the same key in another farm is an independent request', async () => {
      const key = newKey();
      other = await createThrowawayOwner(ctx, prisma, 'WP8a other farm');
      const create = async (as: AuthedUser) =>
        (
          await request(server())
            .post(api('/tasks'))
            .set(...auth(as))
            .send({ name: `${tag} cross-farm`, dueAt: dueTomorrow() })
            .expect(201)
        ).body.data.id as string;
      const mine = await create(owner);
      const theirs = await create(other.owner);
      cleanupTasks.push(mine, theirs);

      const a = await request(server())
        .post(api(`/tasks/${mine}/complete`))
        .set(...auth(owner))
        .set('Idempotency-Key', key)
        .send({})
        .expect(201);
      const b = await request(server())
        .post(api(`/tasks/${theirs}/complete`))
        .set(...auth(other.owner))
        .set('Idempotency-Key', key)
        .send({})
        .expect(201);
      expect(a.headers['idempotency-replayed']).toBeUndefined();
      expect(b.headers['idempotency-replayed']).toBeUndefined();
      expect(b.body.data.id).toBe(theirs);
    });
  });

  describe('milk-log version check (baseUpdatedAt)', () => {
    it('keeps the plain overwrite when baseUpdatedAt is omitted (web behaviour)', async () => {
      const date = day();
      await saveMilk(date, { yieldL: 3 }).expect(201);
      const res = await saveMilk(date, { yieldL: 6 }).expect(201);
      expect(res.body.data).toMatchObject({ saved: 1, conflicts: [] });
      expect((await milkRow(date))?.yieldL).toBe(6);
    });

    it('saves when the base is current, and refuses a stale base with the server version', async () => {
      const date = day();
      await saveMilk(date, { yieldL: 3 }).expect(201);
      const v1 = (await milkRow(date))!;
      expect(v1.updatedBy).toBe(ownerId);

      const edit = await saveMilk(date, {
        yieldL: 4,
        baseUpdatedAt: v1.updatedAt.toISOString(),
      }).expect(201);
      expect(edit.body.data).toMatchObject({ saved: 1, conflicts: [] });

      const stale = await saveMilk(date, {
        yieldL: 9,
        baseUpdatedAt: v1.updatedAt.toISOString(),
      }).expect(201);
      expect(stale.body.data.saved).toBe(0);
      expect(stale.body.data.conflicts).toHaveLength(1);
      expect(stale.body.data.conflicts[0]).toMatchObject({
        cattleId: milkCowId,
        server: { yieldL: 4, updatedBy: ownerId },
        yours: { yieldL: 9 },
      });
      expect(stale.body.data.conflicts[0].server.updatedByName).toEqual(
        expect.any(String),
      );
      expect((await milkRow(date))?.yieldL).toBe(4);
    });

    it('a null base means "the device saw no row": conflict when one exists, save when none does', async () => {
      const date = day();
      await saveMilk(date, { yieldL: 5, baseUpdatedAt: null }).expect(201);
      expect((await milkRow(date))?.yieldL).toBe(5);

      const res = await saveMilk(date, {
        yieldL: 8,
        baseUpdatedAt: null,
      }).expect(201);
      expect(res.body.data.saved).toBe(0);
      expect(res.body.data.conflicts).toHaveLength(1);
      expect((await milkRow(date))?.yieldL).toBe(5);
    });

    it('an identical entry is not a conflict even with a stale base', async () => {
      const date = day();
      await saveMilk(date, { yieldL: 5 }).expect(201);
      const old = new Date(Date.now() - 86_400_000).toISOString();
      const res = await saveMilk(date, {
        yieldL: 5,
        baseUpdatedAt: old,
      }).expect(201);
      expect(res.body.data).toMatchObject({ saved: 1, conflicts: [] });
    });

    it('replaying a conflicted request returns the same split and still writes nothing', async () => {
      const date = day();
      await saveMilk(date, { yieldL: 4 }).expect(201);
      const key = newKey();
      const old = new Date(Date.now() - 86_400_000).toISOString();
      const first = await saveMilk(
        date,
        { yieldL: 9, baseUpdatedAt: old },
        key,
      ).expect(201);
      const again = await saveMilk(
        date,
        { yieldL: 9, baseUpdatedAt: old },
        key,
      ).expect(201);
      expect(again.headers['idempotency-replayed']).toBe('true');
      expect(again.body.data).toEqual(first.body.data);
      expect((await milkRow(date))?.yieldL).toBe(4);
    });
  });

  describe('POST /milk/submit', () => {
    it('with a key: a second submit of a finished session is 200 alreadySubmitted; without a key it stays 400', async () => {
      const date = day();
      await saveMilk(date, { yieldL: 0.1 }).expect(201);
      const submit = (key?: string) => {
        const req = request(server())
          .post(api('/milk/submit'))
          .set(...auth(owner));
        if (key) req.set('Idempotency-Key', key);
        return req.send({ date, session: 'MORNING' });
      };

      const k1 = newKey();
      const first = await submit(k1).expect(201);
      expect(first.body.data).toMatchObject({
        totalCowsLogged: 1,
        alreadySubmitted: false,
      });

      const replay = await submit(k1).expect(201);
      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(replay.body.data).toEqual(first.body.data);

      const second = await submit(newKey()).expect(201);
      expect(second.body.data).toMatchObject({
        totalCowsLogged: 0,
        alreadySubmitted: true,
      });

      await submit().expect(400);
    });
  });

  describe('POST /health/cases', () => {
    it('a replay opens one case, not two', async () => {
      const cow = await prisma.cattle.create({
        data: {
          farmId: owner.farmId,
          tagNumber: `${tag}-cow`,
          gender: 'FEMALE',
          createdBy: ownerId,
        },
      });
      cleanupCattle.push(cow.id);
      const key = newKey();
      const post = (note: string) =>
        request(server())
          .post(api('/health/cases'))
          .set(...auth(owner))
          .set('Idempotency-Key', key)
          .send({
            cattleId: cow.id,
            careType: 'CURATIVE',
            priority: 'HIGH',
            condition: 'MASTITIS',
            note,
          });

      const first = await post(`${tag} first`).expect(201);
      const again = await post(`${tag} first`).expect(201);
      expect(again.headers['idempotency-replayed']).toBe('true');
      expect(again.body.data.id).toBe(first.body.data.id);
      expect(
        await prisma.healthCase.count({
          where: { cattleId: cow.id, deletedAt: null },
        }),
      ).toBe(1);

      await post(`${tag} different note`).expect(422);
    });
  });

  describe('POST /tasks/:id/complete', () => {
    it('a repeat with a key is 200 alreadyCompleted with who did it; without a key it stays 400', async () => {
      const created = await request(server())
        .post(api('/tasks'))
        .set(...auth(owner))
        .send({ name: `${tag} complete`, dueAt: dueTomorrow() })
        .expect(201);
      const id = created.body.data.id as string;
      cleanupTasks.push(id);
      const complete = (key?: string) => {
        const req = request(server())
          .post(api(`/tasks/${id}/complete`))
          .set(...auth(owner));
        if (key) req.set('Idempotency-Key', key);
        return req.send({});
      };

      const k1 = newKey();
      const first = await complete(k1).expect(201);
      expect(first.body.data).toMatchObject({
        status: 'COMPLETED',
        alreadyCompleted: false,
      });

      const replay = await complete(k1).expect(201);
      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(replay.body.data).toEqual(first.body.data);

      const second = await complete(newKey()).expect(201);
      expect(second.headers['idempotency-replayed']).toBeUndefined();
      expect(second.body.data).toMatchObject({
        id,
        status: 'COMPLETED',
        alreadyCompleted: true,
        nextRecurrenceCreated: false,
      });
      expect(second.body.data.completedByName).toEqual(expect.any(String));

      await complete().expect(400);
    });

    it('two concurrent completes finish the task once', async () => {
      const created = await request(server())
        .post(api('/tasks'))
        .set(...auth(owner))
        .send({ name: `${tag} race`, dueAt: dueTomorrow() })
        .expect(201);
      const id = created.body.data.id as string;
      cleanupTasks.push(id);
      const go = () =>
        request(server())
          .post(api(`/tasks/${id}/complete`))
          .set(...auth(owner))
          .set('Idempotency-Key', newKey())
          .send({});
      const [a, b] = await Promise.all([go(), go()]);
      expect([a.status, b.status]).toEqual([201, 201]);
      const flags = [
        a.body.data.alreadyCompleted,
        b.body.data.alreadyCompleted,
      ];
      expect(flags.filter(Boolean)).toHaveLength(1);
      expect(
        await prisma.taskAuditLog.count({
          where: { taskId: id, action: 'COMPLETED' },
        }),
      ).toBe(1);
    });
  });
});

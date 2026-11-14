import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';
import {
  bearer,
  createNotificationV2Harness,
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  loginAs,
  type AuthedUser,
  type NotificationV2Harness,
  type TestContext,
  type ThrowawayOwner,
} from './utils/e2e';

/**
 * RAKHAL-494 (NV2-B03): manual notification API. Farm timezone Asia/Dhaka (UTC+6). The fake clock is fixed at
 * 2026-11-10T00:00Z (06:00 farm-local) so every date below is in the future and nothing waits.
 */
describe('Notification schedules API (RAKHAL-494)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let h: NotificationV2Harness;
  let a: ThrowawayOwner;
  let b: ThrowawayOwner;
  let manager: AuthedUser;
  let worker: AuthedUser;
  let managerId: string;
  let workerId: string;
  let otherWorker: AuthedUser;
  let otherWorkerId: string;
  const password = 'NotifE2e123';
  const created: string[] = [];

  const api = (path: string) => `${ctx.prefix}/notifications${path}`;
  const post = (u: AuthedUser, path: string, body?: object) =>
    request(ctx.app.getHttpServer())
      .post(api(path))
      .set(...bearer(u))
      .send(body ?? {});
  const get = (u: AuthedUser, path: string) =>
    request(ctx.app.getHttpServer())
      .get(api(path))
      .set(...bearer(u));
  const patch = (u: AuthedUser, path: string, body: object) =>
    request(ctx.app.getHttpServer())
      .patch(api(path))
      .set(...bearer(u))
      .send(body);
  const del = (u: AuthedUser, path: string) =>
    request(ctx.app.getHttpServer())
      .delete(api(path))
      .set(...bearer(u));

  const self = (userId: string) => ({ mode: 'USER', user_id: userId });
  const dateBody = (userId: string, over: object = {}) => ({
    title: 'Check the fence',
    trigger: 'DATE',
    date: '2026-11-12',
    time: '15:30',
    audience: self(userId),
    ...over,
  });

  async function addMember(
    farmId: string,
    role: 'Manager' | 'Worker',
    email: string,
  ) {
    const user = await prisma.user.create({
      data: {
        email,
        name: `NV2 ${role}`,
        passwordHash: await ctx.app.get(PasswordService).hashPassword(password),
        isEmailVerified: true,
      },
    });
    const r = await prisma.role.findFirstOrThrow({
      where: { name: role, isSystemRole: true },
    });
    await prisma.farmMember.create({
      data: { farmId, userId: user.id, roleId: r.id },
    });
    const authed = await loginAs(ctx, email, password);
    return { user, authed };
  }

  beforeAll(async () => {
    h = createNotificationV2Harness(new Date('2026-11-10T00:00:00Z'));
    ctx = await createTestApp({ configure: h.configure });
    prisma = ctx.app.get(PrismaService);
    a = await createThrowawayOwner(ctx, prisma, 'NV2 schedules A');
    b = await createThrowawayOwner(ctx, prisma, 'NV2 schedules B');
    const stamp = Date.now();
    const m = await addMember(
      a.farmId,
      'Manager',
      `nv2-m-${stamp}@rakhal.test`,
    );
    const w = await addMember(a.farmId, 'Worker', `nv2-w-${stamp}@rakhal.test`);
    const w2 = await addMember(
      a.farmId,
      'Worker',
      `nv2-w2-${stamp}@rakhal.test`,
    );
    manager = m.authed;
    worker = w.authed;
    otherWorker = w2.authed;
    managerId = m.user.id;
    workerId = w.user.id;
    otherWorkerId = w2.user.id;
    created.push(m.user.id, w.user.id, w2.user.id);
  });

  afterAll(async () => {
    await prisma.notificationSchedule
      .deleteMany({ where: { farmId: { in: [a.farmId, b.farmId] } } })
      .catch(() => undefined);
    await prisma.farmMember
      .deleteMany({ where: { userId: { in: created } } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: created } } })
      .catch(() => undefined);
    await deleteThrowawayOwner(prisma, a);
    await deleteThrowawayOwner(prisma, b);
    await ctx.app.close();
  });

  it('creates a timed schedule: farm-local 15:30 is 09:30Z, exact minute, and next_fire_at matches', async () => {
    const res = await post(a.owner, '/schedules', dateBody(a.userId)).expect(
      201,
    );
    const s = res.body.data;
    expect(s.status).toBe('ACTIVE');
    expect(s.time).toBe('15:30');
    expect(s.date).toBe('2026-11-12');
    expect(s.all_day).toBe(false);
    expect(s.next_fire_at).toBe('2026-11-12T09:30:00.000Z');
    expect(s.can_edit).toBe(true);
    const occ = await prisma.notificationOccurrence.findMany({
      where: { scheduleId: s.id },
    });
    expect(occ).toHaveLength(1);
    expect(occ[0].fireAt.toISOString()).toBe('2026-11-12T09:30:00.000Z');
  });

  it('without a time the notice is all-day and fires at 08:00 farm-local (02:00Z)', async () => {
    const res = await post(
      a.owner,
      '/schedules',
      dateBody(a.userId, { time: undefined }),
    ).expect(201);
    expect(res.body.data.all_day).toBe(true);
    expect(res.body.data.time).toBeNull();
    expect(res.body.data.next_fire_at).toBe('2026-11-12T02:00:00.000Z');
  });

  describe('RBAC matrix', () => {
    it('Worker may create for self, never for another user or a role', async () => {
      await post(worker, '/schedules', dateBody(workerId)).expect(201);
      await post(worker, '/schedules', dateBody(a.userId)).expect(403);
      await post(
        worker,
        '/schedules',
        dateBody(workerId, { audience: { mode: 'ROLES', roles: ['Manager'] } }),
      ).expect(403);
      await post(
        worker,
        '/schedules',
        dateBody(workerId, {
          audience: { mode: 'USERS', user_ids: [workerId] },
        }),
      ).expect(403);
    });

    it('Manager and Owner may target roles and other users', async () => {
      await post(
        manager,
        '/schedules',
        dateBody(managerId, { audience: { mode: 'ROLES', roles: ['Worker'] } }),
      ).expect(201);
      await post(
        a.owner,
        '/schedules',
        dateBody(a.userId, {
          audience: { mode: 'USERS', user_ids: [managerId, workerId] },
        }),
      ).expect(201);
    });

    it('scope=farm needs notification.manage; scope=mine is own only', async () => {
      await get(worker, '/schedules?scope=farm').expect(403);
      const farm = await get(manager, '/schedules?scope=farm&limit=100').expect(
        200,
      );
      const ids = (farm.body.data as { created_by: string }[]).map(
        (s) => s.created_by,
      );
      expect(new Set(ids).size).toBeGreaterThan(1);
      const mine = await get(worker, '/schedules?scope=mine').expect(200);
      expect(
        (mine.body.data as { created_by: string }[]).every(
          (s) => s.created_by === workerId,
        ),
      ).toBe(true);
    });

    it("Worker cannot read, edit, pause or cancel another user's schedule; Manager can", async () => {
      const mine = await post(a.owner, '/schedules', dateBody(a.userId)).expect(
        201,
      );
      const id = mine.body.data.id as string;
      await get(worker, `/schedules/${id}`).expect(403);
      await patch(worker, `/schedules/${id}`, { title: 'x' }).expect(403);
      await post(worker, `/schedules/${id}/pause`).expect(403);
      await del(worker, `/schedules/${id}`).expect(403);
      await post(manager, `/schedules/${id}/pause`).expect(201);
      await post(manager, `/schedules/${id}/resume`).expect(201);
      await del(manager, `/schedules/${id}`).expect(200);
    });

    it('Worker may edit their own and cannot retarget it', async () => {
      const mine = await post(worker, '/schedules', dateBody(workerId)).expect(
        201,
      );
      const id = mine.body.data.id as string;
      await patch(worker, `/schedules/${id}`, {
        title: 'Mine, renamed',
      }).expect(200);
      await patch(worker, `/schedules/${id}`, {
        audience: self(otherWorkerId),
      }).expect(403);
    });
  });

  describe('cross-farm and membership', () => {
    it('a user id from another farm is a 404', async () => {
      await post(a.owner, '/schedules', dateBody(b.userId)).expect(404);
      await post(
        a.owner,
        '/schedules',
        dateBody(a.userId, {
          audience: { mode: 'USERS', user_ids: [a.userId, b.userId] },
        }),
      ).expect(404);
    });

    it('an unknown role, animal or anchor is a 404', async () => {
      await post(
        a.owner,
        '/schedules',
        dateBody(a.userId, {
          audience: { mode: 'ROLES', roles: ['NoSuchRole'] },
        }),
      ).expect(404);
      await post(
        a.owner,
        '/schedules',
        dateBody(a.userId, { animal_ids: ['not-an-animal'] }),
      ).expect(404);
      await post(a.owner, '/schedules', {
        title: 'After',
        trigger: 'AFTER_EVENT',
        anchor: { type: 'TASK', id: 'nope' },
        offset_days: 3,
        audience: self(a.userId),
      }).expect(404);
    });

    it("another farm's schedule is a 404 on every route", async () => {
      const theirs = await post(
        b.owner,
        '/schedules',
        dateBody(b.userId),
      ).expect(201);
      const id = theirs.body.data.id as string;
      await get(a.owner, `/schedules/${id}`).expect(404);
      await patch(a.owner, `/schedules/${id}`, { title: 'x' }).expect(404);
      await post(a.owner, `/schedules/${id}/pause`).expect(404);
      await del(a.owner, `/schedules/${id}`).expect(404);
    });

    it('farmId in the body is rejected (whitelist)', async () => {
      const r = await post(
        a.owner,
        '/schedules',
        dateBody(a.userId, { farmId: b.farmId }),
      );
      expect([400, 422]).toContain(r.status);
    });
  });

  describe('preview', () => {
    it('writes nothing and equals the instants the real create schedules', async () => {
      const body = dateBody(a.userId, {
        date: '2026-11-20',
        time: '07:45',
        lead_minutes: [1440, 60, 0],
        title: 'Preview parity',
      });
      const before = await prisma.notificationSchedule.count({
        where: { farmId: a.farmId },
      });
      const pv = await post(a.owner, '/schedules/preview', body).expect(201);
      expect(
        await prisma.notificationSchedule.count({
          where: { farmId: a.farmId },
        }),
      ).toBe(before);
      expect(pv.body.data.recipient_count).toBe(1);
      expect(pv.body.data.timezone).toBe('Asia/Dhaka');
      const preview = (
        pv.body.data.next_fire_times as { fire_at: string }[]
      ).map((f) => f.fire_at);

      const real = await post(a.owner, '/schedules', body).expect(201);
      const occ = await prisma.notificationOccurrence.findMany({
        where: { scheduleId: real.body.data.id },
        orderBy: { fireAt: 'asc' },
      });
      expect(occ.map((o) => o.fireAt.toISOString())).toEqual(preview);
      expect(pv.body.data.next_fire_times[0].local).toBe('2026-11-19T07:45');
    });

    it('a repeating series previews up to 5 instants across anchors', async () => {
      const pv = await post(
        a.owner,
        '/schedules/preview',
        dateBody(a.userId, { repeat: { type: 'WEEKLY' }, title: 'Weekly' }),
      ).expect(201);
      const f = pv.body.data.next_fire_times as { local: string }[];
      expect(f.map((x) => x.local)).toEqual([
        '2026-11-12T15:30',
        '2026-11-19T15:30',
        '2026-11-26T15:30',
        '2026-12-03T15:30',
        '2026-12-10T15:30',
      ]);
    });

    it('Worker may preview, but only for themselves', async () => {
      await post(worker, '/schedules/preview', dateBody(workerId)).expect(201);
      await post(worker, '/schedules/preview', dateBody(a.userId)).expect(403);
    });
  });

  describe('validation and limits', () => {
    it('a date entirely in the past is a 422', async () => {
      const r = await post(
        a.owner,
        '/schedules',
        dateBody(a.userId, { date: '2026-11-01' }),
      ).expect(422);
      expect(JSON.stringify(r.body)).toContain('NO_FUTURE_OCCURRENCE');
    });

    it('bad leads, repeat and shapes give 4xx', async () => {
      const bad = (over: object, status: number) =>
        post(a.owner, '/schedules', dateBody(a.userId, over)).expect(status);
      await bad({ time: undefined, lead_minutes: [90] }, 422);
      await bad({ lead_minutes: [0, 1, 2, 3, 4] }, 400);
      await bad({ repeat: { type: 'EVERY_N_DAYS' } }, 422);
      await bad({ date: undefined }, 422);
      await bad({ title: '' }, 400);
      await bad({ title: 'x'.repeat(121) }, 400);
      await bad({ time: '25:00' }, 400);
    });

    it('50 active schedules per user, then 422 SCHEDULE_LIMIT', async () => {
      const active = await prisma.notificationSchedule.count({
        where: {
          farmId: a.farmId,
          origin: 'USER',
          createdBy: managerId,
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
      });
      await prisma.notificationSchedule.createMany({
        data: Array.from({ length: 50 - active }, (_, i) => ({
          farmId: a.farmId,
          origin: 'USER' as const,
          createdBy: managerId,
          status: 'PAUSED' as const,
          title: `filler ${i}`,
          category: 'operational',
          priority: 'medium',
          eventKey: 'custom_reminder',
          trigger: 'DATE' as const,
          baseAnchorAt: new Date('2026-12-01T00:00:00Z'),
          anchorAt: new Date('2026-12-01T00:00:00Z'),
          leadMinutes: [0],
          audienceMode: 'USER' as const,
          audienceUserIds: [managerId],
        })),
      });
      const r = await post(manager, '/schedules', dateBody(managerId)).expect(
        422,
      );
      expect(JSON.stringify(r.body)).toContain('SCHEDULE_LIMIT');
      // Another user is unaffected.
      await post(a.owner, '/schedules', dateBody(a.userId)).expect(201);
    });
  });

  describe('lifecycle', () => {
    it('pause hides it from Upcoming, resume brings it back, cancel removes it', async () => {
      const s = (
        await post(
          otherWorker,
          '/schedules',
          dateBody(otherWorkerId, { title: 'Lifecycle' }),
        ).expect(201)
      ).body.data;
      const titles = async () =>
        (
          (await get(otherWorker, '/upcoming?limit=100').expect(200)).body
            .data as { title: string }[]
        ).map((r) => r.title);
      expect(await titles()).toContain('Lifecycle');
      await post(otherWorker, `/schedules/${s.id}/pause`).expect(201);
      expect(await titles()).not.toContain('Lifecycle');
      const resumed = await post(
        otherWorker,
        `/schedules/${s.id}/resume`,
      ).expect(201);
      expect(resumed.body.data.status).toBe('ACTIVE');
      expect(await titles()).toContain('Lifecycle');
      await del(otherWorker, `/schedules/${s.id}`).expect(200);
      expect(await titles()).not.toContain('Lifecycle');
      await post(otherWorker, `/schedules/${s.id}/resume`).expect(409);
    });

    it('editing the time moves the occurrence and keeps the schedule id', async () => {
      const s = (
        await post(
          a.owner,
          '/schedules',
          dateBody(a.userId, { title: 'Move me' }),
        ).expect(201)
      ).body.data;
      const upd = await patch(a.owner, `/schedules/${s.id}`, {
        time: '18:00',
      }).expect(200);
      expect(upd.body.data.id).toBe(s.id);
      expect(upd.body.data.next_fire_at).toBe('2026-11-12T12:00:00.000Z');
      const occ = await prisma.notificationOccurrence.findMany({
        where: { scheduleId: s.id },
      });
      expect(occ.filter((o) => o.status === 'SCHEDULED')).toHaveLength(1);
    });

    it('a SYSTEM schedule is read-only (409)', async () => {
      const sys = await prisma.notificationSchedule.create({
        data: {
          farmId: a.farmId,
          origin: 'SYSTEM',
          title: 'system',
          category: 'operational',
          priority: 'medium',
          eventKey: 'scheduled_upcoming',
          trigger: 'SOURCE_DUE',
          baseAnchorAt: new Date('2026-11-12T00:00:00Z'),
          anchorAt: new Date('2026-11-12T00:00:00Z'),
          leadMinutes: [1440],
          audienceMode: 'SOURCE',
          sourceType: 'TASK',
          sourceKey: `id:nv2-b03-${Date.now()}`,
        },
      });
      await patch(a.owner, `/schedules/${sys.id}`, { title: 'x' }).expect(409);
      await del(a.owner, `/schedules/${sys.id}`).expect(409);
    });
  });

  describe('GET /notifications/upcoming', () => {
    it('Worker sees only what targets them; Owner sees role-targeted rows too', async () => {
      const res = await get(worker, '/upcoming?limit=100').expect(200);
      const rows = res.body.data as { origin: string; can_edit: boolean }[];
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.origin === 'USER')).toBe(true);
      // The Manager-created ROLES:[Worker] schedule reaches the worker, who cannot edit it.
      expect(rows.some((r) => r.can_edit === false)).toBe(true);
      const owner = await get(a.owner, '/upcoming?limit=100').expect(200);
      expect((owner.body.data as unknown[]).length).toBeGreaterThan(0);
    });

    it('is cursor paginated, ordered by fire time then id, with no gaps or repeats', async () => {
      const seen: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      for (;;) {
        const r = await get(
          a.owner,
          `/upcoming?limit=2&to=2026-12-31${cursor ? `&cursor=${cursor}` : ''}`,
        ).expect(200);
        const rows = r.body.data as { occurrence_id: string }[];
        seen.push(...rows.map((x) => x.occurrence_id));
        pages++;
        expect(rows.length).toBeLessThanOrEqual(2);
        if (!r.body.meta.hasNextPage) break;
        cursor = r.body.meta.endCursor as string;
        expect(pages).toBeLessThan(80);
      }
      expect(new Set(seen).size).toBe(seen.length);
      expect(pages).toBeGreaterThan(1);
      const all = await get(
        a.owner,
        '/upcoming?limit=100&to=2026-12-31',
      ).expect(200);
      const full = all.body.data as {
        occurrence_id: string;
        fire_at: string;
      }[];
      expect(full.map((x) => x.occurrence_id)).toEqual(seen);
      const times = full.map((x) => x.fire_at);
      expect([...times].sort()).toEqual(times);
    });

    it('rejects an inverted or oversized window and a bad cursor', async () => {
      await get(a.owner, '/upcoming?from=2026-12-01&to=2026-11-01').expect(422);
      await get(a.owner, '/upcoming?from=2026-01-01&to=2026-12-01').expect(422);
      await get(a.owner, '/upcoming?cursor=garbage').expect(400);
    });

    it("never shows another farm's rows", async () => {
      const r = await get(b.owner, '/upcoming?limit=100&to=2026-12-31').expect(
        200,
      );
      const titles = (r.body.data as { title: string }[]).map((x) => x.title);
      expect(titles).not.toContain('Lifecycle');
      expect(titles).not.toContain('Preview parity');
    });
  });
});

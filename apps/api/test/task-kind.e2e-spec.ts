import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { FollowUpReminderService } from '../src/modules/animal-events/application/services/follow-up-reminder.service';
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
 * RAKHAL-491 fix round 1: server-side `status` / `recurring` filters, first-page-only counters,
 * kind/category guards, and reminders excluded from task counts. Runs in a throwaway farm so every
 * count is exact (no `<=1` slack from other agents' rows).
 */
describe('Task kind split - filters, counters, guards (RAKHAL-491 fix 1)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let tw: ThrowawayOwner;
  let other: AuthedUser;
  const DAY = 86_400_000;
  const api = (p: string) => `${ctx.prefix}${p}`;
  const get = (u: AuthedUser, p: string) =>
    request(ctx.app.getHttpServer())
      .get(api(p))
      .set('Authorization', `Bearer ${u.token}`);
  const send = (
    m: 'post' | 'patch',
    u: AuthedUser,
    p: string,
    body: object = {},
  ) =>
    request(ctx.app.getHttpServer())
      [m](api(p))
      .set('Authorization', `Bearer ${u.token}`)
      .send(body);
  const ids = (res: request.Response) =>
    (res.body.data as { id: string }[]).map((x) => x.id);

  const mk = async (body: object) =>
    (await send('post', tw.owner, '/tasks', body).expect(201)).body.data as {
      id: string;
      kind: string;
      category: string;
    };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    tw = await createThrowawayOwner(ctx, prisma, `Task kind ${Date.now()}`);
    other = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 60_000);

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { farmId: tw.farmId } });
    await deleteThrowawayOwner(prisma, tw);
    await ctx.app.close();
  });

  it('status + recurring filters are exact and combine with kind; invalid status is 400', async () => {
    const before = (await get(tw.owner, '/tasks').expect(200)).body.meta;
    expect(before.reminderHighlights).toEqual({
      upcoming: 0,
      overdue: 0,
      repeating: 0,
    });

    const plain = await mk({
      name: 'plain',
      dueAt: new Date(Date.now() + DAY),
    });
    const done = await mk({ name: 'done', dueAt: new Date(Date.now() + DAY) });
    await send('post', tw.owner, `/tasks/${done.id}/complete`).expect(201);
    const cancelled = await mk({
      name: 'cancelled',
      dueAt: new Date(Date.now() + DAY),
    });
    await send('post', tw.owner, `/tasks/${cancelled.id}/cancel`).expect(201);
    const repeating = await mk({
      name: 'repeating',
      kind: 'REMINDER',
      dueAt: new Date(Date.now() + 2 * DAY),
      recurring: true,
      recurrenceType: 'DAILY',
    });
    const oneOff = await mk({
      name: 'oneoff',
      kind: 'REMINDER',
      dueAt: new Date(Date.now() - DAY),
    });

    const closed = await get(tw.owner, '/tasks?status=COMPLETED,CANCELLED');
    expect(closed.status).toBe(200);
    expect(ids(closed).sort()).toEqual([done.id, cancelled.id].sort());

    const open = await get(tw.owner, '/tasks?status=PENDING,IN_PROGRESS');
    expect(ids(open).sort()).toEqual(
      [plain.id, repeating.id, oneOff.id].sort(),
    );

    const rec = await get(tw.owner, '/tasks?recurring=true');
    expect(ids(rec)).toEqual([repeating.id]);
    const notRec = await get(tw.owner, '/tasks?kind=reminder&recurring=false');
    expect(ids(notRec)).toEqual([oneOff.id]);
    // combined with another filter (overdue) and status
    const both = await get(
      tw.owner,
      '/tasks?kind=reminder&filter=overdue&status=PENDING',
    );
    expect(ids(both)).toEqual([oneOff.id]);

    await get(tw.owner, '/tasks?status=COMPLETED,BOGUS').expect(400);
    await get(tw.owner, '/tasks?recurring=maybe').expect(400);

    // exact counters (delta from the empty baseline)
    const after = (await get(tw.owner, '/tasks').expect(200)).body.meta;
    expect(after.reminderHighlights).toEqual({
      upcoming: 1,
      overdue: 1,
      repeating: 1,
    });
    expect(after.highlights.overdue).toBe(0);
  });

  it('filter=upcoming partitions open items exactly with overdue; combines with kind/status; desc order; bad value 400', async () => {
    const blocked = await mk({
      name: 'blocked-future',
      kind: 'REMINDER',
      dueAt: new Date(Date.now() + 3 * DAY),
    });
    await prisma.task.update({
      where: { id: blocked.id },
      data: { status: 'BLOCKED' },
    });
    await mk({ name: 'late-task', dueAt: new Date(Date.now() - 2 * DAY) });

    const open = ids(
      await get(
        tw.owner,
        '/tasks?status=PENDING,IN_PROGRESS,BLOCKED&limit=100',
      ),
    );
    const up = ids(
      await get(tw.owner, '/tasks?filter=upcoming&limit=100').expect(200),
    );
    const over = ids(
      await get(tw.owner, '/tasks?filter=overdue&limit=100').expect(200),
    );

    // no gap, no overlap: every open item is in exactly one set; closed items in neither
    expect(up.filter((i) => over.includes(i))).toEqual([]);
    expect([...up, ...over].sort()).toEqual([...open].sort());
    expect(up).toContain(blocked.id);

    // kind + status combos
    const upRem = await get(
      tw.owner,
      '/tasks?filter=upcoming&kind=reminder',
    ).expect(200);
    expect(ids(upRem).every((i) => up.includes(i))).toBe(true);
    expect(
      (upRem.body.data as { kind: string }[]).every(
        (t) => t.kind === 'REMINDER',
      ),
    ).toBe(true);
    expect(upRem.body.meta.reminderHighlights.upcoming).toBe(ids(upRem).length);
    const upBlocked = await get(
      tw.owner,
      '/tasks?filter=upcoming&kind=reminder&status=BLOCKED',
    );
    expect(ids(upBlocked)).toEqual([blocked.id]);
    const upDone = await get(
      tw.owner,
      '/tasks?filter=upcoming&status=COMPLETED',
    );
    expect(ids(upDone)).toEqual([]);

    // ordering + cursor: desc newest-due first, asc reverses
    const desc = await get(
      tw.owner,
      '/tasks?filter=upcoming&sortOrder=desc&limit=2',
    ).expect(200);
    const asc = await get(
      tw.owner,
      '/tasks?filter=upcoming&sortOrder=asc&limit=100',
    ).expect(200);
    const dues = (r: request.Response) =>
      (r.body.data as { due_at?: string; dueAt?: string }[]).map((t) =>
        new Date((t.due_at ?? t.dueAt) as string).getTime(),
      );
    const d = dues(desc);
    expect(d[0]).toBeGreaterThanOrEqual(d[1]);
    const a = dues(asc);
    expect([...a].sort((x, y) => x - y)).toEqual(a);
    const next = await get(
      tw.owner,
      `/tasks?filter=upcoming&sortOrder=desc&limit=2&cursor=${encodeURIComponent(desc.body.meta.endCursor)}`,
    ).expect(200);
    expect(dues(next)[0]).toBeLessThanOrEqual(d[1]);

    await get(tw.owner, '/tasks?filter=bogus').expect(400);
  });

  it('dueFrom/dueTo intersect with filter=upcoming|overdue instead of overwriting it', async () => {
    const H = 3_600_000;
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    const mkR = (name: string, offset: number) =>
      mk({ name, kind: 'REMINDER', dueAt: new Date(now + offset) });
    const f1 = await mkR('rng-f1', 1 * H);
    const f2 = await mkR('rng-f2', 5 * H);
    const p1 = await mkR('rng-p1', -1 * H);
    const p2 = await mkR('rng-p2', -5 * H);
    const q = (extra: string) => `/tasks?kind=reminder&limit=100&${extra}`;
    const list = async (extra: string) =>
      ids(await get(tw.owner, q(extra)).expect(200)).sort();

    // upcoming + dueTo: only future items before the bound (no overdue leakage)
    expect(
      await list(
        `filter=upcoming&dueTo=${encodeURIComponent(iso(now + 3 * H))}`,
      ),
    ).toEqual([f1.id]);
    // overdue + dueFrom: only past items after the bound (no future leakage)
    expect(
      await list(
        `filter=overdue&dueFrom=${encodeURIComponent(iso(now - 3 * H))}`,
      ),
    ).toEqual([p1.id]);
    // upcoming + a window that is entirely in the past -> empty
    expect(
      await list(
        `filter=upcoming&dueFrom=${encodeURIComponent(iso(now - 6 * H))}&dueTo=${encodeURIComponent(iso(now - 30 * 60_000))}`,
      ),
    ).toEqual([]);
    // overdue + a window entirely in the future -> empty
    expect(
      await list(
        `filter=overdue&dueFrom=${encodeURIComponent(iso(now + 30 * 60_000))}&dueTo=${encodeURIComponent(iso(now + 6 * H))}`,
      ),
    ).toEqual([]);

    // partition with the same wide range stays disjoint and complete for the window
    const range = `dueFrom=${encodeURIComponent(iso(now - 6 * H))}&dueTo=${encodeURIComponent(iso(now + 6 * H))}`;
    const up = await list(`filter=upcoming&${range}`);
    const over = await list(`filter=overdue&${range}`);
    expect(up).toEqual([f1.id, f2.id].sort());
    expect(over).toEqual([p1.id, p2.id].sort());
    expect(up.filter((i) => over.includes(i))).toEqual([]);
    // no filter + range still works on its own
    expect(await list(range)).toEqual([f1.id, f2.id, p1.id, p2.id].sort());
  });

  it('counters are first-page only; later pages omit them', async () => {
    const first = await get(tw.owner, '/tasks?limit=2').expect(200);
    expect(first.body.meta.highlights).toBeDefined();
    expect(first.body.meta.reminderHighlights).toBeDefined();
    const cursor = first.body.meta.endCursor as string;
    expect(cursor).toBeTruthy();
    const second = await get(
      tw.owner,
      `/tasks?limit=2&cursor=${encodeURIComponent(cursor)}`,
    ).expect(200);
    expect(second.body.meta.highlights).toBeUndefined();
    expect(second.body.meta.reminderHighlights).toBeUndefined();
  });

  it('reminderHighlights are scoped to the caller farm', async () => {
    const mine = (await get(tw.owner, '/tasks').expect(200)).body.meta
      .reminderHighlights;
    const rem = await mk({
      name: 'isolation',
      kind: 'REMINDER',
      dueAt: new Date(Date.now() + 3 * DAY),
    });
    const otherBefore = (await get(other, '/tasks').expect(200)).body.meta
      .reminderHighlights;
    const mineAfter = (await get(tw.owner, '/tasks').expect(200)).body.meta
      .reminderHighlights;
    expect(mineAfter.upcoming).toBe(mine.upcoming + 1);
    // the demo farm's count is unaffected by the new throwaway-farm reminder
    const otherCount = await prisma.task.count({
      where: {
        farmId: other.farmId,
        kind: 'REMINDER',
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        dueAt: { gte: new Date() },
      },
    });
    expect(Math.abs(otherBefore.upcoming - otherCount)).toBeLessThanOrEqual(0);
    await prisma.task.delete({ where: { id: rem.id } });
  });

  it('PATCH cannot change kind or set category REMINDER; create rejects TASK + REMINDER category', async () => {
    const rem = await mk({
      name: 'patch-me',
      kind: 'REMINDER',
      category: 'BREEDING',
      dueAt: new Date(Date.now() + DAY),
    });
    // kind is not an updatable field (whitelist/forbidNonWhitelisted -> 400)
    await send('patch', tw.owner, `/tasks/${rem.id}`, { kind: 'TASK' }).expect(
      400,
    );
    await send('patch', tw.owner, `/tasks/${rem.id}`, {
      category: 'REMINDER',
    }).expect(400);
    const row = await prisma.task.findUniqueOrThrow({ where: { id: rem.id } });
    expect(row.kind).toBe('REMINDER');
    expect(row.category).toBe('BREEDING'); // stored topic untouched

    await send('post', tw.owner, '/tasks', {
      name: 'conflict',
      kind: 'TASK',
      category: 'REMINDER',
      dueAt: new Date(Date.now() + DAY),
    }).expect(400);
  });

  it('a spawned next occurrence keeps kind REMINDER', async () => {
    const rem = await mk({
      name: 'spawner',
      kind: 'REMINDER',
      dueAt: new Date(),
      recurring: true,
      recurrenceType: 'DAILY',
    });
    await ctx.app.get(FollowUpReminderService).sweepAll();
    const next = await prisma.task.findMany({
      where: { farmId: tw.farmId, name: 'spawner', id: { not: rem.id } },
    });
    expect(next).toHaveLength(1);
    expect(next[0].kind).toBe('REMINDER');
  });

  it('dashboard task counts exclude reminders', async () => {
    const todayBefore = (await get(tw.owner, '/dashboard/upcoming-tasks')).body
      .data;
    await mk({ name: 'dash-reminder', kind: 'REMINDER', dueAt: new Date() });
    const afterReminder = (await get(tw.owner, '/dashboard/upcoming-tasks'))
      .body.data;
    expect(afterReminder.totalToday).toBe(todayBefore.totalToday);
    await mk({ name: 'dash-task', dueAt: new Date() });
    const afterTask = (await get(tw.owner, '/dashboard/upcoming-tasks')).body
      .data;
    expect(afterTask.totalToday).toBe(todayBefore.totalToday + 1);
  });
});

import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  TestContext,
  ThrowawayOwner,
} from './utils/e2e';

/**
 * Task list filters + counters: server-side `status` / `recurring` filters, `filter=upcoming|overdue`
 * partition, `dueFrom`/`dueTo` intersection and first-page-only counters. Runs in a throwaway farm so every
 * count is exact. Ported from the RAKHAL-491 `task-kind` spec in RAKHAL-499: the REMINDER-kind cases
 * (kind filter, reminderHighlights, kind guards, spawned next occurrence, dashboard exclusion) were deleted
 * with the reminder system.
 */
describe('Task list filters + counters', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let tw: ThrowawayOwner;
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
      category: string;
    };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    tw = await createThrowawayOwner(ctx, prisma, `Task filters ${Date.now()}`);
  }, 60_000);

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { farmId: tw.farmId } });
    await deleteThrowawayOwner(prisma, tw);
    await ctx.app.close();
  });

  it('status + recurring filters are exact and combine; invalid status is 400', async () => {
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
      dueAt: new Date(Date.now() + 2 * DAY),
      recurring: true,
      recurrenceType: 'DAILY',
    });
    const oneOff = await mk({
      name: 'oneoff',
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
    const notRec = await get(
      tw.owner,
      '/tasks?status=PENDING,IN_PROGRESS&recurring=false',
    );
    expect(ids(notRec).sort()).toEqual([plain.id, oneOff.id].sort());
    // combined with another filter (overdue) and status
    const both = await get(tw.owner, '/tasks?filter=overdue&status=PENDING');
    expect(ids(both)).toEqual([oneOff.id]);

    await get(tw.owner, '/tasks?status=COMPLETED,BOGUS').expect(400);
    await get(tw.owner, '/tasks?recurring=maybe').expect(400);

    // exact counters (the throwaway farm started empty)
    const after = (await get(tw.owner, '/tasks').expect(200)).body.meta;
    expect(after.highlights.overdue).toBe(1);
  });

  it('filter=upcoming partitions open items exactly with overdue; combines with status; desc order; bad value 400', async () => {
    const blocked = await mk({
      name: 'blocked-future',
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

    // status combos
    const upBlocked = await get(
      tw.owner,
      '/tasks?filter=upcoming&status=BLOCKED',
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
    await prisma.task.deleteMany({ where: { farmId: tw.farmId } });
    const H = 3_600_000;
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    const mkR = (name: string, offset: number) =>
      mk({ name, dueAt: new Date(now + offset) });
    const f1 = await mkR('rng-f1', 1 * H);
    const f2 = await mkR('rng-f2', 5 * H);
    const p1 = await mkR('rng-p1', -1 * H);
    const p2 = await mkR('rng-p2', -5 * H);
    const q = (extra: string) => `/tasks?limit=100&${extra}`;
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
    const cursor = first.body.meta.endCursor as string;
    expect(cursor).toBeTruthy();
    const second = await get(
      tw.owner,
      `/tasks?limit=2&cursor=${encodeURIComponent(cursor)}`,
    ).expect(200);
    expect(second.body.meta.highlights).toBeUndefined();
  });
});

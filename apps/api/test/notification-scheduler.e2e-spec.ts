import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { OccurrenceProcessor } from '../src/modules/notification/application/queue/occurrence.processor';
import {
  SourceResolution,
  SourceResolver,
} from '../src/modules/notification/application/resolvers/source-resolver.port';
import { SourceResolverRegistry } from '../src/modules/notification/application/resolvers/source-resolver.registry';
import { NotificationScheduler } from '../src/modules/notification/application/services/notification-scheduler.service';
import { allDayAnchorFromYmd } from '../src/modules/notification/domain/schedule-math';
import {
  createNotificationV2Harness,
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  type NotificationV2Harness,
  type TestContext,
  type ThrowawayOwner,
} from './utils/e2e';

/**
 * RAKHAL-493 (NV2-B02): scheduler + worker + reconcile against the real DB with an in-memory queue and a fake clock.
 * Farm timezone is Asia/Dhaka (UTC+6): 08:00 farm-local = 02:00Z (+0..179 s SYSTEM jitter).
 */
describe('Notifications v2 scheduler (RAKHAL-493)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let h: NotificationV2Harness;
  let scheduler: NotificationScheduler;
  let processor: OccurrenceProcessor;
  let registry: SourceResolverRegistry;
  let owner: ThrowawayOwner;
  let farmId: string;
  let secondUserId: string;

  const sources = new Map<string, SourceResolution>();
  const okSource = (userIds: string[] = []): SourceResolution => ({
    state: 'OK',
    userIds,
    params: { label: 'Pregnancy check', animals: 2, date: '2026-11-12' },
    title: 'Pregnancy check',
    message: '2 animals',
  });
  const resolver: SourceResolver = {
    sourceType: 'TASK',
    resolve: (c) =>
      Promise.resolve(sources.get(c.sourceKey) ?? { state: 'GONE' as const }),
  };

  let keySeq = 0;
  const nextKey = () => `id:e2e-${Date.now()}-${keySeq++}`;
  const runDue = () =>
    h.queue.runDue(h.clock.now(), async (id) => {
      await processor.process(id);
    });
  const at = (iso: string) => h.clock.set(new Date(iso));
  const occurrencesOf = (scheduleId: string) =>
    prisma.notificationOccurrence.findMany({
      where: { scheduleId },
      orderBy: [{ anchorAt: 'asc' }, { leadMinutes: 'desc' }],
    });
  const deliveredTo = (occurrenceId: string) =>
    prisma.notification.findMany({
      where: { farmId, dedupeKey: `occurrence:${occurrenceId}` },
    });

  /** System schedule due on 2026-11-12 (all day) with the given leads. */
  async function upsert(key: string, leadMinutes: number[]) {
    const res = await scheduler.upsertForSource({
      farmId,
      sourceType: 'TASK',
      sourceKey: key,
      anchorAt: allDayAnchorFromYmd('2026-11-12'),
      allDay: true,
      leadMinutes,
      eventKey: 'scheduled_upcoming',
      category: 'operational',
      priority: 'medium',
    });
    if (!res) throw new Error('upsert returned null');
    return res;
  }

  beforeAll(async () => {
    h = createNotificationV2Harness(new Date('2026-11-10T00:00:00Z'));
    ctx = await createTestApp({ configure: h.configure });
    prisma = ctx.app.get(PrismaService);
    scheduler = ctx.app.get(NotificationScheduler);
    processor = ctx.app.get(OccurrenceProcessor);
    registry = ctx.app.get(SourceResolverRegistry);
    registry.register(resolver);

    owner = await createThrowawayOwner(ctx, prisma, 'NV2 scheduler e2e farm');
    farmId = owner.farmId;
    const ownerMember = await prisma.farmMember.findFirstOrThrow({
      where: { farmId, userId: owner.userId },
    });
    const second = await prisma.user.create({
      data: {
        email: `e2e-nv2-${Date.now()}@rakhal.test`,
        name: 'NV2 Second',
        passwordHash: 'x',
      },
    });
    secondUserId = second.id;
    await prisma.farmMember.create({
      data: { farmId, userId: second.id, roleId: ownerMember.roleId },
    });
  });

  afterAll(async () => {
    await prisma.notificationSchedule.deleteMany({ where: { farmId } });
    await prisma.notification.deleteMany({ where: { farmId } });
    await prisma.farmMember.deleteMany({ where: { userId: secondUserId } });
    await prisma.user.delete({ where: { id: secondUserId } }).catch(() => {});
    await deleteThrowawayOwner(prisma, owner);
    await ctx.app.close();
  });

  beforeEach(() => {
    h.queue.flush();
    at('2026-11-10T00:00:00Z');
  });

  it('upsert is idempotent, only occurrences within 48 h get a job, and the first lead fires', async () => {
    const key = nextKey();
    sources.set(key, okSource());
    const first = await upsert(key, [1440, 0]);
    expect(first.toEnqueue).toHaveLength(2);
    await scheduler.enqueueAfterCommit(first.toEnqueue);
    // lead 1440 fires ~26 h ahead (queued); lead 0 fires ~50 h ahead (stays in Postgres only).
    expect(h.queue.size).toBe(1);

    const again = await upsert(key, [1440, 0]);
    expect(again.scheduleId).toBe(first.scheduleId);
    expect(again.toEnqueue).toHaveLength(0);
    expect(await occurrencesOf(first.scheduleId)).toHaveLength(2);

    at('2026-11-11T02:10:00Z');
    expect(await runDue()).toHaveLength(1);
    const [upcoming, due] = await occurrencesOf(first.scheduleId);
    expect(upcoming.status).toBe('FIRED');
    expect(due.status).toBe('SCHEDULED');
    expect(await deliveredTo(upcoming.id)).toHaveLength(2); // one per Owner member (dedupe is per user)

    // The second occurrence is now within 48 h: the reconcile enqueues it, then it fires and the schedule is DONE.
    const rec = await scheduler.reconcile(h.clock.now());
    // >= 1: the reconcile is global, so occurrences other specs left near this clock may be enqueued too.
    expect(rec.enqueued).toBeGreaterThanOrEqual(1);
    at('2026-11-12T02:10:00Z');
    await runDue();
    expect((await occurrencesOf(first.scheduleId))[1].status).toBe('FIRED');
    const s = await prisma.notificationSchedule.findUniqueOrThrow({
      where: { id: first.scheduleId },
    });
    expect(s.status).toBe('DONE');
  });

  it('late rule: 90 minutes late fires, 3 hours late is skipped (LATE) with no notification', async () => {
    const onTime = nextKey();
    const tooLate = nextKey();
    sources.set(onTime, okSource());
    sources.set(tooLate, okSource());
    const a = await upsert(onTime, [0]);
    const b = await upsert(tooLate, [0]);

    // fireAt is 11-12T02:00Z..02:03Z; the two cases are checked on separate clocks.
    at('2026-11-12T03:30:00Z');
    await scheduler.enqueueAfterCommit(a.toEnqueue);
    await runDue();
    const [fired] = await occurrencesOf(a.scheduleId);
    expect(fired.status).toBe('FIRED');

    at('2026-11-12T05:10:00Z');
    await scheduler.enqueueAfterCommit(b.toEnqueue);
    await runDue();
    const [skipped] = await occurrencesOf(b.scheduleId);
    expect(skipped.status).toBe('SKIPPED');
    expect(skipped.reason).toBe('LATE');
    expect(await deliveredTo(skipped.id)).toHaveLength(0);
  });

  it('cancels with SOURCE_GONE when the source finished before the fire time', async () => {
    const key = nextKey();
    sources.set(key, okSource());
    const w = await upsert(key, [0]);
    sources.set(key, { state: 'GONE' });
    at('2026-11-12T02:10:00Z');
    await scheduler.enqueueAfterCommit(w.toEnqueue);
    await runDue();
    const [occ] = await occurrencesOf(w.scheduleId);
    expect(occ.status).toBe('CANCELLED');
    expect(occ.reason).toBe('SOURCE_GONE');
    expect(await deliveredTo(occ.id)).toHaveLength(0);
  });

  it('re-resolves recipients at fire time: a deactivated user gets nothing', async () => {
    const key = nextKey();
    sources.set(key, okSource([secondUserId]));
    const w = await upsert(key, [0]);
    await prisma.user.update({
      where: { id: secondUserId },
      data: { deletedAt: new Date() },
    });
    try {
      at('2026-11-12T02:10:00Z');
      await scheduler.enqueueAfterCommit(w.toEnqueue);
      await runDue();
      const [occ] = await occurrencesOf(w.scheduleId);
      expect(occ.status).toBe('FIRED');
      const got = await deliveredTo(occ.id);
      expect(got.map((n) => n.userId)).toEqual([owner.userId]);
    } finally {
      await prisma.user.update({
        where: { id: secondUserId },
        data: { deletedAt: null },
      });
    }
  });

  it('repeat advances only when the current anchor finishes; re-running a processed id is a no-op', async () => {
    const created = await scheduler.createManual(farmId, owner.userId, {
      title: 'Check the fence',
      body: 'North paddock',
      trigger: 'DATE',
      baseAnchorAt: new Date('2026-11-11T04:00:00Z'),
      allDay: false,
      leadMinutes: [0],
      repeat: 'WEEKLY',
      audienceMode: 'USER',
      audienceUserIds: [owner.userId],
    });
    let occs = await occurrencesOf(created.id);
    expect(occs).toHaveLength(1);
    expect(created.seriesIndex).toBe(0);

    at('2026-11-11T04:00:30Z');
    expect(await runDue()).toHaveLength(1);
    occs = await occurrencesOf(created.id);
    expect(occs.map((o) => o.status)).toEqual(['FIRED', 'SCHEDULED']);
    expect(occs[1].anchorAt.toISOString()).toBe('2026-11-18T04:00:00.000Z');
    const advanced = await prisma.notificationSchedule.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(advanced.seriesIndex).toBe(1);

    const delivered = await deliveredTo(occs[0].id);
    expect(delivered).toHaveLength(1);
    expect(delivered[0].eventKey).toBe('custom_reminder');
    expect(delivered[0].title).toContain('Check the fence');

    // Idempotent re-run: a second pass over the same id changes nothing.
    expect(await processor.process(occs[0].id)).toEqual({
      outcome: 'ignored',
    });
    // Simulated crash between notify and the FIRED mark: delivery dedupes, the occurrence ends FIRED once more.
    await prisma.notificationOccurrence.update({
      where: { id: occs[0].id },
      data: { status: 'SCHEDULED', firedAt: null },
    });
    await processor.process(occs[0].id);
    expect(await deliveredTo(occs[0].id)).toHaveLength(1);
    expect(await occurrencesOf(created.id)).toHaveLength(2);
  });

  it('pause cancels pending occurrences and resume recomputes from now', async () => {
    const created = await scheduler.createManual(farmId, owner.userId, {
      title: 'Pause me',
      trigger: 'DATE',
      baseAnchorAt: new Date('2026-11-11T04:00:00Z'),
      allDay: false,
      leadMinutes: [0],
      audienceMode: 'USER',
      audienceUserIds: [owner.userId],
    });
    await scheduler.pause(farmId, created.id);
    expect((await occurrencesOf(created.id))[0].status).toBe('CANCELLED');
    expect(h.queue.size).toBe(0);
    await scheduler.resume(farmId, created.id);
    expect((await occurrencesOf(created.id))[0].status).toBe('SCHEDULED');
    expect(h.queue.size).toBe(1);
  });

  it('createManual rejects a schedule that can never fire (422)', async () => {
    await expect(
      scheduler.createManual(farmId, owner.userId, {
        title: 'Past',
        trigger: 'DATE',
        baseAnchorAt: new Date('2026-11-01T04:00:00Z'),
        allDay: false,
        leadMinutes: [0],
        audienceMode: 'USER',
        audienceUserIds: [owner.userId],
      }),
    ).rejects.toThrow('NO_FUTURE_OCCURRENCE');
  });

  describe('reconcile (§3.6)', () => {
    it('enqueues a job-less occurrence (missing), including after a Redis flush', async () => {
      const key = nextKey();
      sources.set(key, okSource());
      const w = await upsert(key, [0]);
      at('2026-11-11T12:00:00Z'); // fireAt (11-12T02:00Z) is now within 48 h
      // No enqueueAfterCommit: simulates a crash between commit and queue.add.
      expect(h.queue.has(w.toEnqueue[0])).toBe(false);
      const first = await scheduler.reconcile(h.clock.now());
      expect(first.enqueued).toBeGreaterThanOrEqual(1);
      expect(h.queue.has(w.toEnqueue[0])).toBe(true);

      h.queue.flush();
      const second = await scheduler.reconcile(h.clock.now());
      expect(second.enqueued).toBeGreaterThanOrEqual(1);
      expect(h.queue.has(w.toEnqueue[0])).toBe(true);
      // Steady state: nothing left to repair for this occurrence.
      const third = await scheduler.reconcile(h.clock.now());
      expect(third.enqueued).toBe(0);
    });

    it('removes orphan jobs (occurrence not SCHEDULED, or gone)', async () => {
      const key = nextKey();
      sources.set(key, okSource());
      const w = await upsert(key, [0]);
      await prisma.notificationOccurrence.update({
        where: { id: w.toEnqueue[0] },
        data: { status: 'CANCELLED', reason: 'EDITED' },
      });
      await h.queue.add(w.toEnqueue[0], 1000);
      await h.queue.add('ghost-occurrence-id', 1000);
      const res = await scheduler.reconcile(h.clock.now());
      expect(res.removed).toBeGreaterThanOrEqual(2);
      expect(h.queue.has(w.toEnqueue[0])).toBe(false);
      expect(h.queue.has('ghost-occurrence-id')).toBe(false);
    });

    it('advances a stalled repeating series that lost its next occurrence', async () => {
      const created = await scheduler.createManual(farmId, owner.userId, {
        title: 'Stalled',
        trigger: 'DATE',
        baseAnchorAt: new Date('2026-11-12T04:00:00Z'),
        allDay: false,
        leadMinutes: [0],
        repeat: 'WEEKLY',
        audienceMode: 'USER',
        audienceUserIds: [owner.userId],
      });
      // Drop the only pending occurrence behind the engine's back.
      await prisma.notificationOccurrence.deleteMany({
        where: { scheduleId: created.id },
      });
      const res = await scheduler.reconcile(h.clock.now());
      expect(res.advanced).toBeGreaterThanOrEqual(1);
      const occs = await occurrencesOf(created.id);
      expect(occs).toHaveLength(1);
      expect(occs[0].status).toBe('SCHEDULED');
      expect(occs[0].anchorAt.toISOString()).toBe('2026-11-19T04:00:00.000Z');
    });
  });
});

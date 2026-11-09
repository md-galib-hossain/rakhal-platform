import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { OccurrenceProcessor } from '../src/modules/notification/application/queue/occurrence.processor';
import { NotificationScheduler } from '../src/modules/notification/application/services/notification-scheduler.service';
import { TaskNotificationProducer } from '../src/modules/task/application/resolvers/task-notification.producer';
import { TaskService } from '../src/modules/task/application/services/task.service';
import {
  bearer,
  createNotificationV2Harness,
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  type NotificationV2Harness,
  type TestContext,
  type ThrowawayOwner,
} from './utils/e2e';

/**
 * RAKHAL-496 (NV2-B04): Task -> NotificationScheduler producer + TaskSourceResolver, real DB, in-memory queue, fake clock.
 * Farm timezone Asia/Dhaka (UTC+6). Today is 2026-11-10; tasks are due 2026-11-13.
 */
describe('Notifications v2 task producer (RAKHAL-496)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let h: NotificationV2Harness;
  let tasks: TaskService;
  let producer: TaskNotificationProducer;
  let processor: OccurrenceProcessor;
  let scheduler: NotificationScheduler;
  let owner: ThrowawayOwner;
  let farmId: string;
  let secondUserId: string;
  const cattleIds: string[] = [];

  const DUE = '2026-11-13T04:00:00Z'; // farm-local 2026-11-13 10:00
  const RULE = 'BREEDING_TO_PREG_CHECK';
  const http = () => request(ctx.app.getHttpServer());

  const schedulesOf = (sourceKey?: string) =>
    prisma.notificationSchedule.findMany({
      where: {
        farmId,
        sourceType: 'TASK',
        ...(sourceKey ? { sourceKey } : {}),
      },
      include: { occurrences: { orderBy: { leadMinutes: 'desc' } } },
    });
  const pending = (s: { occurrences: { status: string }[] }) =>
    s.occurrences.filter((o) => o.status === 'SCHEDULED');

  async function createTask(body: Record<string, unknown>): Promise<string> {
    const res = await http()
      .post(`${ctx.prefix}/tasks`)
      .set(...bearer(owner.owner))
      .send({ name: 'Check fence', category: 'GENERAL', dueAt: DUE, ...body });
    expect(res.status).toBe(201);
    return (res.body as { data: { id: string } }).data.id;
  }
  const act = (id: string, path: string, body: object = {}) =>
    http()
      .post(`${ctx.prefix}/tasks/${id}/${path}`)
      .set(...bearer(owner.owner))
      .send(body);

  function ruleTask(cattleId: string, skipNotify = false) {
    return tasks.createInternal({
      farmId,
      createdBy: owner.userId,
      name: 'Pregnancy check',
      category: 'BREEDING',
      dueAt: new Date(DUE),
      source: 'SYSTEM_AUTO',
      relatedCattleId: cattleId,
      ruleKey: RULE,
      sourceEventType: 'ANIMAL_EVENT',
      sourceEventId: `ev-${cattleId}`,
      followUpKey: `${RULE}:ev-${cattleId}`,
      skipNotify,
    });
  }

  beforeAll(async () => {
    h = createNotificationV2Harness(new Date('2026-11-10T00:00:00Z'));
    ctx = await createTestApp({ configure: h.configure });
    prisma = ctx.app.get(PrismaService);
    tasks = ctx.app.get(TaskService);
    producer = ctx.app.get(TaskNotificationProducer);
    processor = ctx.app.get(OccurrenceProcessor);
    scheduler = ctx.app.get(NotificationScheduler);

    owner = await createThrowawayOwner(ctx, prisma, 'NV2 task producer farm');
    farmId = owner.farmId;
    const ownerMember = await prisma.farmMember.findFirstOrThrow({
      where: { farmId, userId: owner.userId },
    });
    const second = await prisma.user.create({
      data: {
        email: `e2e-nv2-task-${Date.now()}@rakhal.test`,
        name: 'NV2 Assignee',
        passwordHash: 'x',
      },
    });
    secondUserId = second.id;
    await prisma.farmMember.create({
      data: { farmId, userId: second.id, roleId: ownerMember.roleId },
    });
    for (let i = 0; i < 3; i++) {
      const c = await prisma.cattle.create({
        data: {
          farm: { connect: { id: farmId } },
          creator: { connect: { id: owner.userId } },
          tagNumber: `NV2-${Date.now()}-${i}`,
          gender: 'FEMALE',
          herdStatus: 'ACTIVE',
        },
      });
      cattleIds.push(c.id);
    }
  });

  afterAll(async () => {
    await prisma.notificationSchedule.deleteMany({ where: { farmId } });
    await prisma.notification.deleteMany({ where: { farmId } });
    await prisma.task.deleteMany({ where: { farmId } });
    await prisma.cattle.deleteMany({ where: { farmId } });
    await prisma.farmMember.deleteMany({ where: { userId: secondUserId } });
    await prisma.user.delete({ where: { id: secondUserId } }).catch(() => {});
    await deleteThrowawayOwner(prisma, owner);
    await ctx.app.close();
  });

  beforeEach(async () => {
    h.queue.flush();
    h.clock.set(new Date('2026-11-10T00:00:00Z'));
    await prisma.notificationSchedule.deleteMany({ where: { farmId } });
    await prisma.task.deleteMany({ where: { farmId } });
  });

  it('a plain task gets one schedule with lead [1 day]', async () => {
    const id = await createTask({});
    const [s] = await schedulesOf(`id:${id}`);
    expect(s).toBeDefined();
    expect(s.leadMinutes).toEqual([1440]);
    expect(s.allDay).toBe(true);
    expect(s.anchorAt.toISOString()).toBe('2026-11-13T00:00:00.000Z');
    expect(pending(s)).toHaveLength(1);
  });

  it('a HIGH priority task gets [1 day, 0]', async () => {
    const id = await createTask({ priority: 'HIGH' });
    const [s] = await schedulesOf(`id:${id}`);
    expect(s.leadMinutes).toEqual([1440, 0]);
    expect(pending(s)).toHaveLength(2);
  });

  it('GET /notifications/upcoming titles each occurrence from its OWN lead (1-day lead is not "Due today")', async () => {
    await createTask({ priority: 'HIGH', name: 'Vaccinate' });
    const res = await http()
      .get(
        `${ctx.prefix}/notifications/upcoming?from=2026-11-10&to=2026-11-14&sortOrder=asc&limit=50`,
      )
      .set(...bearer(owner.owner))
      .expect(200);
    const rows = (res.body.data as { title: string }[]).filter((r) =>
      r.title.includes('Vaccinate'),
    );
    expect(rows).toHaveLength(2);
    const [dayBefore, dayOf] = rows; // asc by fire time
    expect(dayBefore.title).toBe('Coming up in 1 day(s): Vaccinate');
    expect(dayOf.title).toBe('Due today: Vaccinate');
  });

  it('rule tasks of one (rule, due day) collapse to ONE schedule and one notice', async () => {
    for (const c of cattleIds) await ruleTask(c);
    const all = await schedulesOf();
    expect(all).toHaveLength(1);
    expect(all[0].sourceKey).toBe(`rule:${RULE}:2026-11-13`);
    expect(all[0].leadMinutes).toEqual([1440, 0]);

    // The day-before notice is ~50 h out: beyond the 48 h queue horizon, so the reconcile enqueues it once it is near.
    h.clock.set(new Date('2026-11-11T12:00:00Z'));
    await scheduler.reconcile(h.clock.now());
    // Day before at 08:00 farm-local (02:00Z) + up to 3 min jitter.
    h.clock.set(new Date('2026-11-12T02:10:00Z'));
    await h.queue.runDue(h.clock.now(), (id) => processor.process(id));
    const sent = await prisma.notification.findMany({
      where: { farmId, eventKey: 'scheduled_upcoming' },
    });
    expect(sent.length).toBeGreaterThan(0);
    expect(new Set(sent.map((n) => n.dedupeKey)).size).toBe(1);
  });

  it('skipNotify + syncByIds batches a bulk into one schedule', async () => {
    for (const c of cattleIds) await ruleTask(c, true);
    expect(await schedulesOf()).toHaveLength(0);
    const rows = await prisma.task.findMany({ where: { farmId } });
    await producer.syncByIds(
      farmId,
      rows.map((r) => r.id),
    );
    expect(await schedulesOf()).toHaveLength(1);
  });

  it('completing the last open member cancels the group; reopening revives it', async () => {
    const a = await ruleTask(cattleIds[0]);
    const b = await ruleTask(cattleIds[1]);
    await act(a.id, 'complete');
    let [s] = await schedulesOf();
    expect(s.status).toBe('ACTIVE');
    expect(pending(s)).toHaveLength(2);

    await act(b.id, 'complete');
    [s] = await schedulesOf();
    expect(s.status).toBe('CANCELLED');
    expect(pending(s)).toHaveLength(0);

    await act(b.id, 'reopen');
    [s] = await schedulesOf();
    expect(s.status).toBe('ACTIVE');
    expect(pending(s)).toHaveLength(2);
  });

  it('cancel and delete empty the plain task schedule', async () => {
    const id = await createTask({});
    await act(id, 'cancel', { notes: 'no' });
    let [s] = await schedulesOf(`id:${id}`);
    expect(pending(s)).toHaveLength(0);

    const id2 = await createTask({});
    await http()
      .delete(`${ctx.prefix}/tasks/${id2}`)
      .set(...bearer(owner.owner))
      .expect(200);
    [s] = await schedulesOf(`id:${id2}`);
    expect(s.status).toBe('CANCELLED');
    expect(pending(s)).toHaveLength(0);
  });

  it('an assignee change updates the audience hint; a due-day change moves the rule group', async () => {
    const id = await createTask({});
    await http()
      .patch(`${ctx.prefix}/tasks/${id}`)
      .set(...bearer(owner.owner))
      .send({ assignedToId: secondUserId })
      .expect(200);
    const [s] = await schedulesOf(`id:${id}`);
    expect(s.audienceUserIds).toEqual([secondUserId]);

    const t = await ruleTask(cattleIds[0]);
    await http()
      .patch(`${ctx.prefix}/tasks/${t.id}`)
      .set(...bearer(owner.owner))
      .send({ dueAt: '2026-11-15T04:00:00Z' })
      .expect(200);
    const byKey = new Map(
      (await schedulesOf()).map((r) => [r.sourceKey, r] as const),
    );
    expect(byKey.get(`rule:${RULE}:2026-11-13`)?.status).toBe('CANCELLED');
    expect(byKey.get(`rule:${RULE}:2026-11-15`)?.status).toBe('ACTIVE');
  });

  it('a single-animal rule task notice deep-links to that animal with the event type to record (ported)', async () => {
    const t = await ruleTask(cattleIds[0]);
    h.clock.set(new Date('2026-11-12T01:00:00Z'));
    await scheduler.reconcile(h.clock.now());
    h.clock.set(new Date('2026-11-13T02:10:00Z'));
    await h.queue.runDue(h.clock.now(), (id) => processor.process(id));
    const note = await prisma.notification.findFirstOrThrow({
      where: { farmId, eventKey: 'scheduled_due' },
    });
    expect(note.link?.startsWith(`/animals?view=${cattleIds[0]}&record=`)).toBe(
      true,
    );
    expect(note.link).not.toContain('reminder=');
    expect(t.id).toBeDefined();
  });

  it('a rule task for an animal that left the herd sends nothing (ported)', async () => {
    const gone = await prisma.cattle.create({
      data: {
        farm: { connect: { id: farmId } },
        creator: { connect: { id: owner.userId } },
        tagNumber: `NV2-GONE-${Date.now()}`,
        gender: 'FEMALE',
        herdStatus: 'ACTIVE',
      },
    });
    cattleIds.push(gone.id);
    await prisma.notification.deleteMany({ where: { farmId } });
    await ruleTask(gone.id);
    await prisma.cattle.update({
      where: { id: gone.id },
      data: { herdStatus: 'SOLD' },
    });
    h.clock.set(new Date('2026-11-12T01:00:00Z'));
    await scheduler.reconcile(h.clock.now());
    h.clock.set(new Date('2026-11-13T02:10:00Z'));
    await h.queue.runDue(h.clock.now(), (id) => processor.process(id));
    expect(
      await prisma.notification.count({
        where: {
          farmId,
          eventKey: { in: ['scheduled_due', 'scheduled_upcoming'] },
        },
      }),
    ).toBe(0);
  });
});

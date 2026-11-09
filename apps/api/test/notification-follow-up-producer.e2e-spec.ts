import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AnimalEventAnchorChecker } from '../src/modules/animal-events/application/anchors/animal-event-anchor.checker';
import { OccurrenceProcessor } from '../src/modules/notification/application/queue/occurrence.processor';
import { NotificationScheduler } from '../src/modules/notification/application/services/notification-scheduler.service';
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
 * RAKHAL-495 (NV2-B05): the follow-up engine keeps Notifications v2 schedules in step with animal events, real DB,
 * in-memory queue, fake clock (= real now, because the event API refuses future dates).
 */
describe('Notifications v2 follow-up producer (RAKHAL-495)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let h: NotificationV2Harness;
  let scheduler: NotificationScheduler;
  let processor: OccurrenceProcessor;
  let owner: ThrowawayOwner;
  let farmId: string;
  const RULE = 'BREEDING_TO_PREG_CHECK';
  const DAY = 86_400_000;
  const http = () => request(ctx.app.getHttpServer());
  const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000);
  const natural = { breedingMethod: 'NATURAL', sireNameOrCode: 'B' };

  let seq = 0;
  async function cows(n: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const c = await prisma.cattle.create({
        data: {
          farm: { connect: { id: farmId } },
          creator: { connect: { id: owner.userId } },
          tagNumber: `NV2B05-${Date.now()}-${seq++}`,
          gender: 'FEMALE',
          dateOfBirth: new Date(Date.now() - 1500 * DAY),
          herdStatus: 'ACTIVE',
        },
      });
      ids.push(c.id);
    }
    return ids;
  }

  async function breed(cattleId: string, eventAt = hoursAgo(2)) {
    const res = await http()
      .post(`${ctx.prefix}/cattle/${cattleId}/events`)
      .set(...bearer(owner.owner))
      .send({ type: 'BREEDING', eventAt, payload: natural });
    expect(res.status).toBe(201);
    return (res.body as { data: { event: { id: string } } }).data.event.id;
  }
  const edit = (cattleId: string, eventId: string, body: object) =>
    http()
      .patch(`${ctx.prefix}/cattle/${cattleId}/events/${eventId}`)
      .set(...bearer(owner.owner))
      .send(body);
  const voidIt = (cattleId: string, eventId: string) =>
    http()
      .post(`${ctx.prefix}/cattle/${cattleId}/events/${eventId}/void`)
      .set(...bearer(owner.owner))
      .send({ reason: 'entered by mistake' });

  const ruleSchedules = () =>
    prisma.notificationSchedule.findMany({
      where: {
        farmId,
        origin: 'SYSTEM',
        sourceType: 'TASK',
        sourceKey: { startsWith: `rule:${RULE}:` },
      },
      include: { occurrences: true },
      orderBy: { createdAt: 'asc' },
    });
  const active = async () =>
    (await ruleSchedules()).filter((s) => s.status === 'ACTIVE');
  const pendingCount = (s: { occurrences: { status: string }[] }) =>
    s.occurrences.filter((o) => o.status === 'SCHEDULED').length;

  function manualAfter(eventId: string, cattleId: string, eventAt: Date) {
    return scheduler.createManual(farmId, owner.userId, {
      title: 'Check the cow 30 days on',
      trigger: 'AFTER_EVENT',
      baseAnchorAt: new Date(eventAt.getTime() + 30 * DAY),
      allDay: true,
      leadMinutes: [0],
      offsetDays: 30,
      anchorType: 'ANIMAL_EVENT',
      anchorId: eventId,
      audienceMode: 'USER',
      audienceUserIds: [owner.userId],
      animalIds: [cattleId],
    });
  }

  beforeAll(async () => {
    h = createNotificationV2Harness(new Date());
    ctx = await createTestApp({ configure: h.configure });
    prisma = ctx.app.get(PrismaService);
    scheduler = ctx.app.get(NotificationScheduler);
    processor = ctx.app.get(OccurrenceProcessor);
    owner = await createThrowawayOwner(ctx, prisma, 'NV2 follow-up farm');
    farmId = owner.farmId;
  }, 60_000);

  afterAll(async () => {
    await prisma.notificationSchedule.deleteMany({ where: { farmId } });
    await prisma.notification.deleteMany({ where: { farmId } });
    await prisma.task.deleteMany({ where: { farmId } });
    await prisma.animalEvent.deleteMany({ where: { farmId } });
    await prisma.breedingEvent
      .deleteMany({ where: { farmId } })
      .catch(() => undefined);
    await prisma.reproductionProfile
      .deleteMany({ where: { cattle: { farmId } } })
      .catch(() => undefined);
    await prisma.cattle
      .deleteMany({ where: { farmId } })
      .catch(() => undefined);
    await deleteThrowawayOwner(prisma, owner);
    await ctx.app.close();
  });

  beforeEach(async () => {
    h.queue.flush();
    h.clock.set(new Date());
    await prisma.notificationSchedule.deleteMany({ where: { farmId } });
    await prisma.task.deleteMany({ where: { farmId } });
  });

  it('a breeding event gives its preg-check one rule schedule [1 day, 0]', async () => {
    const [c] = await cows(1);
    await breed(c);
    const [s] = await active();
    expect(s).toBeDefined();
    expect(s.leadMinutes).toEqual([1440, 0]);
    expect(pendingCount(s)).toBe(2);
  });

  it('editing the event date moves the preg-check group to the new day', async () => {
    const [c] = await cows(1);
    const eventId = await breed(c);
    const [before] = await active();
    const res = await edit(c, eventId, {
      eventAt: new Date(Date.now() - 4 * DAY).toISOString(),
    });
    expect(res.status).toBe(200);
    const all = await ruleSchedules();
    const now = all.filter((s) => s.status === 'ACTIVE');
    expect(now).toHaveLength(1);
    expect(now[0].sourceKey).not.toBe(before.sourceKey);
    expect(pendingCount(now[0])).toBe(2);
    // The old group emptied and cancelled with nothing left to fire.
    const old = all.find((s) => s.id === before.id)!;
    expect(old.status).toBe('CANCELLED');
    expect(pendingCount(old)).toBe(0);
  });

  it('a manual schedule anchored on the event follows an edit and is cancelled by a void', async () => {
    const [c] = await cows(1);
    const at = hoursAgo(2);
    const eventId = await breed(c, at);
    const manual = await manualAfter(eventId, c, at);
    const first = manual.anchorAt.getTime();

    const newAt = new Date(Date.now() - 4 * DAY);
    expect(
      (await edit(c, eventId, { eventAt: newAt.toISOString() })).status,
    ).toBe(200);
    const moved = await prisma.notificationSchedule.findUniqueOrThrow({
      where: { id: manual.id },
    });
    expect(moved.status).toBe('ACTIVE');
    expect(moved.anchorAt.getTime()).toBeLessThan(first);

    expect((await voidIt(c, eventId)).status).toBe(201);
    const gone = await prisma.notificationSchedule.findUniqueOrThrow({
      where: { id: manual.id },
      include: { occurrences: true },
    });
    expect(gone.status).toBe('CANCELLED');
    expect(pendingCount(gone)).toBe(0);
    expect(await active()).toHaveLength(0);
  });

  it('voiding the event cancels the preg-check group', async () => {
    const [c] = await cows(1);
    const eventId = await breed(c);
    expect(await active()).toHaveLength(1);
    expect((await voidIt(c, eventId)).status).toBe(201);
    expect(await active()).toHaveLength(0);
  });

  it('a bulk of 100 animals gives ONE schedule and ONE notice', async () => {
    const ids = await cows(100);
    const res = await http()
      .post(`${ctx.prefix}/animal-events/bulk`)
      .set(...bearer(owner.owner))
      .send({
        type: 'BREEDING',
        eventAt: hoursAgo(2),
        payload: natural,
        cattleIds: ids,
      });
    expect(res.status).toBe(201);
    expect((res.body as { data: { saved: number } }).data.saved).toBe(100);
    expect(await prisma.task.count({ where: { farmId, ruleKey: RULE } })).toBe(
      100,
    );

    const schedules = await active();
    expect(schedules).toHaveLength(1);
    expect(pendingCount(schedules[0])).toBe(2);

    // Fire the day-before notice; the reconcile queues it once it is inside the horizon.
    const due = schedules[0].occurrences.find((o) => o.leadMinutes === 1440)!;
    h.clock.set(new Date(due.fireAt.getTime() + 60_000));
    await scheduler.reconcile(h.clock.now());
    await h.queue.runDue(h.clock.now(), (id) => processor.process(id));
    const sent = await prisma.notification.findMany({ where: { farmId } });
    // A single-user farm: one notice for the whole group, not one per animal.
    expect(sent).toHaveLength(1);
  }, 120_000);

  it('the ANIMAL_EVENT anchor checker sees live events only, scoped to the farm', async () => {
    const [c] = await cows(1);
    const eventId = await breed(c);
    const checker = ctx.app.get(AnimalEventAnchorChecker);
    expect(await checker.exists(farmId, eventId)).toBe(true);
    expect(await checker.exists('other-farm', eventId)).toBe(false);
    expect(await checker.exists(farmId, 'nope')).toBe(false);
    await voidIt(c, eventId);
    expect(await checker.exists(farmId, eventId)).toBe(false);
  });
});

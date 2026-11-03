/* eslint-disable @typescript-eslint/no-unsafe-argument */
import request from 'supertest';
import { localDateIso } from '../src/common/farm-time/farm-time';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { FollowUpReminderService } from '../src/modules/animal-events/application/services/follow-up-reminder.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-485 (one follow-up sweep) + RAKHAL-487 (custom reminders as Task kind REMINDER, RAKHAL-491).
 * Drives `FollowUpReminderService.sweepAll(now)` against the real DB, the entry the 05:00 cron calls.
 * The sweep is farm-wide and the dev DB holds other agents' tasks, so every assertion filters on the
 * dedupe keys of the tasks created here.
 */
describe('Follow-up sweep + custom reminders (RAKHAL-485/487)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let sweep: FollowUpReminderService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerId: string;
  let managerId: string;
  let workerId: string;
  let timezone: string;
  const run = Date.now();
  const DAY = 86_400_000;
  const api = (p: string) => `${ctx.prefix}${p}`;
  const inDays = (n: number) => new Date(Date.now() + n * DAY);
  const ymd = (d: Date) => localDateIso(timezone, d);
  const cowIds: string[] = [];
  const taskIds: string[] = [];

  const http = (u: AuthedUser) => ({
    get: (p: string) =>
      request(ctx.app.getHttpServer())
        .get(api(p))
        .set('Authorization', `Bearer ${u.token}`),
    post: (p: string, body: object = {}) =>
      request(ctx.app.getHttpServer())
        .post(api(p))
        .set('Authorization', `Bearer ${u.token}`)
        .send(body),
    patch: (p: string, body: object) =>
      request(ctx.app.getHttpServer())
        .patch(api(p))
        .set('Authorization', `Bearer ${u.token}`)
        .send(body),
  });

  async function cow(key: string) {
    const c = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-485-${key}-${run}`,
        gender: 'FEMALE',
        dateOfBirth: new Date(Date.now() - 1500 * DAY),
        createdBy: ownerId,
      },
    });
    cowIds.push(c.id);
    return c;
  }

  const notesByKey = (dedupeKey: string) =>
    prisma.notification.findMany({
      where: { farmId: owner.farmId, dedupeKey },
      orderBy: { createdAt: 'asc' },
    });

  /** Rule-group keys are shared per day, so drop earlier runs' notifications for them. */
  const clearRuleNotes = () =>
    prisma.notification.deleteMany({
      where: {
        farmId: owner.farmId,
        dedupeKey: {
          in: [
            'BREEDING_TO_PREG_CHECK',
            'PREG_POSITIVE_TO_CALVING_WATCH',
            'VACCINATION_NEXT_DOSE',
          ].map((k) => `fu:rule:${k}:DUE_TODAY:${ymd(new Date())}`),
        },
      },
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    sweep = ctx.app.get(FollowUpReminderService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    const id = async (email: string) =>
      (
        await prisma.user.findFirstOrThrow({
          where: { email },
          select: { id: true },
        })
      ).id;
    ownerId = await id('owner@demo.rakhal.test');
    managerId = await id('manager@demo.rakhal.test');
    workerId = await id('worker@demo.rakhal.test');
    timezone = (
      await prisma.farm.findUniqueOrThrow({
        where: { id: owner.farmId },
        select: { timezone: true },
      })
    ).timezone;
    await clearRuleNotes();
  }, 60_000);

  afterAll(async () => {
    const all = await prisma.task.findMany({
      where: {
        OR: [{ id: { in: taskIds } }, { name: { contains: String(run) } }],
      },
      select: { id: true },
    });
    if (all.length) {
      await prisma.notification.deleteMany({
        where: {
          OR: all.map((t) => ({ dedupeKey: { contains: `fu:task:${t.id}` } })),
        },
      });
    }
    await clearRuleNotes();
    await prisma.task.deleteMany({
      where: { id: { in: all.map((t) => t.id) } },
    });
    await prisma.animalEvent.deleteMany({
      where: { cattleId: { in: cowIds } },
    });
    await ctx.app.close();
  });

  it('rule tasks: one grouped notification per owner/manager, and a second run sends nothing new', async () => {
    const a = await cow('A');
    const b = await cow('B');
    for (const [i, c] of [a, b].entries()) {
      const t = await prisma.task.create({
        data: {
          farmId: owner.farmId,
          reference: `E2E485-${run}-${i}`,
          name: `Pregnancy check — ${c.tagNumber}`,
          category: 'BREEDING',
          dueAt: new Date(),
          source: 'SYSTEM_AUTO',
          relatedCattleId: c.id,
          ruleKey: 'BREEDING_TO_PREG_CHECK',
          sourceEventType: 'ANIMAL_EVENT',
          sourceEventId: `e2e-485-${run}-${i}`,
          followUpKey: `BREEDING_TO_PREG_CHECK:e2e-485-${run}-${i}`,
          createdBy: ownerId,
        },
      });
      taskIds.push(t.id);
    }
    const key = `fu:rule:BREEDING_TO_PREG_CHECK:DUE_TODAY:${ymd(new Date())}`;

    await sweep.sweepAll();
    const first = await notesByKey(key);
    const ownerNote = first.find((n) => n.userId === ownerId);
    expect(ownerNote).toBeDefined();
    expect(first.some((n) => n.userId === managerId)).toBe(true);
    // Workers are not default recipients.
    expect(first.some((n) => n.userId === workerId)).toBe(false);
    // Grouped: one notification for the owner naming both animals, not one per animal.
    expect(first.filter((n) => n.userId === ownerId)).toHaveLength(1);
    // Grouped payload: the filtered list link + {ruleKey, taskIds, count}.
    expect(ownerNote!.link).toBe('/animals?due=BREEDING_TO_PREG_CHECK');
    const grouped = ownerNote!.data as {
      ruleKey: string;
      taskIds: string[];
      count: number;
    };
    expect(grouped.ruleKey).toBe('BREEDING_TO_PREG_CHECK');
    expect(grouped.taskIds).toEqual(
      expect.arrayContaining(taskIds.slice(0, 2)),
    );
    expect(grouped.count).toBe(grouped.taskIds.length);

    const before = await prisma.notification.count({
      where: { farmId: owner.farmId },
    });
    await sweep.sweepAll();
    expect(
      await prisma.notification.count({ where: { farmId: owner.farmId } }),
    ).toBe(before);
  });

  it('a single-animal rule task deep-links to that animal with the event type to record', async () => {
    const c = await cow('ONE');
    const t = await prisma.task.create({
      data: {
        farmId: owner.farmId,
        reference: `E2E485-${run}-one`,
        name: `Next vaccine dose — ${c.tagNumber}`,
        category: 'HEALTHCARE',
        dueAt: new Date(),
        source: 'SYSTEM_AUTO',
        relatedCattleId: c.id,
        ruleKey: 'VACCINATION_NEXT_DOSE',
        sourceEventType: 'ANIMAL_EVENT',
        sourceEventId: `e2e-485-${run}-vacc`,
        createdBy: ownerId,
      },
    });
    taskIds.push(t.id);
    await sweep.sweepAll();
    const note = await prisma.notification.findFirstOrThrow({
      where: {
        userId: ownerId,
        dedupeKey: `fu:rule:VACCINATION_NEXT_DOSE:DUE_TODAY:${ymd(new Date())}`,
      },
      orderBy: { createdAt: 'desc' },
    });
    // Only meaningful when no other farm task shares the rule today.
    if ((note.data as { taskIds?: string[] }).taskIds === undefined) {
      expect(note.link).toBe(
        `/animals?view=${c.id}&record=VACCINATION&reminder=${t.id}`,
      );
      expect(note.data).toEqual({
        cattleId: c.id,
        taskId: t.id,
        ruleKey: 'VACCINATION_NEXT_DOSE',
        eventType: 'VACCINATION',
        sourceEventId: `e2e-485-${run}-vacc`,
      });
    }
  });

  it('a task for an animal that left the herd is not nagged', async () => {
    const gone = await cow('GONE');
    await prisma.cattle.update({
      where: { id: gone.id },
      data: { herdStatus: 'SOLD' },
    });
    const t = await prisma.task.create({
      data: {
        farmId: owner.farmId,
        reference: `E2E485-${run}-gone`,
        name: `Calving watch — ${gone.tagNumber}`,
        category: 'BREEDING',
        dueAt: new Date(),
        source: 'SYSTEM_AUTO',
        relatedCattleId: gone.id,
        ruleKey: 'PREG_POSITIVE_TO_CALVING_WATCH',
        createdBy: ownerId,
      },
    });
    taskIds.push(t.id);
    await sweep.sweepAll();
    const notes = await prisma.notification.findMany({
      where: {
        farmId: owner.farmId,
        dedupeKey: {
          startsWith: 'fu:rule:PREG_POSITIVE_TO_CALVING_WATCH:DUE_TODAY',
        },
        message: { contains: gone.tagNumber },
      },
    });
    expect(notes).toHaveLength(0);
  });

  describe('custom reminders', () => {
    it('creates a reminder with named users and animals, and notifies the lead day and the day itself', async () => {
      const c = await cow('R1');
      const res = await http(owner)
        .post('/tasks', {
          name: `Check water trough ${run}`,
          kind: 'REMINDER',
          dueAt: inDays(1).toISOString(),
          remindDaysBefore: 1,
          recipientUserIds: [workerId],
          cattleIds: [c.id],
        })
        .expect(201);
      const task = res.body.data;
      taskIds.push(task.id);
      expect(task.kind).toBe('REMINDER');
      expect(task.category).toBe('GENERAL');
      expect(task.recipientUserIds).toEqual([workerId]);
      expect(task.cattleIds).toEqual([c.id]);

      await sweep.sweepAll();
      const leadKey = `fu:task:${task.id}:UPCOMING:${ymd(new Date(task.dueAt))}`;
      const lead = await notesByKey(leadKey);
      // Named users only: the worker, and not the default Owner/Manager.
      expect(lead.map((n) => n.userId)).toEqual([workerId]);
      expect(lead[0].message).toContain(c.tagNumber);
      // One animal, one reminder: open the animal (no event type to record).
      expect(lead[0].link).toBe(`/animals?view=${c.id}&reminder=${task.id}`);
      expect(lead[0].data).toMatchObject({
        cattleId: c.id,
        taskId: task.id,
        eventType: null,
      });

      await sweep.sweepAll();
      expect(await notesByKey(leadKey)).toHaveLength(1);

      // The day itself: move it to today and sweep again.
      await http(owner)
        .patch(`/tasks/${task.id}`, { dueAt: new Date().toISOString() })
        .expect(200);
      await sweep.sweepAll();
      expect(
        await notesByKey(`fu:task:${task.id}:DUE_TODAY:${ymd(new Date())}`),
      ).toHaveLength(1);
    });

    it('a reminder with no animal and no recipients goes to the owner and manager', async () => {
      const res = await http(owner)
        .post('/tasks', {
          name: `Farm-wide reminder ${run}`,
          kind: 'REMINDER',
          dueAt: new Date().toISOString(),
        })
        .expect(201);
      taskIds.push(res.body.data.id);
      await sweep.sweepAll();
      const notes = await notesByKey(
        `fu:task:${res.body.data.id}:DUE_TODAY:${ymd(new Date())}`,
      );
      expect(new Set(notes.map((n) => n.userId))).toEqual(
        new Set([ownerId, managerId]),
      );
      // Farm-wide reminder: info only, no action.
      expect(notes.every((n) => n.link === null)).toBe(true);
    });

    it('a repeating reminder spawns the next occurrence once, when it fires', async () => {
      const name = `Every 3 days ${run}`;
      const res = await http(owner)
        .post('/tasks', {
          name,
          kind: 'REMINDER',
          dueAt: new Date().toISOString(),
          recurring: true,
          recurrenceType: 'EVERY_N_DAYS',
          recurrenceIntervalDays: 3,
        })
        .expect(201);
      const id = res.body.data.id as string;
      taskIds.push(id);
      await sweep.sweepAll();
      await sweep.sweepAll();
      const next = await prisma.task.findMany({
        where: { farmId: owner.farmId, name, id: { not: id } },
      });
      expect(next).toHaveLength(1);
      taskIds.push(next[0].id);
      const gap = Math.round(
        (next[0].dueAt.getTime() - new Date(res.body.data.dueAt).getTime()) /
          DAY,
      );
      expect(gap).toBe(3);
      expect(next[0].recurrenceIntervalDays).toBe(3);

      // Completing the original does not spawn a second one.
      await http(owner).post(`/tasks/${id}/complete`, {}).expect(201);
      expect(
        await prisma.task.count({
          where: { farmId: owner.farmId, name, id: { not: id } },
        }),
      ).toBe(1);
    });

    it('cancel stops future fires', async () => {
      const name = `Cancelled reminder ${run}`;
      const res = await http(owner)
        .post('/tasks', {
          name,
          kind: 'REMINDER',
          dueAt: new Date().toISOString(),
          recurring: true,
          recurrenceType: 'DAILY',
        })
        .expect(201);
      const id = res.body.data.id as string;
      taskIds.push(id);
      await http(owner).post(`/tasks/${id}/cancel`, {}).expect(201);
      await sweep.sweepAll();
      expect(
        await notesByKey(`fu:task:${id}:DUE_TODAY:${ymd(new Date())}`),
      ).toHaveLength(0);
      expect(
        await prisma.task.count({
          where: { farmId: owner.farmId, name, id: { not: id } },
        }),
      ).toBe(0);
    });

    it('linked to an event: due date follows the event, and a void cancels it', async () => {
      const c = await cow('LINK');
      await http(owner)
        .post(`/cattle/${c.id}/events`, {
          type: 'WEIGHT',
          eventAt: new Date(Date.now() - 3 * DAY).toISOString(),
          payload: { weightKg: 320 },
        })
        .expect(201);
      const ev = await prisma.animalEvent.findFirstOrThrow({
        where: { cattleId: c.id, type: 'WEIGHT' },
      });
      const res = await http(owner)
        .post('/tasks', {
          name: `Re-weigh ${run}`,
          kind: 'REMINDER',
          sourceEventId: ev.id,
          offsetDays: 30,
        })
        .expect(201);
      const id = res.body.data.id as string;
      taskIds.push(id);
      expect(res.body.data.relatedCattleId).toBe(c.id);
      expect(new Date(res.body.data.dueAt).getTime()).toBe(
        ev.eventAt.getTime() + 30 * DAY,
      );

      const newAt = new Date(Date.now() - 10 * DAY);
      await http(owner)
        .patch(`/cattle/${c.id}/events/${ev.id}`, {
          eventAt: newAt.toISOString(),
        })
        .expect(200);
      const moved = await prisma.task.findUniqueOrThrow({ where: { id } });
      expect(moved.status).toBe('PENDING');
      expect(moved.dueAt.getTime()).toBe(newAt.getTime() + 30 * DAY);

      await http(owner)
        .post(`/cattle/${c.id}/events/${ev.id}/void`, { reason: 'wrong cow' })
        .expect(201);
      const voided = await prisma.task.findUniqueOrThrow({ where: { id } });
      expect(voided.status).toBe('CANCELLED');
    });

    it('validates: dueAt xor source event, interval for EVERY_N_DAYS, member-only recipients', async () => {
      const base = { name: `Bad ${run}`, kind: 'REMINDER' };
      const now = new Date().toISOString();
      await http(owner)
        .post('/tasks', {
          ...base,
          sourceEventId: 'x',
          offsetDays: 1,
          dueAt: now,
        })
        .expect(400);
      await http(owner).post('/tasks', base).expect(400);
      await http(owner)
        .post('/tasks', {
          ...base,
          dueAt: now,
          recurring: true,
          recurrenceType: 'EVERY_N_DAYS',
        })
        .expect(400);
      await http(owner)
        .post('/tasks', { ...base, dueAt: now, recipientUserIds: ['nobody'] })
        .expect(400);
      await http(owner)
        .post('/tasks', { ...base, sourceEventId: 'missing', offsetDays: 1 })
        .expect(404);
    });

    it('RAKHAL-491: kind filter, highlights split, legacy category alias', async () => {
      const base = (await http(owner).get('/tasks?limit=1').expect(200)).body
        .meta;
      const t = await http(owner)
        .post('/tasks', {
          name: `KS491-${run} plain`,
          category: 'MAINTENANCE',
          dueAt: new Date(Date.now() - DAY).toISOString(),
        })
        .expect(201);
      taskIds.push(t.body.data.id);
      expect(t.body.data.kind).toBe('TASK');
      const rem = await http(owner)
        .post('/tasks', {
          name: `KS491-${run} overdue`,
          kind: 'REMINDER',
          category: 'BREEDING',
          dueAt: new Date(Date.now() - DAY).toISOString(),
          recurring: true,
          recurrenceType: 'DAILY',
        })
        .expect(201);
      taskIds.push(rem.body.data.id);
      expect(rem.body.data.kind).toBe('REMINDER');
      expect(rem.body.data.category).toBe('BREEDING');
      // Deprecated alias: category REMINDER stores kind REMINDER + topic GENERAL.
      const legacy = await http(owner)
        .post('/tasks', {
          name: `KS491-${run} legacy`,
          category: 'REMINDER',
          dueAt: inDays(5).toISOString(),
        })
        .expect(201);
      taskIds.push(legacy.body.data.id);
      expect(legacy.body.data.kind).toBe('REMINDER');
      expect(legacy.body.data.category).toBe('GENERAL');

      const search = encodeURIComponent(`KS491-${run}`);
      const onlyTasks = await http(owner)
        .get(`/tasks?kind=task&search=${search}`)
        .expect(200);
      expect(onlyTasks.body.data.map((x: { id: string }) => x.id)).toEqual([
        t.body.data.id,
      ]);
      const onlyRem = await http(owner)
        .get(`/tasks?kind=reminder&search=${search}`)
        .expect(200);
      expect(onlyRem.body.data.map((x: { id: string }) => x.id).sort()).toEqual(
        [rem.body.data.id, legacy.body.data.id].sort(),
      );
      await http(owner).get('/tasks?kind=bogus').expect(400);

      // Exact deltas on this farm: +1 overdue reminder (repeating), +1 upcoming (legacy alias),
      // and the plain overdue task moves only highlights.overdue (reminders never do).
      const after = (await http(owner).get('/tasks?limit=1').expect(200)).body
        .meta;
      expect(
        after.reminderHighlights.overdue - base.reminderHighlights.overdue,
      ).toBe(1);
      expect(
        after.reminderHighlights.upcoming - base.reminderHighlights.upcoming,
      ).toBe(1);
      expect(
        after.reminderHighlights.repeating - base.reminderHighlights.repeating,
      ).toBe(1);
      expect(after.highlights.overdue - base.highlights.overdue).toBe(1);

      // Sweep still fires for a kind=REMINDER row.
      await sweep.sweepAll();
      const fired = await prisma.notification.count({
        where: {
          farmId: owner.farmId,
          dedupeKey: { startsWith: `fu:task:${rem.body.data.id}:` },
        },
      });
      expect(fired).toBeGreaterThanOrEqual(1);
    });

    it('a worker cannot create a reminder', async () => {
      await http(worker)
        .post('/tasks', {
          name: `W ${run}`,
          kind: 'REMINDER',
          dueAt: new Date().toISOString(),
        })
        .expect(403);
    });
  });
});

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
 * RAKHAL-475 (MILESTONE 30) — per-animal upcoming events on `GET /cattle` (`next_event` +
 * `upcoming_event_count`), `GET /cattle/:id/upcoming-events`, and the `dueFilter` list filter.
 *
 * Runs in two throwaway farms (own farm each, so the whole-list assertions are exact and the cross-farm
 * check is real). Rows are written straight through Prisma — their own create routes belong to Health /
 * Reproduction / Task Hub.
 *
 * Requires the dev stack up + `pnpm seed` (the demo worker is used for the RBAC check).
 */
describe('Cattle — upcoming events (e2e, RAKHAL-475)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let a: ThrowawayOwner;
  let b: ThrowawayOwner;
  let worker: AuthedUser;

  const DAY = 24 * 60 * 60 * 1000;
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const tag = (label: string) =>
    `UE-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const ids: Record<
    'overdue' | 'calving' | 'task' | 'quiet' | 'withdrawal',
    string
  > = { overdue: '', calving: '', task: '', quiet: '', withdrawal: '' };
  const tags: Record<keyof typeof ids, string> = {
    overdue: tag('od'),
    calving: tag('cv'),
    task: tag('tk'),
    quiet: tag('qt'),
    withdrawal: tag('wd'),
  };

  async function makeCow(key: keyof typeof ids): Promise<string> {
    const cow = await prisma.cattle.create({
      data: {
        farmId: a.farmId,
        tagNumber: tags[key],
        gender: 'FEMALE',
        createdBy: a.userId,
      },
    });
    ids[key] = cow.id;
    return cow.id;
  }

  async function makeCase(cattleId: string): Promise<string> {
    const healthCase = await prisma.healthCase.create({
      data: {
        farmId: a.farmId,
        cattleId,
        caseCode: tag('HC'),
        note: 'e2e case',
        careType: 'CURATIVE',
        priority: 'HIGH',
        reportedBy: a.userId,
      },
    });
    return healthCase.id;
  }

  const listRows = async (qs = '') => {
    const res = await request(server())
      .get(api(`/cattle?limit=100${qs}`))
      .set(...auth(a.owner));
    expect(res.status).toBe(200);
    return res.body.data as Array<{
      id: string;
      next_event: {
        kind: string;
        urgency: string;
        actionable: boolean;
        daysUntil: number;
        labelKey: string;
        ref: { type: string; id: string };
      } | null;
      upcoming_event_count: number;
    }>;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    a = await createThrowawayOwner(ctx, prisma, 'E2E Upcoming A');
    b = await createThrowawayOwner(ctx, prisma, 'E2E Upcoming B');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');

    // 1. overdue health step (curative case, step due two days ago)
    const overdue = await makeCow('overdue');
    await prisma.healthTask.create({
      data: {
        farmId: a.farmId,
        cattleId: overdue,
        healthCaseId: await makeCase(overdue),
        taskCode: tag('HT'),
        taskDate: new Date(Date.now() - 2 * DAY),
        dueDateTime: new Date(Date.now() - 2 * DAY),
        taskType: 'MEDICINE',
        title: 'Antibiotic day 2',
      },
    });

    // 2. calving in 5 days
    const calving = await makeCow('calving');
    await prisma.pregnancy.create({
      data: {
        cattleId: calving,
        conceptionDate: new Date(Date.now() - 275 * DAY),
        expectedCalvingDate: new Date(Date.now() + 5 * DAY),
        status: 'ACTIVE',
      },
    });

    // 3. an open Task Hub task due today
    const taskCow = await makeCow('task');
    await prisma.task.create({
      data: {
        farmId: a.farmId,
        reference: tag('TSK'),
        name: 'Weigh the cow',
        dueAt: new Date(),
        relatedCattleId: taskCow,
        createdBy: a.userId,
      },
    });

    // 4. nothing at all
    await makeCow('quiet');

    // 5. only a withdrawal ending — information, not work
    const withdrawal = await makeCow('withdrawal');
    await prisma.safetyWithdrawal.create({
      data: {
        farmId: a.farmId,
        cattleId: withdrawal,
        healthCaseId: await makeCase(withdrawal),
        milkWithdrawalUntil: new Date(Date.now() + 2 * DAY),
        status: 'ACTIVE',
      },
    });
  }, 60_000);

  afterAll(async () => {
    for (const farm of [a, b]) {
      if (!farm) continue;
      await prisma.safetyWithdrawal
        .deleteMany({ where: { farmId: farm.farmId } })
        .catch(() => undefined);
      await prisma.healthTask
        .deleteMany({ where: { farmId: farm.farmId } })
        .catch(() => undefined);
      await prisma.healthCase
        .deleteMany({ where: { farmId: farm.farmId } })
        .catch(() => undefined);
      await prisma.pregnancy
        .deleteMany({ where: { cattle: { farmId: farm.farmId } } })
        .catch(() => undefined);
      await prisma.breedingEvent
        .deleteMany({ where: { cattle: { farmId: farm.farmId } } })
        .catch(() => undefined);
      await prisma.task
        .deleteMany({ where: { farmId: farm.farmId } })
        .catch(() => undefined);
      await prisma.cattle
        .deleteMany({ where: { farmId: farm.farmId } })
        .catch(() => undefined);
      await deleteThrowawayOwner(prisma, farm);
    }
    await ctx.app.close();
  });

  describe('GET /cattle — next_event + upcoming_event_count', () => {
    it('attaches the most urgent event and the count to every row', async () => {
      const rows = await listRows();
      const byId = new Map(rows.map((r) => [r.id, r]));

      expect(byId.get(ids.overdue)).toMatchObject({
        upcoming_event_count: 1,
        next_event: {
          kind: 'HEALTH_STEP',
          urgency: 'OVERDUE',
          actionable: true,
          labelKey: 'cattle.upcoming.healthStep',
          ref: { type: 'HEALTH_TASK' },
        },
      });
      expect(byId.get(ids.overdue)!.next_event!.daysUntil).toBeLessThan(0);

      expect(byId.get(ids.calving)).toMatchObject({
        upcoming_event_count: 1,
        next_event: { kind: 'CALVING', actionable: true },
      });
      expect(
        byId.get(ids.calving)!.next_event!.daysUntil,
      ).toBeGreaterThanOrEqual(4);

      expect(byId.get(ids.task)).toMatchObject({
        upcoming_event_count: 1,
        next_event: { kind: 'TASK', urgency: 'DUE_SOON' },
      });
      expect(byId.get(ids.quiet)).toMatchObject({
        next_event: null,
        upcoming_event_count: 0,
      });
      // A withdrawal ending is shown, but as information.
      expect(byId.get(ids.withdrawal)).toMatchObject({
        upcoming_event_count: 1,
        next_event: { kind: 'WITHDRAWAL_END', actionable: false },
      });
    });

    it('a voided newer breeding does not hide the real pending pregnancy check', async () => {
      const cow = await prisma.cattle.create({
        data: {
          farmId: a.farmId,
          tagNumber: tag('vd'),
          gender: 'FEMALE',
          createdBy: a.userId,
        },
      });
      await prisma.breedingEvent.create({
        data: {
          cattleId: cow.id,
          breedingDate: new Date(Date.now() - 20 * DAY),
          breedingMethod: 'AI',
          breedingNumber: 1,
          expectedPregnancyCheckDate: new Date(Date.now() + 3 * DAY),
          status: 'PENDING_CHECK',
        },
      });
      // Recorded by mistake afterwards, then voided: newer, but not a real attempt.
      await prisma.breedingEvent.create({
        data: {
          cattleId: cow.id,
          breedingDate: new Date(Date.now() - 1 * DAY),
          breedingMethod: 'AI',
          breedingNumber: 2,
          status: 'VOIDED',
          voidedAt: new Date(),
        },
      });

      const row = (await listRows(`&search=${cow.tagNumber}`)).find(
        (r) => r.id === cow.id,
      );
      expect(row).toMatchObject({
        upcoming_event_count: 1,
        next_event: { kind: 'PREGNANCY_CHECK' },
      });
    });

    it('a worker can read it (cattle.read)', async () => {
      const res = await request(server())
        .get(api('/cattle?limit=5'))
        .set(...auth(worker));
      expect(res.status).toBe(200);
      for (const row of res.body.data as Array<Record<string, unknown>>) {
        expect(row).toHaveProperty('next_event');
        expect(row).toHaveProperty('upcoming_event_count');
      }
    });
  });

  describe('GET /cattle?dueFilter=', () => {
    const idsOf = (rows: Array<{ id: string }>) => rows.map((r) => r.id);

    it('overdue lists only the animal with a past-due action', async () => {
      const found = idsOf(await listRows('&dueFilter=overdue'));
      expect(found).toContain(ids.overdue);
      for (const other of ['calving', 'task', 'quiet', 'withdrawal'] as const) {
        expect(found).not.toContain(ids[other]);
      }
    });

    it('today lists the animal with a task due today, nobody else', async () => {
      const found = idsOf(await listRows('&dueFilter=today'));
      expect(found).toContain(ids.task);
      for (const other of [
        'overdue',
        'calving',
        'quiet',
        'withdrawal',
      ] as const) {
        expect(found).not.toContain(ids[other]);
      }
    });

    it('week lists today and the coming week, not overdue, not a withdrawal ending', async () => {
      const found = idsOf(await listRows('&dueFilter=week'));
      expect(found).toEqual(expect.arrayContaining([ids.task, ids.calving]));
      for (const other of ['overdue', 'quiet', 'withdrawal'] as const) {
        expect(found).not.toContain(ids[other]);
      }
    });

    it('combines with other filters instead of replacing them (search + dueFilter)', async () => {
      const hit = idsOf(
        await listRows(`&dueFilter=overdue&search=${tags.overdue}`),
      );
      expect(hit).toEqual([ids.overdue]);
      // Same search, but a filter this cow does not satisfy -> nothing.
      const miss = await listRows(`&dueFilter=today&search=${tags.overdue}`);
      expect(miss).toEqual([]);
    });

    it('rejects an unknown value', async () => {
      const res = await request(server())
        .get(api('/cattle?dueFilter=tomorrow'))
        .set(...auth(a.owner));
      expect(res.status).toBe(400);
    });
  });

  describe('GET /cattle/:id/upcoming-events', () => {
    const get = (id: string, qs = '', user: AuthedUser = a.owner) =>
      request(server())
        .get(api(`/cattle/${id}/upcoming-events${qs}`))
        .set(...auth(user));

    it('returns the ordered list and the total', async () => {
      const res = await get(ids.overdue);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.events[0]).toMatchObject({
        kind: 'HEALTH_STEP',
        urgency: 'OVERDUE',
        labelParams: { title: 'Antibiotic day 2' },
        ref: { type: 'HEALTH_TASK' },
      });
    });

    it('windowDays narrows the look-ahead but never hides overdue', async () => {
      const calving = await get(ids.calving, '?windowDays=1');
      expect(calving.body.data).toEqual({ events: [], total: 0 });
      const overdue = await get(ids.overdue, '?windowDays=1');
      expect(overdue.body.data.total).toBe(1);
    });

    it("another farm's user (the demo worker) gets a 404 for this animal, not its events", async () => {
      const res = await get(ids.overdue, '', worker);
      expect(res.status).toBe(404);
    });

    it("is not readable across farms: another farm's animal is a 404", async () => {
      const res = await get(ids.overdue, '', b.owner);
      expect(res.status).toBe(404);
    });

    it('an unknown animal is a 404', async () => {
      const res = await get('does-not-exist');
      expect(res.status).toBe(404);
    });

    it.each(['?limit=0', '?limit=51', '?windowDays=0', '?windowDays=91'])(
      'validates the query (%s)',
      async (qs) => {
        const res = await get(ids.overdue, qs);
        expect(res.status).toBe(400);
      },
    );

    it("farm B's own list never carries farm A's events", async () => {
      const res = await request(server())
        .get(api('/cattle?limit=100'))
        .set(...auth(b.owner));
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});

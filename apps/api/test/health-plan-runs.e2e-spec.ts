import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-470 (MILESTONE 29c, Healthcare page simplification — backend half).
 *  - `GET /health/plans?inUse=`  : only protocols with a run now; an archived protocol with animals on it stays.
 *  - `stats.stepsDue / stepsOverdue / nextDueDate` on every plan (open steps of live animals, farm-local day).
 *  - `GET /health/plans/:id/runs` : the animals on one protocol, paged, with progress + next step.
 *  - `GET /health/tasks`          : `healthPlanId`, `statuses`, `noPlan`, `dueTo`, `sortBy=due`, plan included.
 *  - `GET /health/sick-bay`       : rows carry `withdrawalDaysLeft`.
 * Everything is found through a per-run unique tag, so the shared dev DB's other protocols never interfere.
 */
describe('Health — protocol runs, schedule counts, task filters (RAKHAL-470)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerId: string;
  const tag = `E2E-RAKHAL470-${Date.now()}`;
  const DAY = 24 * 60 * 60 * 1000;
  const inDays = (n: number) => new Date(Date.now() + n * DAY);

  const cattleIds: string[] = [];
  const planIds: string[] = [];
  const cow: Record<string, string> = {};
  const caseIdOf: Record<string, string> = {};
  let treatmentPlanId: string;
  let preventionPlanId: string;
  let idlePlanId: string;
  let archivedPlanId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const get = async (path: string, user: AuthedUser = owner) =>
    request(server())
      .get(api(path))
      .set(...auth(user))
      .expect(200);

  async function makeCow(s: string) {
    const created = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `${tag}-${s}`,
        name: `Cow ${s}`,
        gender: 'FEMALE',
        createdBy: ownerId,
      },
    });
    cattleIds.push(created.id);
    cow[s] = created.id;
    return created.id;
  }

  async function makeCase(
    s: string,
    status: string,
    healthPlanId: string,
    extra: Record<string, unknown> = {},
  ) {
    const created = await prisma.healthCase.create({
      data: {
        farmId: owner.farmId,
        cattleId: cow[s],
        caseCode: `${tag}-${s}`,
        careType: 'CURATIVE',
        priority: 'MEDIUM',
        status,
        healthPlanId,
        startDate: inDays(-4),
        currentStep: 1,
        totalSteps: 3,
        progressPercentage: 33,
        ...extra,
      } as never,
    });
    caseIdOf[s] = created.id;
    return created.id;
  }

  const makeTask = (data: Record<string, unknown>) =>
    prisma.healthTask.create({
      data: {
        farmId: owner.farmId,
        taskType: 'MEDICINE',
        title: 'Dose',
        ...data,
      } as never,
    });
  const stepData = (
    n: number,
    days: number,
    extra: Record<string, unknown>,
  ) => ({
    taskCode: `${tag}-task-${n}`,
    taskDate: inDays(days),
    dueDateTime: inDays(days),
    ...extra,
  });

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    ownerId = (
      await prisma.user.findFirstOrThrow({
        where: { email: 'owner@demo.rakhal.test' },
        select: { id: true },
      })
    ).id;

    const mk = async (body: Record<string, unknown>) => {
      const res = await request(server())
        .post(api('/health/plans'))
        .set(...auth(owner))
        .send(body)
        .expect(201);
      planIds.push(res.body.data.id);
      return res.body.data.id as string;
    };
    const step = [{ dayNumber: 0, title: 'Dose', actionType: 'MEDICINE' }];
    treatmentPlanId = await mk({
      name: `${tag} treatment`,
      category: 'TREATMENT',
      planType: 'MEDICAL',
      steps: step,
    });
    preventionPlanId = await mk({
      name: `${tag} vaccine`,
      category: 'VACCINATION',
      planType: 'PREVENTION',
      steps: step,
    });
    idlePlanId = await mk({
      name: `${tag} idle`,
      category: 'TREATMENT',
      planType: 'MEDICAL',
      steps: step,
    });
    archivedPlanId = await mk({
      name: `${tag} archived`,
      category: 'TREATMENT',
      planType: 'MEDICAL',
      steps: step,
    });

    for (const s of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) await makeCow(s);

    // treatment protocol: a = ACTIVE with an overdue + a today step, b = IMPROVING with a future step, c = RECOVERED
    // with a stray open step (must not count — the case is closed)
    await makeCase('a', 'ACTIVE', treatmentPlanId);
    await makeCase('b', 'IMPROVING', treatmentPlanId);
    await makeCase('c', 'RECOVERED', treatmentPlanId, {
      closedDate: inDays(-1),
    });
    await makeTask(
      stepData(1, -3, {
        cattleId: cow.a,
        healthCaseId: caseIdOf.a,
        healthPlanId: treatmentPlanId,
        status: 'PENDING',
        title: 'Overdue dose',
      }),
    );
    await makeTask(
      stepData(2, 0, {
        cattleId: cow.a,
        healthCaseId: caseIdOf.a,
        healthPlanId: treatmentPlanId,
        status: 'PENDING',
        title: 'Todays dose',
      }),
    );
    await makeTask(
      stepData(3, 5, {
        cattleId: cow.b,
        healthCaseId: caseIdOf.b,
        healthPlanId: treatmentPlanId,
        status: 'PENDING',
        title: 'Later dose',
      }),
    );
    await makeTask(
      stepData(4, -2, {
        cattleId: cow.c,
        healthCaseId: caseIdOf.c,
        healthPlanId: treatmentPlanId,
        status: 'PENDING',
        title: 'Stray dose',
      }),
    );
    // a completed step never counts
    await makeTask(
      stepData(5, -6, {
        cattleId: cow.a,
        healthCaseId: caseIdOf.a,
        healthPlanId: treatmentPlanId,
        status: 'COMPLETED',
        title: 'Done dose',
      }),
    );

    // prevention protocol: d = ACTIVE enrollment with an overdue step, e = COMPLETED enrollment
    const application = await prisma.planApplication.create({
      data: {
        farmId: owner.farmId,
        healthPlanId: preventionPlanId,
        startDate: inDays(-5),
        appliedBy: ownerId,
        animalCount: 2,
      },
    });
    const enrollmentOf: Record<string, string> = {};
    for (const [s, status] of [
      ['d', 'ACTIVE'],
      ['e', 'COMPLETED'],
    ] as const) {
      const enrollment = await prisma.planEnrollment.create({
        data: {
          farmId: owner.farmId,
          cattleId: cow[s],
          healthPlanId: preventionPlanId,
          planApplicationId: application.id,
          startDate: inDays(-5),
          status,
          currentStep: 1,
          totalSteps: 2,
          progressPercentage: 50,
        },
      });
      enrollmentOf[s] = enrollment.id;
    }
    await makeTask(
      stepData(6, -1, {
        cattleId: cow.d,
        planEnrollmentId: enrollmentOf.d,
        healthPlanId: preventionPlanId,
        status: 'OVERDUE',
        taskType: 'VACCINATION',
        title: 'Booster',
      }),
    );

    // archived protocol with one live case: stays in the in-use view, absent from the default list
    await makeCase('f', 'ACTIVE', archivedPlanId);
    await prisma.healthPlan.update({
      where: { id: archivedPlanId },
      data: { deletedAt: new Date() },
    });

    // a step with no protocol at all, and an active milk/meat hold on a case (sick-bay `withdrawalDaysLeft`)
    await makeTask(
      stepData(7, 1, {
        cattleId: cow.g,
        status: 'PENDING',
        title: 'Loose step',
      }),
    );
    await makeCase('g', 'ACTIVE', treatmentPlanId, {
      priority: 'HIGH',
    });
    await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId: cow.g,
        healthCaseId: caseIdOf.g,
        status: 'ACTIVE',
        milkWithdrawalUntil: inDays(2),
        meatWithdrawalUntil: inDays(6),
      },
    });
  }, 60_000);

  afterAll(async () => {
    await prisma.safetyWithdrawal.deleteMany({
      where: { cattleId: { in: cattleIds } },
    });
    await prisma.healthTask.deleteMany({
      where: { cattleId: { in: cattleIds } },
    });
    await prisma.planEnrollment.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.planApplication.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.healthCase.deleteMany({
      where: { cattleId: { in: cattleIds } },
    });
    await prisma.healthPlanStep.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.healthPlan.deleteMany({ where: { id: { in: planIds } } });
    await prisma.cattle.deleteMany({ where: { id: { in: cattleIds } } });
    await ctx.app.close();
  });

  describe('GET /health/plans?inUse=', () => {
    it('lists only protocols that have a run now', async () => {
      const res = await get(`/health/plans?search=${tag}&inUse=true`);
      const ids = (res.body.data as Array<{ id: string }>).map((p) => p.id);
      expect(ids).toContain(treatmentPlanId);
      expect(ids).toContain(preventionPlanId);
      expect(ids).not.toContain(idlePlanId);
    });

    it('keeps an archived protocol that still has animals on it, in both the in-use and the normal list', async () => {
      const inUse = await get(`/health/plans?search=${tag}&inUse=true`);
      const archived = (
        inUse.body.data as Array<{ id: string; deletedAt: string | null }>
      ).find((p) => p.id === archivedPlanId);
      expect(archived).toBeDefined();
      expect(archived?.deletedAt).not.toBeNull();

      // The UI has no In use | All switch any more, so the normal list must not lose a running protocol either.
      const all = await get(`/health/plans?search=${tag}`);
      const ids = (all.body.data as Array<{ id: string }>).map((p) => p.id);
      expect(ids).toContain(archivedPlanId);
      expect(ids).toContain(idlePlanId);
    });

    it('a protocol whose only run is finished is not in use', async () => {
      await prisma.healthCase.updateMany({
        where: { healthPlanId: archivedPlanId },
        data: { status: 'RECOVERED' },
      });
      const res = await get(`/health/plans?search=${tag}&inUse=true`);
      expect(
        (res.body.data as Array<{ id: string }>).map((p) => p.id),
      ).not.toContain(archivedPlanId);
      // ...and once nothing is running on an archived protocol it is gone from the normal list too.
      const all = await get(`/health/plans?search=${tag}`);
      expect(
        (all.body.data as Array<{ id: string }>).map((p) => p.id),
      ).not.toContain(archivedPlanId);
      await prisma.healthCase.updateMany({
        where: { healthPlanId: archivedPlanId },
        data: { status: 'ACTIVE' },
      });
    });

    it('rejects a non-boolean inUse', async () => {
      await request(server())
        .get(api('/health/plans?inUse=maybe'))
        .set(...auth(owner))
        .expect(400);
    });
  });

  describe('GET /health/plans?kind= (RFE-142)', () => {
    const idsFor = async (kind: string) => {
      const res = await get(`/health/plans?search=${tag}&kind=${kind}`);
      return (res.body.data as Array<{ id: string }>).map((p) => p.id);
    };

    it('TREATMENT returns only treatment protocols', async () => {
      const ids = await idsFor('TREATMENT');
      expect(ids).toContain(treatmentPlanId);
      expect(ids).toContain(idlePlanId);
      expect(ids).not.toContain(preventionPlanId);
    });

    it('PREVENTION covers vaccination / deworming / routine, not treatment', async () => {
      const ids = await idsFor('PREVENTION');
      expect(ids).toEqual([preventionPlanId]);
    });

    it('BREEDING returns none here, and an unknown kind is rejected', async () => {
      expect(await idsFor('BREEDING')).toEqual([]);
      await request(server())
        .get(api('/health/plans?kind=NOPE'))
        .set(...auth(owner))
        .expect(400);
    });

    it('composes with inUse', async () => {
      const res = await get(
        `/health/plans?search=${tag}&kind=TREATMENT&inUse=true`,
      );
      const ids = (res.body.data as Array<{ id: string }>).map((p) => p.id);
      expect(ids).toContain(treatmentPlanId);
      expect(ids).not.toContain(idlePlanId);
      expect(ids).not.toContain(preventionPlanId);
    });
  });

  describe('stats.stepsDue / stepsOverdue / nextDueDate', () => {
    const planStats = async (name: string) => {
      const res = await get(`/health/plans?search=${tag} ${name}`);
      return (res.body.data as Array<Record<string, any>>)[0].stats;
    };

    it('counts open steps of live animals only, split by the farm day', async () => {
      const stats = await planStats('treatment');
      // a: overdue + today; b: future; g: none due. c's stray step is on a closed case, the completed step is done.
      expect(stats.stepsOverdue).toBe(1);
      expect(stats.stepsDue).toBe(1);
      expect(stats.nextDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('the next due day is the earliest open live step, even when it is already late', async () => {
      const stats = await planStats('treatment');
      const earliest = new Date(inDays(-3)).toISOString().slice(0, 10);
      // farm day of a step 3 days ago — within a day of the UTC date, whatever the farm timezone
      const gap = Math.abs(
        new Date(stats.nextDueDate).getTime() - new Date(earliest).getTime(),
      );
      expect(gap).toBeLessThanOrEqual(DAY);
    });

    it('a prevention protocol reports its overdue step the same way', async () => {
      const stats = await planStats('vaccine');
      expect(stats).toMatchObject({
        kind: 'PREVENTION',
        stepsOverdue: 1,
        stepsDue: 0,
      });
    });

    it('a protocol with nothing open is zeros and a null date', async () => {
      const stats = await planStats('idle');
      expect(stats).toMatchObject({
        stepsDue: 0,
        stepsOverdue: 0,
        nextDueDate: null,
      });
    });

    it('the existing result fields are untouched', async () => {
      const stats = await planStats('treatment');
      expect(stats).toMatchObject({
        kind: 'TREATMENT',
        recovered: 1,
        mortality: 0,
      });
    });
  });

  describe('GET /health/plans/:id/runs', () => {
    it('lists the animals on a treatment protocol with progress and the next open step', async () => {
      const res = await get(`/health/plans/${treatmentPlanId}/runs`);
      const rows = res.body.data as Array<Record<string, any>>;
      const byCow = Object.fromEntries(
        rows.map((r) => [r.cattle.tagNumber, r]),
      );
      // active view: a, b, g are open; c (recovered) is not
      expect(Object.keys(byCow).sort()).toEqual(
        [`${tag}-a`, `${tag}-b`, `${tag}-g`].sort(),
      );
      const a = byCow[`${tag}-a`];
      expect(a).toMatchObject({
        kind: 'CASE',
        healthCaseId: caseIdOf.a,
        planEnrollmentId: null,
        caseCode: `${tag}-a`,
        status: 'ACTIVE',
        currentStep: 1,
        totalSteps: 3,
        progressPercentage: 33,
      });
      // the soonest open step is the overdue one
      expect(a.nextStep.title).toBe('Overdue dose');
      expect(byCow[`${tag}-b`].nextStep.title).toBe('Later dose');
      expect(byCow[`${tag}-g`].nextStep).toBeNull();
    });

    it('status=all adds the finished ones', async () => {
      const res = await get(`/health/plans/${treatmentPlanId}/runs?status=all`);
      const tags = (res.body.data as Array<Record<string, any>>).map(
        (r) => r.cattle.tagNumber,
      );
      expect(tags).toContain(`${tag}-c`);
    });

    it('a prevention protocol lists enrollments, not cases', async () => {
      const res = await get(`/health/plans/${preventionPlanId}/runs`);
      const rows = res.body.data as Array<Record<string, any>>;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        kind: 'ENROLLMENT',
        healthCaseId: null,
        caseCode: null,
        status: 'ACTIVE',
        progressPercentage: 50,
      });
      expect(rows[0].planEnrollmentId).toEqual(expect.any(String));
      expect(rows[0].nextStep.title).toBe('Booster');
    });

    it('finds an animal by tag or name', async () => {
      const res = await get(
        `/health/plans/${treatmentPlanId}/runs?search=${tag}-b`,
      );
      expect(
        (res.body.data as Array<Record<string, any>>).map(
          (r) => r.cattle.tagNumber,
        ),
      ).toEqual([`${tag}-b`]);
      const byName = await get(
        `/health/plans/${treatmentPlanId}/runs?search=Cow a`,
      );
      expect(byName.body.data).toHaveLength(1);
    });

    it('pages with a cursor', async () => {
      const first = await get(
        `/health/plans/${treatmentPlanId}/runs?limit=2&sortOrder=asc`,
      );
      expect(first.body.data).toHaveLength(2);
      expect(first.body.meta.hasNextPage).toBe(true);
      const second = await get(
        `/health/plans/${treatmentPlanId}/runs?limit=2&sortOrder=asc&cursor=${encodeURIComponent(first.body.meta.endCursor)}`,
      );
      expect(second.body.data).toHaveLength(1);
      const all = [...first.body.data, ...second.body.data].map(
        (r: { id: string }) => r.id,
      );
      expect(new Set(all).size).toBe(3);
    });

    it('still answers for an archived protocol, so its animals stay visible', async () => {
      const res = await get(`/health/plans/${archivedPlanId}/runs`);
      expect(res.body.data).toHaveLength(1);
    });

    it('404 for an unknown protocol', async () => {
      await request(server())
        .get(api('/health/plans/does-not-exist/runs'))
        .set(...auth(owner))
        .expect(404);
    });

    it('is readable by a worker, and rejects a bad status', async () => {
      await get(`/health/plans/${treatmentPlanId}/runs`, worker);
      await request(server())
        .get(api(`/health/plans/${treatmentPlanId}/runs?status=whatever`))
        .set(...auth(owner))
        .expect(400);
    });
  });

  describe('GET /health/tasks — filters', () => {
    const tasksOf = (rows: Array<Record<string, any>>) =>
      rows.filter((r) => String(r.taskCode).startsWith(tag));

    it('filters by protocol and includes the protocol and the case', async () => {
      const res = await get(
        `/health/tasks?healthPlanId=${treatmentPlanId}&limit=100`,
      );
      const rows = tasksOf(res.body.data);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.healthPlan).toEqual({
          id: treatmentPlanId,
          name: `${tag} treatment`,
        });
        expect(row.healthCase).toMatchObject({ id: expect.any(String) });
      }
    });

    it('statuses is a list: "still to do" excludes completed steps', async () => {
      const res = await get(
        `/health/tasks?healthPlanId=${treatmentPlanId}&statuses=PENDING,RESCHEDULED,OVERDUE&limit=100`,
      );
      const titles = tasksOf(res.body.data).map((r) => r.title);
      expect(titles).not.toContain('Done dose');
      expect(titles).toContain('Overdue dose');
    });

    it('rejects an unknown status in the list', async () => {
      await request(server())
        .get(api('/health/tasks?statuses=PENDING,NOPE'))
        .set(...auth(owner))
        .expect(400);
    });

    it('noPlan returns only the steps that belong to no protocol', async () => {
      const res = await get('/health/tasks?noPlan=true&limit=100');
      const rows = tasksOf(res.body.data);
      expect(rows.map((r) => r.title)).toEqual(['Loose step']);
      expect(rows[0].healthPlan).toBeNull();
    });

    it('dueTo keeps steps up to and including that farm day, overdue ones too', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await get(
        `/health/tasks?healthPlanId=${treatmentPlanId}&dueTo=${today}&limit=100`,
      );
      const titles = tasksOf(res.body.data).map((r) => r.title);
      expect(titles).toContain('Overdue dose');
      expect(titles).not.toContain('Later dose'); // 5 days out
    });

    it('dueTo must be a YYYY-MM-DD day', async () => {
      await request(server())
        .get(api('/health/tasks?dueTo=tomorrow'))
        .set(...auth(owner))
        .expect(400);
    });

    it('sortBy=due&sortOrder=asc is soonest first; the default order is unchanged', async () => {
      const due = await get(
        `/health/tasks?healthPlanId=${treatmentPlanId}&sortBy=due&sortOrder=asc&limit=100`,
      );
      const times = tasksOf(due.body.data).map((r) =>
        new Date(r.dueDateTime).getTime(),
      );
      expect(times).toEqual([...times].sort((x, y) => x - y));

      const plain = await get(
        `/health/tasks?healthPlanId=${treatmentPlanId}&limit=100`,
      );
      const created = tasksOf(plain.body.data).map((r) =>
        new Date(r.createdAt).getTime(),
      );
      expect(created).toEqual([...created].sort((x, y) => y - x));
    });

    it('with none of the new parameters it behaves as before', async () => {
      const res = await get('/health/tasks?limit=5');
      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.meta).toHaveProperty('hasNextPage');
    });

    it('is readable by a worker', async () => {
      await get(`/health/tasks?healthPlanId=${treatmentPlanId}`, worker);
    });
  });

  describe('GET /health/sick-bay — withdrawalDaysLeft', () => {
    it('a case with a running hold carries the longer of milk / meat days left', async () => {
      const res = await get(`/health/sick-bay?search=${tag}-g&limit=50`);
      const row = (res.body.data as Array<Record<string, any>>).find(
        (r) => r.id === caseIdOf.g,
      );
      expect(row).toBeDefined();
      expect(row?.withdrawalDaysLeft).toBe(6);
      // the raw include is not leaked into the row
      expect(row).not.toHaveProperty('safetyWithdrawals');
    });

    it('a case with no hold has null — not 0', async () => {
      const res = await get(`/health/sick-bay?search=${tag}-a&limit=50`);
      const row = (res.body.data as Array<Record<string, any>>).find(
        (r) => r.id === caseIdOf.a,
      );
      expect(row?.withdrawalDaysLeft).toBeNull();
    });

    it('a released hold no longer counts', async () => {
      await prisma.safetyWithdrawal.updateMany({
        where: { healthCaseId: caseIdOf.g },
        data: { status: 'RELEASED' },
      });
      const res = await get(`/health/sick-bay?search=${tag}-g&limit=50`);
      const row = (res.body.data as Array<Record<string, any>>).find(
        (r) => r.id === caseIdOf.g,
      );
      expect(row?.withdrawalDaysLeft).toBeNull();
    });
  });
});

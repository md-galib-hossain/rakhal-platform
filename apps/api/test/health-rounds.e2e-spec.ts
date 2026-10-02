import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-471 + RAKHAL-472 (MILESTONE 29d, Protocol Rounds — Phase 2).
 *  - `GET /health/rounds`              : one row per round (a real `PlanApplication`, or treatment cases grouped by
 *                                        protocol + the day the protocol was applied), with live step counts.
 *  - `GET /health/rounds/:key/grid`    : the cow × step grid of one round, paged by animal.
 * Fixture (all found through a per-run tag, so the shared dev DB's other protocols never interfere):
 *   treatment plan T:  round R1 (today)   cows a, b   — a: step 1 due today, b: step 1 3 days late
 *                      round R2 (3d ago)  cow  d      — everything done / skipped  → FINISHED
 *   prevention plan P: round A1           cows e, f, g — e: due today, f: 1 done, g SOLD with a late step (not live)
 *                      round A2           cow  h      — completed round            → FINISHED
 */
describe('Health — protocol rounds list + grid (RAKHAL-471/472)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerId: string;
  const tag = `E2E-ROUNDS-${Date.now()}`;
  const DAY = 24 * 60 * 60 * 1000;
  const inDays = (n: number) => new Date(Date.now() + n * DAY);

  const cattleIds: string[] = [];
  const planIds: string[] = [];
  const cow: Record<string, string> = {};
  let treatmentPlanId: string;
  let preventionPlanId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const get = (path: string, user: AuthedUser = owner) =>
    request(server())
      .get(api(path))
      .set(...auth(user));

  interface RoundDto {
    roundKey: string;
    healthPlan: { id: string };
    kind: string;
    startDate: string;
    animalCount: number;
    stepsTotal: number;
    stepsDone: number;
    stepsSkipped: number;
    stepsOverdue: number;
    stepsDueToday: number;
    nextDueDate: string | null;
    status: string;
  }
  const rounds = async (qs = ''): Promise<RoundDto[]> =>
    (await get(`/health/rounds?search=${tag}${qs}`).expect(200)).body
      .data as RoundDto[];

  async function makeCow(s: string, extra: Record<string, unknown> = {}) {
    const created = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `${tag}-${s}`,
        name: `Cow ${s}`,
        gender: 'FEMALE',
        createdBy: ownerId,
        ...extra,
      } as never,
    });
    cattleIds.push(created.id);
    cow[s] = created.id;
  }
  const makeCase = (s: string, planId: string) =>
    prisma.healthCase.create({
      data: {
        farmId: owner.farmId,
        cattleId: cow[s],
        caseCode: `${tag}-${s}`,
        careType: 'CURATIVE',
        priority: 'MEDIUM',
        status: 'ACTIVE',
        healthPlanId: planId,
        startDate: inDays(-1),
      } as never,
    });
  const makeTask = (data: Record<string, unknown>) =>
    prisma.healthTask.create({
      data: {
        farmId: owner.farmId,
        taskType: 'MEDICINE',
        taskCode: `${tag}-${Math.random().toString(36).slice(2)}`,
        status: 'PENDING',
        ...data,
      } as never,
    });
  const due = (days: number) => ({
    taskDate: inDays(days),
    dueDateTime: inDays(days),
  });
  const enroll = (
    s: string,
    applicationId: string,
    planId: string,
    status: 'ACTIVE' | 'COMPLETED' = 'ACTIVE',
  ) =>
    prisma.planEnrollment.create({
      data: {
        farmId: owner.farmId,
        cattleId: cow[s],
        healthPlanId: planId,
        planApplicationId: applicationId,
        status,
        startDate: inDays(-1),
        totalSteps: 2,
      },
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
    const steps = [
      { dayNumber: 0, title: 'Dose', actionType: 'MEDICINE' },
      { dayNumber: 2, title: 'Booster', actionType: 'MEDICINE' },
    ];
    treatmentPlanId = await mk({
      name: `${tag} treatment`,
      category: 'TREATMENT',
      planType: 'MEDICAL',
      steps,
    });
    preventionPlanId = await mk({
      name: `${tag} vaccine`,
      category: 'VACCINATION',
      planType: 'PREVENTION',
      steps,
    });

    for (const s of ['a', 'b', 'd', 'e', 'f', 'h']) await makeCow(s);
    await makeCow('g', { herdStatus: 'SOLD' });

    // ── treatment R1 (today): a and b ──────────────────────────────────────
    const caseA = await makeCase('a', treatmentPlanId);
    const caseB = await makeCase('b', treatmentPlanId);
    for (const [c, s, days] of [
      [caseA, 'a', 0],
      [caseB, 'b', -3],
    ] as const) {
      await makeTask({
        cattleId: cow[s],
        healthCaseId: c.id,
        healthPlanId: treatmentPlanId,
        stepNumber: 1,
        title: 'Dose',
        ...due(days),
      });
      await makeTask({
        cattleId: cow[s],
        healthCaseId: c.id,
        healthPlanId: treatmentPlanId,
        stepNumber: 2,
        title: 'Booster',
        ...due(2),
      });
    }
    // ── treatment R2 (applied 3 days ago): d, nothing left to do ───────────
    const caseD = await makeCase('d', treatmentPlanId);
    const threeDaysAgo = inDays(-3);
    await makeTask({
      cattleId: cow.d,
      healthCaseId: caseD.id,
      healthPlanId: treatmentPlanId,
      stepNumber: 1,
      title: 'Dose',
      status: 'COMPLETED',
      completedAt: threeDaysAgo,
      createdAt: threeDaysAgo,
      ...due(-3),
    });
    await makeTask({
      cattleId: cow.d,
      healthCaseId: caseD.id,
      healthPlanId: treatmentPlanId,
      stepNumber: 2,
      title: 'Booster',
      status: 'SKIPPED',
      createdAt: threeDaysAgo,
      ...due(-1),
    });

    // ── prevention A1: e (due today), f (1 done), g (sold, late step) ──────
    const app1 = await prisma.planApplication.create({
      data: {
        farmId: owner.farmId,
        healthPlanId: preventionPlanId,
        startDate: inDays(-1),
        appliedBy: ownerId,
        animalCount: 3,
      },
    });
    const enrE = await enroll('e', app1.id, preventionPlanId);
    const enrF = await enroll('f', app1.id, preventionPlanId);
    const enrG = await enroll('g', app1.id, preventionPlanId);
    const prev = (enr: { id: string }, s: string) => ({
      cattleId: cow[s],
      planEnrollmentId: enr.id,
      healthPlanId: preventionPlanId,
    });
    await makeTask({
      ...prev(enrE, 'e'),
      stepNumber: 1,
      title: 'Dose',
      ...due(0),
    });
    await makeTask({
      ...prev(enrE, 'e'),
      stepNumber: 2,
      title: 'Booster',
      ...due(5),
    });
    await makeTask({
      ...prev(enrF, 'f'),
      stepNumber: 1,
      title: 'Dose',
      status: 'COMPLETED',
      completedAt: inDays(-1),
      ...due(-1),
    });
    await makeTask({
      ...prev(enrF, 'f'),
      stepNumber: 2,
      title: 'Booster',
      ...due(5),
    });
    await makeTask({
      ...prev(enrG, 'g'),
      stepNumber: 1,
      title: 'Dose',
      ...due(-2),
    });
    await makeTask({
      ...prev(enrG, 'g'),
      stepNumber: 2,
      title: 'Booster',
      ...due(5),
    });

    // ── prevention A2: h, completed round ──────────────────────────────────
    const app2 = await prisma.planApplication.create({
      data: {
        farmId: owner.farmId,
        healthPlanId: preventionPlanId,
        startDate: inDays(-10),
        appliedBy: ownerId,
        animalCount: 1,
      },
    });
    const enrH = await enroll('h', app2.id, preventionPlanId, 'COMPLETED');
    for (const [n, title] of [
      [1, 'Dose'],
      [2, 'Booster'],
    ] as const) {
      await makeTask({
        ...prev(enrH, 'h'),
        stepNumber: n,
        title,
        status: 'COMPLETED',
        completedAt: inDays(-9),
        ...due(-9),
      });
    }
  }, 90_000);

  afterAll(async () => {
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

  /** The round of one protocol in one status (the fixture has exactly one of each). */
  const roundOf = (list: RoundDto[], planId: string, status: string) =>
    list.find((r) => r.healthPlan.id === planId && r.status === status)!;

  describe('GET /health/rounds (RAKHAL-471)', () => {
    it('derives 4 rounds: two treatment (by the day the protocol was applied) and two preventive', async () => {
      const list = await rounds();
      expect(list).toHaveLength(4);
      expect(list.filter((r) => r.kind === 'TREATMENT')).toHaveLength(2);
      expect(list.filter((r) => r.kind === 'PREVENTION')).toHaveLength(2);
      expect(list.some((r) => r.roundKey.startsWith('app:'))).toBe(true);
      expect(
        list.filter((r) => r.roundKey.startsWith(`trt:${treatmentPlanId}:`)),
      ).toHaveLength(2);
    });

    it('the treatment round of today has 2 animals and live counts', async () => {
      const r1 = roundOf(await rounds(), treatmentPlanId, 'RUNNING');
      expect(r1).toMatchObject({
        animalCount: 2,
        stepsTotal: 4,
        stepsDone: 0,
        stepsSkipped: 0,
        stepsOverdue: 1, // b's step 1
        stepsDueToday: 1, // a's step 1
        status: 'RUNNING',
      });
      expect(r1.nextDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('the earlier treatment round is its own round, and finished', async () => {
      const r2 = roundOf(await rounds(), treatmentPlanId, 'FINISHED');
      expect(r2).toMatchObject({
        animalCount: 1,
        stepsTotal: 1, // the skipped step is not a step to do
        stepsDone: 1,
        stepsSkipped: 1,
        stepsOverdue: 0,
        nextDueDate: null,
      });
      const r1 = roundOf(await rounds(), treatmentPlanId, 'RUNNING');
      expect(r1.startDate > r2.startDate).toBe(true);
    });

    it('a preventive round counts only live steps: a sold animal is not overdue', async () => {
      const a1 = roundOf(await rounds(), preventionPlanId, 'RUNNING');
      expect(a1).toMatchObject({
        animalCount: 3,
        stepsTotal: 6,
        stepsDone: 1,
        stepsOverdue: 0, // g is SOLD
        stepsDueToday: 1, // e
        status: 'RUNNING',
      });
    });

    it('a completed preventive round is FINISHED', async () => {
      const a2 = roundOf(await rounds(), preventionPlanId, 'FINISHED');
      expect(a2).toMatchObject({
        animalCount: 1,
        stepsTotal: 2,
        stepsDone: 2,
        nextDueDate: null,
      });
    });

    it('filters by status, kind, protocol and search', async () => {
      expect(await rounds('&status=RUNNING')).toHaveLength(2);
      expect(await rounds('&status=FINISHED')).toHaveLength(2);
      expect(await rounds('&kind=TREATMENT')).toHaveLength(2);
      expect(await rounds('&kind=PREVENTION')).toHaveLength(2);
      expect(await rounds(`&healthPlanId=${treatmentPlanId}`)).toHaveLength(2);
      const none = (
        await get('/health/rounds?search=zzz-no-such-protocol').expect(200)
      ).body.data as unknown[];
      expect(none).toEqual([]);
    });

    it('newest round first, and oldest first with sortOrder=asc', async () => {
      const desc = (await rounds()).map((r) => r.startDate);
      expect([...desc].sort().reverse()).toEqual(desc);
      const asc = (await rounds('&sortOrder=asc')).map((r) => r.startDate);
      expect([...asc].sort()).toEqual(asc);
    });

    it('pages with a cursor: every round exactly once', async () => {
      const seen: string[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 6; page += 1) {
        const res = await get(
          `/health/rounds?search=${tag}&limit=1${cursor ? `&cursor=${cursor}` : ''}`,
        ).expect(200);
        seen.push(...(res.body.data as RoundDto[]).map((r) => r.roundKey));
        if (!res.body.meta.hasNextPage) break;
        cursor = res.body.meta.endCursor as string;
      }
      expect(seen).toHaveLength(4);
      expect(new Set(seen).size).toBe(4);
    });

    it('rejects a bad filter value', async () => {
      await get('/health/rounds?status=MAYBE').expect(400);
      await get('/health/rounds?kind=NOPE').expect(400);
    });

    it('a worker can read', async () => {
      await get(`/health/rounds?search=${tag}`, worker).expect(200);
    });
  });

  describe('GET /health/rounds/:roundKey/grid (RAKHAL-472)', () => {
    interface GridBody {
      data: {
        round: RoundDto;
        columns: Array<{
          key: string;
          dayNumber: number | null;
          title: string;
        }>;
        rows: Array<{
          runKey: string;
          runType: string;
          healthCaseId: string | null;
          planEnrollmentId: string | null;
          cattle: { name: string };
          dueCount: number;
          overdueCount: number;
          cells: Record<string, { state: string; taskId: string }>;
        }>;
      };
      meta: { count: number; hasNextPage: boolean; endCursor: string };
    }
    const gridOf = async (roundKey: string, qs = ''): Promise<GridBody> =>
      (
        await get(
          `/health/rounds/${encodeURIComponent(roundKey)}/grid${qs}`,
        ).expect(200)
      ).body as GridBody;

    it('treatment round: columns from the protocol, most urgent animal first, a cell per step', async () => {
      const r1 = roundOf(await rounds(), treatmentPlanId, 'RUNNING');
      const { data } = await gridOf(r1.roundKey);
      expect(data.columns.map((c) => [c.dayNumber, c.title])).toEqual([
        [0, 'Dose'],
        [2, 'Booster'],
      ]);
      expect(data.rows.map((r) => r.cattle.name)).toEqual(['Cow b', 'Cow a']);
      expect(data.rows[0].cells.s1.state).toBe('overdue');
      expect(data.rows[0].cells.s2.state).toBe('upcoming');
      expect(data.rows[1].cells.s1.state).toBe('today');
      expect(data.rows[0]).toMatchObject({
        runType: 'CASE',
        planEnrollmentId: null,
        dueCount: 1,
        overdueCount: 1,
      });
      expect(data.rows[0].healthCaseId).toBeTruthy();
    });

    it("the header carries the round's own counts, equal to the grid's red and amber cells", async () => {
      for (const [planId, status] of [
        [treatmentPlanId, 'RUNNING'],
        [preventionPlanId, 'RUNNING'],
      ] as const) {
        const round = roundOf(await rounds(), planId, status);
        const { data } = await gridOf(round.roundKey);
        const cells = data.rows.flatMap((r) => Object.values(r.cells));
        expect(data.round).toMatchObject({
          roundKey: round.roundKey,
          stepsOverdue: round.stepsOverdue,
          stepsDueToday: round.stepsDueToday,
          animalCount: round.animalCount,
        });
        expect(cells.filter((c) => c.state === 'overdue')).toHaveLength(
          round.stepsOverdue,
        );
        expect(cells.filter((c) => c.state === 'today')).toHaveLength(
          round.stepsDueToday,
        );
      }
    });

    it('preventive round: a sold animal shows its late step as inactive, not overdue', async () => {
      const a1 = roundOf(await rounds(), preventionPlanId, 'RUNNING');
      const { data } = await gridOf(a1.roundKey);
      const g = data.rows.find((r) => r.cattle.name === 'Cow g')!;
      expect(g.cells.s1.state).toBe('inactive');
      expect(g.overdueCount).toBe(0);
      const f = data.rows.find((r) => r.cattle.name === 'Cow f')!;
      expect(f.cells.s1.state).toBe('done');
    });

    it('dueOnly keeps just the animals with something due or late', async () => {
      const a1 = roundOf(await rounds(), preventionPlanId, 'RUNNING');
      const { data } = await gridOf(a1.roundKey, '?dueOnly=true');
      expect(data.rows.map((r) => r.cattle.name)).toEqual(['Cow e']);
    });

    it('pages by animal with a cursor', async () => {
      const a1 = roundOf(await rounds(), preventionPlanId, 'RUNNING');
      const seen: string[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 5; page += 1) {
        const res = await gridOf(
          a1.roundKey,
          `?limit=1${cursor ? `&cursor=${cursor}` : ''}`,
        );
        seen.push(...res.data.rows.map((r) => r.runKey));
        if (!res.meta.hasNextPage) break;
        cursor = res.meta.endCursor;
      }
      expect(seen).toHaveLength(3);
      expect(new Set(seen).size).toBe(3);
    });

    it('an unknown, malformed or foreign key is a 404', async () => {
      await get('/health/rounds/nonsense/grid').expect(404);
      await get('/health/rounds/app:does-not-exist/grid').expect(404);
      await get(
        `/health/rounds/${encodeURIComponent(`trt:${treatmentPlanId}:2001-01-01`)}/grid`,
      ).expect(404);
      await get(
        `/health/rounds/${encodeURIComponent('trt:no-such-plan:2026-10-02')}/grid`,
      ).expect(404);
    });

    it('a worker can read the grid', async () => {
      const a1 = roundOf(await rounds(), preventionPlanId, 'RUNNING');
      await get(
        `/health/rounds/${encodeURIComponent(a1.roundKey)}/grid`,
        worker,
      ).expect(200);
    });

    it('an animal taken off the protocol disappears from the grid and the count', async () => {
      const a1 = roundOf(await rounds(), preventionPlanId, 'RUNNING');
      const before = await gridOf(a1.roundKey);
      const enrollmentId = before.data.rows.find(
        (r) => r.cattle.name === 'Cow e',
      )!.planEnrollmentId;
      await request(server())
        .post(api(`/cattle/${cow.e}/protocols/stop`))
        .set(...auth(owner))
        .send({ planEnrollmentId: enrollmentId })
        .expect(200);

      const after = await gridOf(a1.roundKey);
      expect(after.data.rows.map((r) => r.cattle.name)).not.toContain('Cow e');
      expect(after.data.round.animalCount).toBe(2);
      const again = roundOf(await rounds(), preventionPlanId, 'RUNNING');
      expect(again.animalCount).toBe(2);
      expect(again.stepsDueToday).toBe(0);
    });
  });

  describe('POST /health/rounds/:roundKey/animals (RAKHAL-473)', () => {
    const post = (
      roundKey: string,
      body: Record<string, unknown>,
      user: AuthedUser = owner,
    ) =>
      request(server())
        .post(api(`/health/rounds/${encodeURIComponent(roundKey)}/animals`))
        .set(...auth(user))
        .send(body);
    const grid = async (roundKey: string) =>
      (
        await get(`/health/rounds/${encodeURIComponent(roundKey)}/grid`).expect(
          200,
        )
      ).body.data as {
        round: RoundDto;
        rows: Array<{
          runType: string;
          cattle: { name: string };
          cells: Record<string, { state: string }>;
        }>;
      };

    it('preventive round: new enrollments join the SAME round; steps already past are due now', async () => {
      await makeCow('i');
      const a1 = roundOf(await rounds(), preventionPlanId, 'RUNNING');
      const res = await post(a1.roundKey, { cattleIds: [cow.i] }).expect(201);
      expect(res.body.data).toMatchObject({
        roundKey: a1.roundKey,
        addedCount: 1,
        skippedCount: 0,
      });
      expect(res.body.data.results[0]).toMatchObject({
        cattleId: cow.i,
        status: 'applied',
      });
      expect(res.body.data.results[0].planEnrollmentId).toBeTruthy();

      const g = await grid(a1.roundKey);
      const added = g.rows.find((r) => r.cattle.name === 'Cow i')!;
      expect(added.runType).toBe('ENROLLMENT');
      // the protocol started yesterday, but the new animal's steps are not back-dated into history
      expect(Object.values(added.cells).map((c) => c.state)).toEqual([
        'today',
        'today',
      ]);
      expect(g.round.animalCount).toBe(a1.animalCount + 1);
      // still one round, not a new one
      expect(
        (await rounds()).filter((r) => r.roundKey === a1.roundKey),
      ).toHaveLength(1);
      expect(await rounds()).toHaveLength(4);
    });

    it('an animal already on the protocol is skipped, never duplicated', async () => {
      const a1 = roundOf(await rounds(), preventionPlanId, 'RUNNING');
      const res = await post(a1.roundKey, { cattleIds: [cow.i, cow.f] }).expect(
        201,
      );
      expect(res.body.data).toMatchObject({ addedCount: 0, skippedCount: 2 });
      expect(
        (res.body.data.results as Array<{ status: string }>).every(
          (r) => r.status === 'skipped',
        ),
      ).toBe(true);
      const enrolled = await prisma.planEnrollment.count({
        where: {
          cattleId: cow.i,
          healthPlanId: preventionPlanId,
          deletedAt: null,
        },
      });
      expect(enrolled).toBe(1);
    });

    it('treatment round: new cases land in the same derived round', async () => {
      await makeCow('k');
      const r1 = roundOf(await rounds(), treatmentPlanId, 'RUNNING');
      const res = await post(r1.roundKey, { cattleIds: [cow.k] }).expect(201);
      expect(res.body.data).toMatchObject({ addedCount: 1, skippedCount: 0 });
      expect(res.body.data.results[0].healthCaseId).toBeTruthy();

      const after = await rounds();
      expect(after).toHaveLength(4); // no new round was created
      const r1After = after.find((r) => r.roundKey === r1.roundKey)!;
      expect(r1After.animalCount).toBe(r1.animalCount + 1);
      const g = await grid(r1.roundKey);
      const added = g.rows.find((r) => r.cattle.name === 'Cow k')!;
      expect(added.runType).toBe('CASE');
      expect(
        Object.values(added.cells).every(
          (c) => c.state === 'today' || c.state === 'upcoming',
        ),
      ).toBe(true);
    });

    it('an animal with an open case on the protocol is skipped', async () => {
      const r1 = roundOf(await rounds(), treatmentPlanId, 'RUNNING');
      const res = await post(r1.roundKey, { cattleIds: [cow.a] }).expect(201);
      expect(res.body.data).toMatchObject({ addedCount: 0, skippedCount: 1 });
    });

    it('a bad cattle id fails the whole call with nothing written', async () => {
      await makeCow('m');
      const a1 = roundOf(await rounds(), preventionPlanId, 'RUNNING');
      await post(a1.roundKey, { cattleIds: [cow.m, 'no-such-cow'] }).expect(
        404,
      );
      expect(
        await prisma.planEnrollment.count({ where: { cattleId: cow.m } }),
      ).toBe(0);
    });

    it('validates the body: needs 1 to 100 ids', async () => {
      const a1 = roundOf(await rounds(), preventionPlanId, 'RUNNING');
      await post(a1.roundKey, {}).expect(400);
      await post(a1.roundKey, { cattleIds: [] }).expect(400);
      await post(a1.roundKey, {
        cattleIds: Array.from({ length: 101 }, (_, n) => `c${n}`),
      }).expect(400);
    });

    it('an unknown, malformed or memberless round key is a 404', async () => {
      await post('nonsense', { cattleIds: [cow.m] }).expect(404);
      await post('app:does-not-exist', { cattleIds: [cow.m] }).expect(404);
      await post(`trt:${treatmentPlanId}:2001-01-01`, {
        cattleIds: [cow.m],
      }).expect(404);
    });

    it('is manager+ only', async () => {
      const a1 = roundOf(await rounds(), preventionPlanId, 'RUNNING');
      await post(a1.roundKey, { cattleIds: [cow.m] }, worker).expect(403);
    });
  });

  describe('GET /health/plans/:id (the round sheet reads one protocol)', () => {
    it('returns the protocol with its steps and live stats', async () => {
      const res = await get(`/health/plans/${treatmentPlanId}`).expect(200);
      expect(res.body.data).toMatchObject({
        id: treatmentPlanId,
        stats: { kind: 'TREATMENT', appliedTo: 4 },
      });
      expect(
        (res.body.data.steps as Array<{ title: string }>).map((s) => s.title),
      ).toEqual(['Dose', 'Booster']);
    });

    it('still returns an archived protocol (a round of it can still be running)', async () => {
      await request(server())
        .delete(api(`/health/plans/${treatmentPlanId}`))
        .set(...auth(owner))
        .expect(200);
      const res = await get(`/health/plans/${treatmentPlanId}`).expect(200);
      expect(res.body.data.deletedAt).not.toBeNull();
      // open cases on the protocol (a, b, d and k — d's steps are all done but its case is still open; k was added to the round above)
      expect(res.body.data.stats.inProgress).toBe(4);
    });

    it('animals cannot be added to a round of a deleted protocol', async () => {
      const r1 = (await rounds()).find(
        (r) =>
          r.roundKey.startsWith(`trt:${treatmentPlanId}:`) &&
          r.status === 'RUNNING',
      )!;
      await request(server())
        .post(api(`/health/rounds/${encodeURIComponent(r1.roundKey)}/animals`))
        .set(...auth(owner))
        .send({ cattleIds: [cow.m] })
        .expect(400);
    });

    it('404s for an unknown protocol', async () => {
      await get('/health/plans/does-not-exist').expect(404);
    });
  });
});

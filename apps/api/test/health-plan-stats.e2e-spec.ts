import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-466 + RAKHAL-468 (MILESTONE 29).
 *  - 466: every plan on `GET /health/plans` carries live `stats` (treatment → recovery rate; prevention → coverage
 *    rate, steps due), computed from the cases/enrollments that used it; the dead `successRate` /
 *    `currentlyActiveAnimalCount` columns are gone.
 *  - 468: `HealthPlan.condition` (optional structured condition) round-trips through create/update and filters
 *    `GET /health/plans?condition=`.
 * Plans are looked up by a per-run unique name (`search=`), so the shared dev DB's other protocols never interfere.
 */
describe('Health — protocol stats + condition (RAKHAL-466 / 468)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerId: string;
  const tag = `E2E-RAKHAL466-${Date.now()}`;
  const DAY = 24 * 60 * 60 * 1000;
  const inDays = (n: number) => new Date(Date.now() + n * DAY);

  const cattleIds: string[] = [];
  const planIds: string[] = [];
  let treatmentPlanId: string;
  let preventionPlanId: string;
  let unusedPlanId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  async function listPlans(qs: string) {
    const res = await request(server())
      .get(api(`/health/plans?${qs}`))
      .set(...auth(owner))
      .expect(200);
    return res.body.data as Array<Record<string, any>>;
  }

  async function makeCow(s: string) {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `${tag}-${s}`,
        gender: 'FEMALE',
        createdBy: ownerId,
      },
    });
    cattleIds.push(cow.id);
    return cow.id;
  }

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
      return res.body.data;
    };
    const step = [{ dayNumber: 0, title: 'Dose', actionType: 'MEDICINE' }];
    treatmentPlanId = (
      await mk({
        name: `${tag} treatment`,
        category: 'TREATMENT',
        planType: 'MEDICAL',
        condition: 'MASTITIS',
        steps: step,
      })
    ).id;
    preventionPlanId = (
      await mk({
        name: `${tag} vaccine`,
        category: 'VACCINATION',
        planType: 'PREVENTION',
        steps: step,
      })
    ).id;
    unusedPlanId = (
      await mk({
        name: `${tag} unused`,
        category: 'TREATMENT',
        planType: 'MEDICAL',
        steps: step,
      })
    ).id;

    // treatment plan: 2 recovered, 1 died, 1 still open (4 different cows)
    const outcomes: Array<[string, string]> = [
      ['t1', 'RECOVERED'],
      ['t2', 'RECOVERED'],
      ['t3', 'MORTALITY'],
      ['t4', 'ACTIVE'],
    ];
    for (const [i, [s, status]] of outcomes.entries()) {
      const cattleId = await makeCow(s);
      await prisma.healthCase.create({
        data: {
          farmId: owner.farmId,
          cattleId,
          caseCode: `${tag}-${i}`,
          careType: 'CURATIVE',
          priority: 'MEDIUM',
          status,
          healthPlanId: treatmentPlanId,
          startDate: inDays(-10),
          closedDate: status === 'ACTIVE' ? null : inDays(-3),
        } as never,
      });
    }

    // prevention plan: one round, 3 enrollments (2 completed, 1 active) + 2 open steps for the active one
    const application = await prisma.planApplication.create({
      data: {
        farmId: owner.farmId,
        healthPlanId: preventionPlanId,
        startDate: inDays(-5),
        appliedBy: ownerId,
        animalCount: 3,
      },
    });
    const enrolled: string[] = [];
    for (const [s, status] of [
      ['p1', 'COMPLETED'],
      ['p2', 'COMPLETED'],
      ['p3', 'ACTIVE'],
    ] as const) {
      const cattleId = await makeCow(s);
      const enrollment = await prisma.planEnrollment.create({
        data: {
          farmId: owner.farmId,
          cattleId,
          healthPlanId: preventionPlanId,
          planApplicationId: application.id,
          startDate: inDays(-5),
          status,
        },
      });
      enrolled.push(enrollment.id);
    }
    const activeEnrollment = enrolled[2];
    const activeCow = cattleIds[cattleIds.length - 1];
    for (const [n, days] of [
      [0, 2], // due within a week → counts
      [1, 20], // far out → does not
    ] as const) {
      await prisma.healthTask.create({
        data: {
          farmId: owner.farmId,
          cattleId: activeCow,
          planEnrollmentId: activeEnrollment,
          healthPlanId: preventionPlanId,
          taskCode: `${tag}-task-${n}`,
          taskDate: inDays(days),
          dueDateTime: inDays(days),
          taskType: 'VACCINATION',
          title: 'Booster',
        },
      });
    }
  }, 40_000);

  afterAll(async () => {
    await prisma.healthTask.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.planEnrollment.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.planApplication.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.healthCase.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.healthPlanStep.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.healthPlan.deleteMany({ where: { id: { in: planIds } } });
    await prisma.cattle.deleteMany({ where: { id: { in: cattleIds } } });
    await ctx.app.close();
  });

  describe('RAKHAL-466 — stats on GET /health/plans', () => {
    it('a treatment protocol reports animals, open cases and its recovery rate', async () => {
      const [plan] = await listPlans(`search=${tag} treatment`);
      expect(plan.id).toBe(treatmentPlanId);
      expect(plan.stats).toMatchObject({
        kind: 'TREATMENT',
        appliedTo: 4,
        inProgress: 1,
        recovered: 2,
        mortality: 1,
        recoveryRate: 66.7, // 2 ÷ (2 + 1)
        completed: null,
        due: null,
        coverageRate: null,
      });
    });

    it('a prevention protocol reports enrollment, completion, steps due this week and coverage', async () => {
      const [plan] = await listPlans(`search=${tag} vaccine`);
      expect(plan.id).toBe(preventionPlanId);
      expect(plan.stats).toMatchObject({
        kind: 'PREVENTION',
        appliedTo: 3,
        inProgress: 1,
        completed: 2,
        due: 1, // the +2 day step; the +20 day one is not due yet
        coverageRate: 66.7, // 2 of 3 enrollments
        recovered: null,
        recoveryRate: null,
      });
    });

    it('a protocol nobody has used is zeros and null rates — never a fake 0 %', async () => {
      const [plan] = await listPlans(`search=${tag} unused`);
      expect(plan.stats).toMatchObject({
        appliedTo: 0,
        inProgress: 0,
        recoveryRate: null,
      });
    });

    it('keeps the cursor envelope and drops the dead columns', async () => {
      const res = await request(server())
        .get(api(`/health/plans?search=${tag}`))
        .set(...auth(owner))
        .expect(200);
      expect(res.body.meta).toMatchObject({ hasNextPage: false });
      expect(res.body.data).toHaveLength(3);
      for (const plan of res.body.data) {
        expect(plan).not.toHaveProperty('successRate');
        expect(plan).not.toHaveProperty('currentlyActiveAnimalCount');
        expect(Array.isArray(plan.steps)).toBe(true);
      }
    });

    it('is readable by a worker (healthcare.read)', async () => {
      await request(server())
        .get(api(`/health/plans?search=${tag}`))
        .set(...auth(worker))
        .expect(200);
    });
  });

  describe('RFE-136 — protocol on the cow health summary', () => {
    it('an active case reports the protocol it is on', async () => {
      // cattleIds[3] is the "t4" cow: one ACTIVE case on the treatment protocol.
      const res = await request(server())
        .get(api(`/cattle/${cattleIds[3]}/health-summary`))
        .set(...auth(owner))
        .expect(200);
      const cases = res.body.data.activeCases as Array<Record<string, any>>;
      expect(cases).toHaveLength(1);
      expect(cases[0].healthPlan).toEqual({
        id: treatmentPlanId,
        name: `${tag} treatment`,
      });
    });
  });

  describe('RAKHAL-468 — HealthPlan.condition', () => {
    it('is returned by create, and filters the list', async () => {
      const plans = await listPlans(`search=${tag}&condition=MASTITIS`);
      expect(plans.map((p) => p.id)).toEqual([treatmentPlanId]);
      expect(plans[0].condition).toBe('MASTITIS');

      const none = await listPlans(`search=${tag}&condition=LAMENESS`);
      expect(none).toHaveLength(0);
    });

    it('a protocol created without a condition has none', async () => {
      const [plan] = await listPlans(`search=${tag} vaccine`);
      expect(plan.condition).toBeNull();
    });

    it('can be set and cleared on update', async () => {
      await request(server())
        .patch(api(`/health/plans/${unusedPlanId}`))
        .set(...auth(owner))
        .send({ condition: 'LAMENESS' })
        .expect(200);
      expect(
        (await listPlans(`search=${tag}&condition=LAMENESS`)).map((p) => p.id),
      ).toEqual([unusedPlanId]);

      await request(server())
        .patch(api(`/health/plans/${unusedPlanId}`))
        .set(...auth(owner))
        .send({ condition: null })
        .expect(200);
      expect(await listPlans(`search=${tag}&condition=LAMENESS`)).toHaveLength(
        0,
      );
    });

    it('rejects a condition that is not one of the structured values', async () => {
      await request(server())
        .get(api('/health/plans?condition=NOPE'))
        .set(...auth(owner))
        .expect(400);
      await request(server())
        .post(api('/health/plans'))
        .set(...auth(owner))
        .send({
          name: `${tag} bad`,
          category: 'TREATMENT',
          planType: 'MEDICAL',
          condition: 'NOPE',
          steps: [{ dayNumber: 0, title: 'x', actionType: 'MEDICINE' }],
        })
        .expect(400);
    });
  });
});

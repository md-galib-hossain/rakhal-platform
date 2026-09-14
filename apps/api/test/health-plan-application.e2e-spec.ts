import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-415 — a preventive-category plan (`PREVENTION`/`VACCINATION`/`DEWORMING`/`ROUTINE`/
 * `BREEDING`) bulk-applied via `POST /health/plans/:id/apply` now writes a `PlanApplication`
 * round + one `PlanEnrollment` per animal — **no `HealthCase` at all** — instead of RAKHAL-414's
 * one-case-per-animal shape, which is now reserved for `TREATMENT`-category plans only (see
 * `test/health-plan-apply.e2e-spec.ts`, updated for the same reason).
 */
describe('Health — preventive plan application (RAKHAL-415)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let preventivePlanId: string;
  let cattleA: string;
  let cattleB: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });

    const stamp = Date.now();
    const makeCow = () =>
      prisma.cattle
        .create({
          data: {
            farmId: owner.farmId,
            tagNumber: `E2E-RAKHAL415-${stamp}-${Math.random().toString(36).slice(2, 7)}`,
            gender: 'FEMALE',
            createdBy: ownerUser.id,
          },
        })
        .then((c) => c.id);
    cattleA = await makeCow();
    cattleB = await makeCow();

    const planRes = await request(server())
      .post(api('/health/plans'))
      .set(...auth(owner))
      .send({
        name: `E2E-RAKHAL415-Plan-${stamp}`,
        category: 'VACCINATION',
        planType: 'PREVENTION',
        steps: [
          { dayNumber: 1, title: 'Primary dose', actionType: 'VACCINATION' },
          { dayNumber: 30, title: 'Booster', actionType: 'VACCINATION' },
        ],
      });
    expect(planRes.status).toBe(201);
    preventivePlanId = planRes.body.data.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('applies a preventive plan to multiple animals with NO HealthCase created', async () => {
    const res = await request(server())
      .post(api(`/health/plans/${preventivePlanId}/apply`))
      .set(...auth(owner))
      .send({ cattleIds: [cattleA, cattleB] });

    expect(res.status).toBe(201);
    expect(res.body.data.appliedCount).toBe(2);
    expect(res.body.data.skippedCount).toBe(0);
    expect(res.body.data.planApplicationId).toBeTruthy();
    expect(
      res.body.data.results.every(
        (r: { status: string; planEnrollmentId?: string }) =>
          r.status === 'applied' && Boolean(r.planEnrollmentId),
      ),
    ).toBe(true);

    const cases = await prisma.healthCase.count({
      where: { farmId: owner.farmId, healthPlanId: preventivePlanId },
    });
    expect(cases).toBe(0);

    const applications = await prisma.planApplication.findMany({
      where: { farmId: owner.farmId, healthPlanId: preventivePlanId },
    });
    expect(applications).toHaveLength(1);
    expect(applications[0].animalCount).toBe(2);

    const enrollments = await prisma.planEnrollment.findMany({
      where: {
        farmId: owner.farmId,
        healthPlanId: preventivePlanId,
        cattleId: { in: [cattleA, cattleB] },
      },
    });
    expect(enrollments).toHaveLength(2);
    for (const e of enrollments) {
      expect(e.status).toBe('ACTIVE');
      expect(e.totalSteps).toBe(2);
      expect(e.planApplicationId).toBe(applications[0].id);
    }

    const tasks = await prisma.healthTask.findMany({
      where: {
        farmId: owner.farmId,
        healthPlanId: preventivePlanId,
        cattleId: { in: [cattleA, cattleB] },
      },
    });
    expect(tasks).toHaveLength(4); // 2 steps x 2 animals
    for (const t of tasks) {
      expect(t.healthCaseId).toBeNull();
      expect(t.planEnrollmentId).toBeTruthy();
    }
  });

  it('re-applying the same preventive plan skips animals already ACTIVE-enrolled, writing nothing new', async () => {
    const before = await prisma.planEnrollment.count({
      where: { farmId: owner.farmId, healthPlanId: preventivePlanId },
    });

    const res = await request(server())
      .post(api(`/health/plans/${preventivePlanId}/apply`))
      .set(...auth(owner))
      .send({ cattleIds: [cattleA, cattleB] });

    expect(res.status).toBe(201);
    expect(res.body.data.appliedCount).toBe(0);
    expect(res.body.data.skippedCount).toBe(2);
    expect(res.body.data.planApplicationId).toBeNull();

    const after = await prisma.planEnrollment.count({
      where: { farmId: owner.farmId, healthPlanId: preventivePlanId },
    });
    expect(after).toBe(before);
  });

  it('GET /health/plan-applications returns the round grouped with its enrollments', async () => {
    const res = await request(server())
      .get(api(`/health/plan-applications?healthPlanId=${preventivePlanId}`))
      .set(...auth(owner));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1); // cursor page: `data` IS the items array
    const round = res.body.data[0];
    expect(round.healthPlanId).toBe(preventivePlanId);
    expect(round.animalCount).toBe(2);
    expect(round.enrollments).toHaveLength(2);
    expect(
      round.enrollments.every((e: { cattle: { tagNumber: string } }) =>
        Boolean(e.cattle?.tagNumber),
      ),
    ).toBe(true);
  });

  it('a preventive plan application never appears in Sick Bay', async () => {
    const res = await request(server())
      .get(api(`/health/sick-bay?search=E2E-RAKHAL415`))
      .set(...auth(owner));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0); // cursor page: `data` IS the items array
  });

  it('completing a preventive-round task updates its PlanEnrollment progress without a HealthCase', async () => {
    const task = await prisma.healthTask.findFirstOrThrow({
      where: {
        farmId: owner.farmId,
        healthPlanId: preventivePlanId,
        cattleId: cattleA,
        stepNumber: 1,
      },
    });
    expect(task.healthCaseId).toBeNull();

    const res = await request(server())
      .post(api(`/health/tasks/${task.id}/complete`))
      .set(...auth(owner));
    expect(res.status).toBe(201);

    const enrollment = await prisma.planEnrollment.findFirstOrThrow({
      where: {
        farmId: owner.farmId,
        healthPlanId: preventivePlanId,
        cattleId: cattleA,
      },
    });
    expect(enrollment.currentStep).toBe(1);
    expect(enrollment.totalSteps).toBe(2);
    expect(enrollment.progressPercentage).toBe(50);
    expect(enrollment.status).toBe('ACTIVE'); // 1 of 2 steps — not complete yet
  });
});

import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { seededCashAccountId } from './utils/finance';

/**
 * RD-093 — `POST /health/tasks/:id/log-treatment`: once RAKHAL-415 made a preventive-round
 * `HealthTask` caseless (`planEnrollmentId` set, `healthCaseId` null), the only route to complete
 * one was the plain `completeTask` — no medicine, no stock decrement, no cost. This route closes
 * that gap. Covers: stock decrement + cost/financialAccountId gating (mirrors `logTreatment`'s own
 * rules), the backing `HealthCase` this route creates carries `careType: PREVENTIVE` so the animal
 * never reads as SICK despite having an open case, PlanEnrollment progress advances, a case-scoped
 * task is rejected with a message pointing at the real route, and Safety Withdrawal still fires.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Health — log a real treatment against a caseless PlanEnrollment task (RD-093)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let financialAccountId: string;

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
    ownerUserId = ownerUser.id;
    financialAccountId = await seededCashAccountId(ctx, owner);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createCow() {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-RD093-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        productionStatus: 'MILKING',
        createdBy: ownerUserId,
      },
    });
    return cow.id;
  }

  async function createMedicine(costPerUnit: number) {
    const now = new Date();
    const med = await prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: `E2E RD-093 Medicine ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'LIQUID',
        category: 'ANTIPARASITIC',
        unitId: 'unit_bottle',
        currentStock: 50,
        costPerUnit,
        milkWithdrawalDays: 3,
        meatWithdrawalDays: 5,
        purchaseDate: now,
        expiryDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        createdBy: ownerUserId,
      },
    });
    return med.id;
  }

  /** Applies a 1-step preventive plan (with the given medicine prefilled on the step) to one cow
   * and returns the resulting caseless task's id. */
  async function createCaselessTask(cattleId: string, medicineId: string) {
    const planRes = await request(server())
      .post(api('/health/plans'))
      .set(...auth(owner))
      .send({
        name: `E2E RD-093 Plan ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        category: 'DEWORMING',
        planType: 'PREVENTION',
        steps: [
          {
            dayNumber: 1,
            title: 'Dewormer dose',
            actionType: 'DEWORMING',
            medicineId,
            doseAmount: 5,
            doseUnit: 'ml',
            route: 'ORAL',
          },
        ],
      });
    expect(planRes.status).toBe(201);
    const planId = planRes.body.data.id as string;

    const applyRes = await request(server())
      .post(api(`/health/plans/${planId}/apply`))
      .set(...auth(owner))
      .send({ cattleIds: [cattleId] });
    expect(applyRes.status).toBe(201);

    const task = await prisma.healthTask.findFirstOrThrow({
      where: { farmId: owner.farmId, healthPlanId: planId, cattleId },
    });
    expect(task.healthCaseId).toBeNull();
    expect(task.planEnrollmentId).toBeTruthy();
    return {
      taskId: task.id,
      planEnrollmentId: task.planEnrollmentId as string,
    };
  }

  it('blocks with financialAccountId required when the medicine has a real cost, and stock is untouched', async () => {
    const cattleId = await createCow();
    const medicineId = await createMedicine(20);
    const { taskId } = await createCaselessTask(cattleId, medicineId);

    const res = await request(server())
      .post(api(`/health/tasks/${taskId}/log-treatment`))
      .set(...auth(owner))
      // doseAmount must be sent explicitly — the resolved-quantity fallback (mirroring
      // `logTreatment`'s own) only checks `dto.stockDeductionQuantity`/`dto.doseAmount`, never the
      // task's own prefilled `doseAmount`, same real quirk the existing case-scoped route has.
      .send({ doseAmount: 5 });
    expect(res.status).toBe(400);
    expect((res.body as { message?: string }).message).toContain(
      'financialAccountId',
    );

    const medicine = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicineId },
    });
    expect(medicine.currentStock).toBe(50);
  });

  it('logs a real dose: decrements stock, posts cost, completes the task, advances enrollment progress, and creates a PREVENTIVE backing case that never reads as SICK', async () => {
    const cattleId = await createCow();
    const medicineId = await createMedicine(20);
    const { taskId, planEnrollmentId } = await createCaselessTask(
      cattleId,
      medicineId,
    );

    const res = await request(server())
      .post(api(`/health/tasks/${taskId}/log-treatment`))
      .set(...auth(owner))
      .send({ doseAmount: 5, financialAccountId });
    expect(res.status).toBe(201);
    expect(res.body.data.treatmentLog.doseAmount).toBe('5');
    expect(res.body.data.treatmentLog.stockDeducted).toBe(true);
    expect(res.body.data.withdrawal).toBeTruthy();

    // Stock decremented by the plan step's prefilled doseAmount (5).
    const medicine = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicineId },
    });
    expect(medicine.currentStock).toBe(45);

    // Cost posted to Finance.
    const treatmentLog = await prisma.treatmentLog.findUniqueOrThrow({
      where: { id: res.body.data.treatmentLog.id },
    });
    expect(treatmentLog.financeTransactionId).toBeTruthy();

    // Task completed; PlanEnrollment (1 step total) now 100% complete.
    const task = await prisma.healthTask.findUniqueOrThrow({
      where: { id: taskId },
    });
    expect(task.status).toBe('COMPLETED');
    const enrollment = await prisma.planEnrollment.findUniqueOrThrow({
      where: { id: planEnrollmentId },
    });
    expect(enrollment.currentStep).toBe(1);
    expect(enrollment.totalSteps).toBe(1);
    expect(enrollment.progressPercentage).toBe(100);
    expect(enrollment.status).toBe('COMPLETED');

    // Backing case exists and carries PREVENTIVE careType — the actual design point of this
    // ticket: TreatmentLog needs a real HealthCase row, but this animal must not read as SICK.
    const backingCase = await prisma.healthCase.findUniqueOrThrow({
      where: { id: treatmentLog.healthCaseId },
    });
    expect(backingCase.careType).toBe('PREVENTIVE');

    const sickList = await request(server())
      .get(api('/cattle?healthStatus=SICK'))
      .set(...auth(owner));
    expect(sickList.status).toBe(200);
    expect(
      (sickList.body.data as Array<{ id: string }>).some(
        (c) => c.id === cattleId,
      ),
    ).toBe(false);

    // Safety withdrawal blocks milk sale, same as any curative treatment's.
    const today = new Date().toISOString().slice(0, 10);
    const logRes = await request(server())
      .get(api(`/milk/log?date=${today}`))
      .set(...auth(owner));
    const row = (
      logRes.body.data.entries as Array<{ cattleId: string; log: unknown }>
    ).find((e) => e.cattleId === cattleId);
    expect((row!.log as { tankLocked: boolean }).tankLocked).toBe(true);
  });

  it('a second dose on the same animal reuses the same PREVENTIVE backing case instead of creating a duplicate', async () => {
    const cattleId = await createCow();
    const medicineId = await createMedicine(0); // free — no payment path needed for this assertion
    const { taskId: task1 } = await createCaselessTask(cattleId, medicineId);
    const { taskId: task2 } = await createCaselessTask(cattleId, medicineId);

    const res1 = await request(server())
      .post(api(`/health/tasks/${task1}/log-treatment`))
      .set(...auth(owner));
    expect(res1.status).toBe(201);

    const res2 = await request(server())
      .post(api(`/health/tasks/${task2}/log-treatment`))
      .set(...auth(owner));
    expect(res2.status).toBe(201);

    expect(res2.body.data.treatmentLog.healthCaseId).toBe(
      res1.body.data.treatmentLog.healthCaseId,
    );
    const preventiveCases = await prisma.healthCase.count({
      where: { farmId: owner.farmId, cattleId, careType: 'PREVENTIVE' },
    });
    expect(preventiveCases).toBe(1);
  });

  it('rejects a case-scoped task, naming the real route', async () => {
    const cattleId = await createCow();
    const healthCase = await prisma.healthCase.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        caseCode: `HC-E2E-RD093-${Date.now()}`,
        note: 'Mastitis',
        careType: 'CURATIVE',
        priority: 'HIGH',
        reportedBy: ownerUserId,
      },
    });
    const task = await prisma.healthTask.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId: healthCase.id,
        taskCode: `TASK-E2E-RD093-${Date.now()}`,
        taskDate: new Date(),
        dueDateTime: new Date(),
        taskType: 'MEDICINE',
        title: 'Follow-up dose',
      },
    });

    const res = await request(server())
      .post(api(`/health/tasks/${task.id}/log-treatment`))
      .set(...auth(owner));
    expect(res.status).toBe(400);
    expect((res.body as { message?: string }).message).toContain(
      '/health/cases',
    );
  });

  it('worker RBAC: can log a task treatment (healthcare.log-treatment is worker-ok, same as Quick Treat)', async () => {
    const worker = await loginAs(
      ctx,
      'worker@demo.rakhal.test',
      'WorkerPass123',
    );
    const cattleId = await createCow();
    const medicineId = await createMedicine(0);
    const { taskId } = await createCaselessTask(cattleId, medicineId);

    const res = await request(server())
      .post(api(`/health/tasks/${taskId}/log-treatment`))
      .set(...auth(worker))
      .send({ doseAmount: 5 });
    expect(res.status).toBe(201);
  });
});

import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Protocols v2 undo: a recorded dose can be voided (stock back to its batch, expense reversed, withdrawal cancelled, step
 * back to pending), and an application can be cancelled in ONE call per animal or per round - doses reversed, steps
 * deleted, enrollments / auto-created cases removed.
 */
describe('Health — undo a dose, cancel a protocol, cancel a round', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerUserId: string;
  let medicineId: string;
  let mlUnitId: string;
  const stamp = Date.now();

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const makeCow = (tag: string) =>
    prisma.cattle
      .create({
        data: {
          farmId: owner.farmId,
          tagNumber: `E2E-UNDO-${stamp}-${tag}`,
          gender: 'FEMALE',
          createdBy: ownerUserId,
        },
      })
      .then((c) => c.id);

  const stockOf = async () =>
    (
      await prisma.medicineBatch.aggregate({
        where: { medicineId },
        _sum: { currentStock: true },
      })
    )._sum.currentStock ?? 0;

  const makePlan = async (name: string, category: 'VACCINATION' | 'TREATMENT') =>
    (
      await request(server())
        .post(api('/health/plans'))
        .set(...auth(owner))
        .send({
          name: `${name}-${stamp}`,
          category,
          planType: category === 'TREATMENT' ? 'MEDICAL' : 'PREVENTION',
          steps: [
            {
              dayNumber: 1,
              title: 'Dose',
              actionType: 'MEDICINE',
              medicineId,
              doseAmount: 100,
              doseUnitId: mlUnitId,
            },
            {
              dayNumber: 2,
              title: 'Dose 2',
              actionType: 'MEDICINE',
              medicineId,
              doseAmount: 100,
              doseUnitId: mlUnitId,
            },
          ],
        })
    ).body.data.id as string;

  const apply = (planId: string, cattleIds: string[]) =>
    request(server())
      .post(api(`/health/plans/${planId}/apply`))
      .set(...auth(owner))
      .send({ cattleIds });

  const complete = (taskId: string) =>
    request(server())
      .post(api(`/health/tasks/${taskId}/complete`))
      .set(...auth(owner));

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    ownerUserId = (
      await prisma.user.findFirstOrThrow({
        where: { email: 'owner@demo.rakhal.test' },
        select: { id: true },
      })
    ).id;
    mlUnitId = (
      await prisma.unit.findFirstOrThrow({ where: { farmId: null, symbol: 'mL' } })
    ).id;
    medicineId = (
      await prisma.medicine.create({
        data: {
          farmId: owner.farmId,
          name: `E2E-UNDO-Med-${stamp}`,
          type: 'INJECTABLE',
          category: 'ANTIBIOTIC',
          unitId: mlUnitId,
          currentStock: 10000,
          costPerUnit: 2,
          purchaseDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 365 * 86_400_000).toISOString(),
          milkWithdrawalDays: 2,
          meatWithdrawalDays: 0,
          createdBy: ownerUserId,
        },
      })
    ).id;
    await prisma.medicineBatch.create({
      data: {
        medicineId,
        farmId: owner.farmId,
        batchCode: `UNDO-${stamp}`,
        currentStock: 10000,
        costPerUnit: 2,
        purchaseDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 86_400_000),
        createdBy: ownerUserId,
      },
    });
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('voids one recorded dose: stock back, expense voided, withdrawal cancelled, step pending again', async () => {
    const planId = await makePlan('E2E-UNDO-Void', 'VACCINATION');
    const cow = await makeCow('v1');
    await apply(planId, [cow]);
    const task = await prisma.healthTask.findFirstOrThrow({
      where: { healthPlanId: planId, cattleId: cow, stepNumber: 1 },
    });
    const before = await stockOf();
    expect((await complete(task.id)).status).toBe(201);
    expect(await stockOf()).toBe(before - 100);

    const log = await prisma.treatmentLog.findFirstOrThrow({
      where: { healthTaskId: task.id },
    });
    expect(log.financeTransactionId).not.toBeNull();
    expect(
      await prisma.safetyWithdrawal.count({
        where: { treatmentLogId: log.id, status: 'ACTIVE' },
      }),
    ).toBe(1);

    const res = await request(server())
      .post(api(`/health/treatments/${log.id}/void`))
      .set(...auth(owner))
      .send({ reason: 'wrong animal' });
    expect(res.status).toBe(200);

    expect(await stockOf()).toBe(before);
    const voided = await prisma.treatmentLog.findUniqueOrThrow({ where: { id: log.id } });
    expect(voided.voidedAt).not.toBeNull();
    expect(voided.voidReason).toBe('wrong animal');
    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: log.financeTransactionId! },
    });
    expect(expense.voidedAt).not.toBeNull();
    expect(
      await prisma.safetyWithdrawal.count({
        where: { treatmentLogId: log.id, status: 'CANCELLED' },
      }),
    ).toBe(1);
    const after = await prisma.healthTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.status).toBe('PENDING');
    expect(after.completedAt).toBeNull();

    // voiding twice is refused, and the step can be recorded again
    const again = await request(server())
      .post(api(`/health/treatments/${log.id}/void`))
      .set(...auth(owner))
      .send({});
    expect(again.status).toBe(400);
    expect((await complete(task.id)).status).toBe(201);
    expect(await stockOf()).toBe(before - 100);
  });

  it('cancels one animal in ONE call: both steps, the recorded dose, the enrollment', async () => {
    const planId = await makePlan('E2E-UNDO-Animal', 'VACCINATION');
    const [a, b] = [await makeCow('a1'), await makeCow('a2')];
    const applied = await apply(planId, [a, b]);
    const start = await stockOf();
    const taskA = await prisma.healthTask.findFirstOrThrow({
      where: { healthPlanId: planId, cattleId: a, stepNumber: 1 },
    });
    await complete(taskA.id);
    expect(await stockOf()).toBe(start - 100);

    const enrollment = await prisma.planEnrollment.findFirstOrThrow({
      where: { healthPlanId: planId, cattleId: a },
    });
    const res = await request(server())
      .post(api(`/cattle/${a}/protocols/cancel`))
      .set(...auth(owner))
      .send({ planEnrollmentId: enrollment.id, reason: 'wrong cow' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ stepsRemoved: 2, dosesReversed: 1 });

    expect(await stockOf()).toBe(start);
    expect(
      await prisma.healthTask.count({
        where: { planEnrollmentId: enrollment.id, deletedAt: null },
      }),
    ).toBe(0);
    const gone = await prisma.planEnrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
    expect(gone.deletedAt).not.toBeNull();
    expect(gone.cancelledAt).not.toBeNull();
    const app = await prisma.planApplication.findUniqueOrThrow({
      where: { id: applied.body.data.planApplicationId },
    });
    expect(app.animalCount).toBe(1);
    expect(app.deletedAt).toBeNull();
    // the other animal is untouched
    expect(
      await prisma.healthTask.count({
        where: { healthPlanId: planId, cattleId: b, deletedAt: null },
      }),
    ).toBe(2);
  });

  it('cancels a whole preventive round in ONE call and it leaves the Applied list', async () => {
    const planId = await makePlan('E2E-UNDO-Round', 'VACCINATION');
    const cows = [await makeCow('r1'), await makeCow('r2'), await makeCow('r3')];
    const applied = await apply(planId, cows);
    const start = await stockOf();
    for (const cow of cows.slice(0, 2)) {
      const t = await prisma.healthTask.findFirstOrThrow({
        where: { healthPlanId: planId, cattleId: cow, stepNumber: 1 },
      });
      await complete(t.id);
    }
    expect(await stockOf()).toBe(start - 200);

    const key = `app:${applied.body.data.planApplicationId as string}`;
    const worker403 = await request(server())
      .post(api(`/health/rounds/${encodeURIComponent(key)}/cancel`))
      .set(...auth(worker))
      .send({});
    expect(worker403.status).toBe(403);

    const res = await request(server())
      .post(api(`/health/rounds/${encodeURIComponent(key)}/cancel`))
      .set(...auth(owner))
      .send({ reason: 'applied to the wrong group' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ animals: 3, stepsRemoved: 6, dosesReversed: 2 });
    expect(await stockOf()).toBe(start);

    const app = await prisma.planApplication.findUniqueOrThrow({
      where: { id: applied.body.data.planApplicationId },
    });
    expect(app.deletedAt).not.toBeNull();
    const list = await request(server())
      .get(api('/health/rounds?status=RUNNING&limit=100'))
      .set(...auth(owner));
    expect(
      (list.body.data as { roundKey: string }[]).some((r) => r.roundKey === key),
    ).toBe(false);
    const again = await request(server())
      .post(api(`/health/rounds/${encodeURIComponent(key)}/cancel`))
      .set(...auth(owner))
      .send({});
    expect(again.status).toBe(404);
  });

  it('cancelling a treatment protocol removes the sick case it created, and reverses its dose', async () => {
    const planId = await makePlan('E2E-UNDO-Treat', 'TREATMENT');
    const cow = await makeCow('t1');
    const applied = await apply(planId, [cow]);
    const caseId = applied.body.data.results[0].healthCaseId as string;
    const start = await stockOf();
    const task = await prisma.healthTask.findFirstOrThrow({
      where: { healthCaseId: caseId, stepNumber: 1 },
    });
    expect((await complete(task.id)).status).toBe(201);
    expect(await stockOf()).toBe(start - 100);

    const res = await request(server())
      .post(api(`/cattle/${cow}/protocols/cancel`))
      .set(...auth(owner))
      .send({ healthCaseId: caseId });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ caseRemoved: true, stepsRemoved: 2, dosesReversed: 1 });
    expect(await stockOf()).toBe(start);
    const removed = await prisma.healthCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(removed.deletedAt).not.toBeNull();
  });

  it('cancels a treatment round by key', async () => {
    const planId = await makePlan('E2E-UNDO-TreatRound', 'TREATMENT');
    const cows = [await makeCow('tr1'), await makeCow('tr2')];
    await apply(planId, cows);
    const start = await stockOf();
    const list = await request(server())
      .get(api(`/health/rounds?status=RUNNING&limit=100&search=E2E-UNDO-TreatRound-${stamp}`))
      .set(...auth(owner));
    const round = (list.body.data as { roundKey: string; animalCount: number }[])[0];
    expect(round.animalCount).toBe(2);

    const res = await request(server())
      .post(api(`/health/rounds/${encodeURIComponent(round.roundKey)}/cancel`))
      .set(...auth(owner))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ animals: 2, casesRemoved: 2 });
    expect(await stockOf()).toBe(start);
    expect(
      await prisma.healthCase.count({ where: { healthPlanId: planId, deletedAt: null } }),
    ).toBe(0);
  });

  it('a cancelled application can be applied again to the same animal', async () => {
    const planId = await makePlan('E2E-UNDO-Reapply', 'VACCINATION');
    const cow = await makeCow('re');
    const first = await apply(planId, [cow]);
    const enrollment = await prisma.planEnrollment.findFirstOrThrow({
      where: { healthPlanId: planId, cattleId: cow },
    });
    await request(server())
      .post(api(`/cattle/${cow}/protocols/cancel`))
      .set(...auth(owner))
      .send({ planEnrollmentId: enrollment.id });
    const second = await apply(planId, [cow]);
    expect(second.status).toBe(201);
    expect(second.body.data.appliedCount).toBe(1);
    expect(second.body.data.planApplicationId).not.toBe(first.body.data.planApplicationId);
  });
});

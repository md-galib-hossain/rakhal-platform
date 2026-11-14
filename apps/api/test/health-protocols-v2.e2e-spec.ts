import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { HealthCycleService } from '../src/modules/health/application/services/health-cycle.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Protocols v2 — medicine steps come from inventory with a unit-aware dose and an optional time,
 * applying is blocked when stock is short, completing a step posts stock + cost per animal, and a
 * preventive protocol with `cycleLengthDays` re-enrolls the same animal after it ends.
 */
describe('Health — protocols v2 (inventory steps, stock gate, finance, auto-repeat)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let medicineId: string;
  let mlUnitId: string;
  let lUnitId: string;
  let gUnitId: string;
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
          tagNumber: `E2E-PV2-${stamp}-${tag}`,
          gender: 'FEMALE',
          createdBy: ownerUserId,
        },
      })
      .then((c) => c.id);

  const medStep = (over: Record<string, unknown> = {}) => ({
    dayNumber: 1,
    title: 'Dose',
    actionType: 'MEDICINE',
    medicineId,
    doseAmount: 0.5,
    doseUnitId: lUnitId, // 0.5 L = 500 mL of a mL-stocked medicine
    ...over,
  });

  const createPlan = (body: Record<string, unknown>) =>
    request(server())
      .post(api('/health/plans'))
      .set(...auth(owner))
      .send(body);

  const stockOf = async () =>
    (
      await prisma.medicineBatch.aggregate({
        where: { medicineId },
        _sum: { currentStock: true },
      })
    )._sum.currentStock ?? 0;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    ownerUserId = (
      await prisma.user.findFirstOrThrow({
        where: { email: 'owner@demo.rakhal.test' },
        select: { id: true },
      })
    ).id;
    const unit = (symbol: string) =>
      prisma.unit
        .findFirstOrThrow({ where: { farmId: null, symbol } })
        .then((u) => u.id);
    mlUnitId = await unit('mL');
    lUnitId = await unit('L');
    gUnitId = await unit('g');

    medicineId = (
      await prisma.medicine.create({
        data: {
          farmId: owner.farmId,
          name: `E2E-PV2-Med-${stamp}`,
          type: 'INJECTABLE',
          category: 'ANTIBIOTIC',
          unitId: mlUnitId,
          currentStock: 1000,
          costPerUnit: 2,
          purchaseDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 365 * 86_400_000).toISOString(),
          milkWithdrawalDays: 0,
          meatWithdrawalDays: 0,
          createdBy: ownerUserId,
        },
      })
    ).id;
    await prisma.medicineBatch.create({
      data: {
        medicineId,
        farmId: owner.farmId,
        batchCode: `PV2-${stamp}`,
        currentStock: 1000,
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

  describe('saving a protocol', () => {
    const base = (steps: unknown[]) => ({
      name: `E2E-PV2-Plan-${stamp}-${Math.random().toString(36).slice(2, 6)}`,
      category: 'VACCINATION',
      planType: 'PREVENTION',
      steps,
    });

    it('rejects a medicine step with no inventory medicine', async () => {
      const res = await createPlan(
        base([{ dayNumber: 1, title: 'x', actionType: 'MEDICINE' }]),
      );
      expect(res.status).toBe(400);
    });

    it('rejects a dose unit that cannot convert to the medicine unit (g vs mL)', async () => {
      const res = await createPlan(
        base([medStep({ doseAmount: 5, doseUnitId: gUnitId })]),
      );
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/cannot be converted/i);
    });

    it('rejects a malformed time', async () => {
      const res = await createPlan(base([medStep({ timeOfDay: '25:99' })]));
      expect(res.status).toBe(400);
    });

    it('saves a unit-aware dose + optional time and snapshots name/unit', async () => {
      const res = await createPlan(base([medStep({ timeOfDay: '08:30' })]));
      expect(res.status).toBe(201);
      const step = res.body.data.steps[0];
      expect(step.medicineId).toBe(medicineId);
      expect(step.doseUnitId).toBe(lUnitId);
      expect(step.doseUnit).toBe('L');
      expect(step.medicineName).toBe(`E2E-PV2-Med-${stamp}`);
      expect(step.timeOfDay).toBe('08:30');
    });

    it('accepts an empty time (optional)', async () => {
      const res = await createPlan(base([medStep({ timeOfDay: '' })]));
      expect(res.status).toBe(201);
      expect(res.body.data.steps[0].timeOfDay).toBeNull();
    });

    it('PATCH replaces steps and re-validates them', async () => {
      const created = await createPlan(base([medStep()]));
      const id = created.body.data.id as string;
      const bad = await request(server())
        .patch(api(`/health/plans/${id}`))
        .set(...auth(owner))
        .send({ steps: [medStep({ doseUnitId: gUnitId })] });
      expect(bad.status).toBe(400);
      const ok = await request(server())
        .patch(api(`/health/plans/${id}`))
        .set(...auth(owner))
        .send({ steps: [medStep({ doseAmount: 100, doseUnitId: mlUnitId })] });
      expect(ok.status).toBe(200);
      expect(Number(ok.body.data.steps[0].doseAmount)).toBe(100);
    });
  });

  describe('stock gate + finance', () => {
    let planId: string;
    let cows: string[];

    beforeAll(async () => {
      const res = await createPlan({
        name: `E2E-PV2-Gate-${stamp}`,
        category: 'VACCINATION',
        planType: 'PREVENTION',
        steps: [medStep({ timeOfDay: '07:15' })],
      });
      planId = res.body.data.id;
      cows = [await makeCow('g1'), await makeCow('g2'), await makeCow('g3')];
    });

    it('stock-check sums dose x animals with unit conversion', async () => {
      const one = await request(server())
        .get(api(`/health/plans/${planId}/stock-check?animals=1`))
        .set(...auth(owner));
      expect(one.body.data.ok).toBe(true);
      const three = await request(server())
        .get(api(`/health/plans/${planId}/stock-check?animals=3`))
        .set(...auth(owner));
      expect(three.body.data.ok).toBe(false);
      expect(three.body.data.shortfalls[0]).toMatchObject({
        medicineId,
        needed: 1500,
        available: 1000,
        unit: 'mL',
      });
    });

    it('blocks applying to 3 animals (409) and writes nothing', async () => {
      const res = await request(server())
        .post(api(`/health/plans/${planId}/apply`))
        .set(...auth(owner))
        .send({ cattleIds: cows });
      expect(res.status).toBe(409);
      expect(JSON.stringify(res.body)).toContain('PROTOCOL_OUT_OF_STOCK');
      expect(
        await prisma.planEnrollment.count({ where: { healthPlanId: planId } }),
      ).toBe(0);
    });

    it('applies to 2 animals, copies dose unit + time, and completing posts stock + one expense per animal', async () => {
      const res = await request(server())
        .post(api(`/health/plans/${planId}/apply`))
        .set(...auth(owner))
        .send({ cattleIds: [cows[0], cows[1]] });
      expect(res.status).toBe(201);
      expect(res.body.data.appliedCount).toBe(2);

      const tasks = await prisma.healthTask.findMany({
        where: { healthPlanId: planId },
      });
      expect(tasks).toHaveLength(2);
      expect(tasks[0].doseUnitId).toBe(lUnitId);
      expect(tasks[0].timeOfDay).toBe('07:15');

      const before = await stockOf();
      for (const t of tasks) {
        const done = await request(server())
          .post(api(`/health/tasks/${t.id}/complete`))
          .set(...auth(owner));
        expect(done.status).toBe(201);
      }
      expect(before - (await stockOf())).toBeCloseTo(1000, 5); // 2 x 500 mL

      const logs = await prisma.treatmentLog.findMany({
        where: { healthTaskId: { in: tasks.map((t) => t.id) } },
      });
      expect(logs).toHaveLength(2);
      for (const l of logs) {
        const expense = await prisma.expense.findUniqueOrThrow({
          where: { id: l.financeTransactionId! },
        });
        expect(expense.category).toBe('HEALTH');
        expect(Number(expense.amount)).toBe(1000); // 500 mL x ৳2
      }
    });

    it('once stock is gone, a new apply is blocked', async () => {
      const res = await request(server())
        .post(api(`/health/plans/${planId}/apply`))
        .set(...auth(owner))
        .send({ cattleIds: [cows[2]] });
      expect(res.status).toBe(409);
    });
  });

  describe('cycle auto-repeat', () => {
    it('re-enrolls the same animal once its cycle ends, exactly once', async () => {
      await prisma.medicineBatch.updateMany({
        where: { medicineId },
        data: { currentStock: 5000 },
      });
      await prisma.medicine.update({
        where: { id: medicineId },
        data: { currentStock: 5000 },
      });
      const plan = await createPlan({
        name: `E2E-PV2-Cycle-${stamp}`,
        category: 'VACCINATION',
        planType: 'PREVENTION',
        cycleLengthDays: 7,
        steps: [medStep({ doseAmount: 10, doseUnitId: mlUnitId })],
      });
      const planId = plan.body.data.id as string;
      const cow = await makeCow('cyc');

      const start = new Date(Date.now() - 10 * 86_400_000).toISOString();
      const applied = await request(server())
        .post(api(`/health/plans/${planId}/apply`))
        .set(...auth(owner))
        .send({ cattleIds: [cow], startDate: start });
      expect(applied.status).toBe(201);

      const task = await prisma.healthTask.findFirstOrThrow({
        where: { healthPlanId: planId, cattleId: cow },
      });
      const done = await request(server())
        .post(api(`/health/tasks/${task.id}/complete`))
        .set(...auth(owner));
      expect(done.status).toBe(201);
      const first = await prisma.planEnrollment.findFirstOrThrow({
        where: { healthPlanId: planId, cattleId: cow },
      });
      expect(first.status).toBe('COMPLETED');

      const cycles = ctx.app.get(HealthCycleService);
      await cycles.sweepFarm(owner.farmId);
      await cycles.sweepFarm(owner.farmId); // idempotent

      const all = await prisma.planEnrollment.findMany({
        where: { healthPlanId: planId, cattleId: cow },
        orderBy: { cycleNumber: 'asc' },
      });
      expect(all).toHaveLength(2);
      expect(all[1].cycleNumber).toBe(2);
      expect(all[1].repeatedFromId).toBe(first.id);
      expect(all[1].status).toBe('ACTIVE');
      const marked = await prisma.planEnrollment.findUniqueOrThrow({
        where: { id: first.id },
      });
      expect(marked.nextCycleCreatedAt).not.toBeNull();
    });

    it('a stopped protocol does not repeat', async () => {
      const plan = await createPlan({
        name: `E2E-PV2-CycleStop-${stamp}`,
        category: 'VACCINATION',
        planType: 'PREVENTION',
        cycleLengthDays: 7,
        steps: [medStep({ doseAmount: 10, doseUnitId: mlUnitId })],
      });
      const planId = plan.body.data.id as string;
      const cow = await makeCow('stop');
      await request(server())
        .post(api(`/health/plans/${planId}/apply`))
        .set(...auth(owner))
        .send({
          cattleIds: [cow],
          startDate: new Date(Date.now() - 10 * 86_400_000).toISOString(),
        });
      const enrollment = await prisma.planEnrollment.findFirstOrThrow({
        where: { healthPlanId: planId, cattleId: cow },
      });
      const stopped = await request(server())
        .post(api(`/cattle/${cow}/protocols/stop`))
        .set(...auth(owner))
        .send({ planEnrollmentId: enrollment.id });
      expect(stopped.status).toBe(200);
      await ctx.app.get(HealthCycleService).sweepFarm(owner.farmId);
      expect(
        await prisma.planEnrollment.count({
          where: { healthPlanId: planId, cattleId: cow, deletedAt: null },
        }),
      ).toBe(0);
    });
  });
});

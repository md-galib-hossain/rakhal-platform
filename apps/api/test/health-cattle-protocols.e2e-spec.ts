import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Cow-side protocols (no ticket — follows the Protocols tab losing its In use | All switch).
 *  - `GET  /cattle/:id/protocols`       : every protocol one animal is on now (treatment on a case + preventive rounds).
 *  - `POST /cattle/:id/protocols/stop`  : take the animal off one protocol; its open steps are skipped.
 *  - `GET  /health/plans`               : an archived protocol with animals still on it stays in the default list.
 * Everything is found through a per-run unique tag, so the shared dev DB's other protocols never interfere.
 */
describe('Health — protocols on one animal (list + stop)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerId: string;
  const tag = `E2E-COWPROTO-${Date.now()}`;
  const DAY = 24 * 60 * 60 * 1000;
  const inDays = (n: number) => new Date(Date.now() + n * DAY);

  const cattleIds: string[] = [];
  const planIds: string[] = [];
  let cowId: string;
  let otherCowId: string;
  let treatmentPlanId: string;
  let preventionPlanId: string;
  let caseId: string;
  let enrollmentId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const list = async (id: string, user: AuthedUser = owner) =>
    request(server())
      .get(api(`/cattle/${id}/protocols`))
      .set(...auth(user))
      .expect(200);
  const stop = (id: string, body: Record<string, unknown>, u = owner) =>
    request(server())
      .post(api(`/cattle/${id}/protocols/stop`))
      .set(...auth(u))
      .send(body);

  const makeCow = async (s: string) => {
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
    return created.id;
  };
  const makeTask = (data: Record<string, unknown>) =>
    prisma.healthTask.create({
      data: {
        farmId: owner.farmId,
        taskType: 'MEDICINE',
        title: 'Dose',
        ...data,
      } as never,
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

    cowId = await makeCow('a');
    otherCowId = await makeCow('b');

    // cow a: a treatment protocol on an open case + a preventive round
    const healthCase = await prisma.healthCase.create({
      data: {
        farmId: owner.farmId,
        cattleId: cowId,
        caseCode: `${tag}-a`,
        careType: 'CURATIVE',
        priority: 'MEDIUM',
        status: 'ACTIVE',
        healthPlanId: treatmentPlanId,
        startDate: inDays(-2),
        currentStep: 1,
        totalSteps: 3,
        progressPercentage: 33,
      } as never,
    });
    caseId = healthCase.id;
    await makeTask({
      cattleId: cowId,
      healthCaseId: caseId,
      healthPlanId: treatmentPlanId,
      taskCode: `${tag}-t1`,
      taskDate: inDays(1),
      dueDateTime: inDays(1),
      status: 'PENDING',
      title: 'Treatment dose',
    });
    const application = await prisma.planApplication.create({
      data: {
        farmId: owner.farmId,
        healthPlanId: preventionPlanId,
        startDate: inDays(-1),
        appliedBy: ownerId,
        animalCount: 2,
      },
    });
    const enrollment = await prisma.planEnrollment.create({
      data: {
        farmId: owner.farmId,
        cattleId: cowId,
        healthPlanId: preventionPlanId,
        planApplicationId: application.id,
        status: 'ACTIVE',
        startDate: inDays(-1),
        currentStep: 0,
        totalSteps: 2,
      },
    });
    enrollmentId = enrollment.id;
    await makeTask({
      cattleId: cowId,
      planEnrollmentId: enrollmentId,
      healthPlanId: preventionPlanId,
      taskCode: `${tag}-t2`,
      taskDate: inDays(-1),
      dueDateTime: inDays(-1),
      status: 'OVERDUE',
      title: 'Vaccine dose',
    });
    // another cow on the same prevention round — must be untouched by stopping cow a
    await prisma.planEnrollment.create({
      data: {
        farmId: owner.farmId,
        cattleId: otherCowId,
        healthPlanId: preventionPlanId,
        planApplicationId: application.id,
        status: 'ACTIVE',
        startDate: inDays(-1),
        currentStep: 0,
        totalSteps: 2,
      },
    });
  }, 60_000);

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

  describe('GET /cattle/:id/protocols', () => {
    it('lists the treatment protocol and the preventive round, soonest next step first', async () => {
      const res = await list(cowId);
      const items = res.body.data.items as Array<{
        runType: string;
        healthCaseId: string | null;
        planEnrollmentId: string | null;
        healthPlan: { id: string; name: string };
        nextStep: { title: string } | null;
      }>;
      expect(items).toHaveLength(2);
      // the overdue vaccine step is due before tomorrow's treatment dose
      expect(items[0]).toMatchObject({
        runType: 'ENROLLMENT',
        planEnrollmentId: enrollmentId,
        healthCaseId: null,
        healthPlan: { id: preventionPlanId },
        nextStep: { title: 'Vaccine dose' },
      });
      expect(items[1]).toMatchObject({
        runType: 'CASE',
        healthCaseId: caseId,
        planEnrollmentId: null,
        healthPlan: { id: treatmentPlanId },
        nextStep: { title: 'Treatment dose' },
      });
    });

    it('is empty for an animal on nothing', async () => {
      const bare = await makeCow('bare');
      const res = await list(bare);
      expect(res.body.data.items).toEqual([]);
    });

    it('rejects an animal outside the farm (same as health-summary)', async () => {
      await request(server())
        .get(api('/cattle/does-not-exist/protocols'))
        .set(...auth(owner))
        .expect(400);
    });

    it('a worker can read it', async () => {
      await list(cowId, worker);
    });
  });

  describe('POST /cattle/:id/protocols/stop', () => {
    it('needs exactly one of healthCaseId / planEnrollmentId', async () => {
      await stop(cowId, {}).expect(400);
      await stop(cowId, {
        healthCaseId: caseId,
        planEnrollmentId: enrollmentId,
      }).expect(400);
    });

    it('is manager+ only', async () => {
      await stop(cowId, { planEnrollmentId: enrollmentId }, worker).expect(403);
    });

    it('rejects a run that belongs to another animal', async () => {
      await stop(otherCowId, { planEnrollmentId: enrollmentId }).expect(404);
    });

    it('stopping a preventive round skips its open steps and removes only this animal', async () => {
      await stop(cowId, {
        planEnrollmentId: enrollmentId,
        reason: 'sold soon',
      }).expect(200);

      const task = await prisma.healthTask.findFirstOrThrow({
        where: { planEnrollmentId: enrollmentId },
      });
      expect(task.status).toBe('SKIPPED');
      expect(task.notes).toBe('Protocol stopped: sold soon');

      const mine = await list(cowId);
      expect(
        (
          mine.body.data.items as Array<{ planEnrollmentId: string | null }>
        ).map((i) => i.planEnrollmentId),
      ).not.toContain(enrollmentId);

      const others = await list(otherCowId);
      expect(others.body.data.items).toHaveLength(1);

      // already stopped → no longer found
      await stop(cowId, { planEnrollmentId: enrollmentId }).expect(404);
    });

    it('stopping a treatment protocol keeps the case open but unlinks the protocol', async () => {
      await stop(cowId, { healthCaseId: caseId }).expect(200);

      const task = await prisma.healthTask.findFirstOrThrow({
        where: { healthCaseId: caseId },
      });
      expect(task.status).toBe('SKIPPED');

      const healthCase = await prisma.healthCase.findUniqueOrThrow({
        where: { id: caseId },
      });
      expect(healthCase.status).toBe('ACTIVE');
      expect(healthCase.healthPlanId).toBeNull();

      const res = await list(cowId);
      expect(res.body.data.items).toEqual([]);
    });
  });

  describe('GET /health/plans (default list)', () => {
    it('keeps an archived protocol that still has animals on it', async () => {
      // the other cow is still enrolled on the prevention protocol; archive it
      await request(server())
        .delete(api(`/health/plans/${preventionPlanId}`))
        .set(...auth(owner))
        .expect(200);
      const res = await request(server())
        .get(api(`/health/plans?search=${tag}`))
        .set(...auth(owner))
        .expect(200);
      const ids = (res.body.data as Array<{ id: string }>).map((p) => p.id);
      expect(ids).toContain(preventionPlanId);
    });
  });
});

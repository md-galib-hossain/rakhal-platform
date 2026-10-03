import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-417 — a case auto-closes when the last non-skipped task on its
 * plan-driven protocol completes: `status: CLOSED`, `closedDate` set,
 * `closeReason: 'protocol_completed'`. Only plan-originated cases auto-close;
 * a hand-opened case with no protocol is untouched. An active
 * `SafetyWithdrawal` survives the close. The completing user is recorded as
 * the AQR actor (+5 `recovered`, same trail a manual close fires).
 */
describe('Health — auto-close on protocol completion (RAKHAL-417)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const makeCow = async (tag: string) =>
    prisma.cattle
      .create({
        data: {
          farmId: owner.farmId,
          tagNumber: tag,
          gender: 'FEMALE',
          createdBy: ownerUserId,
        },
      })
      .then((c) => c.id);

  const makeTwoStepPlan = async (name: string) => {
    const res = await request(server())
      .post(api('/health/plans'))
      .set(...auth(owner))
      .send({
        name,
        category: 'TREATMENT',
        planType: 'MEDICAL',
        steps: [
          { dayNumber: 1, title: 'Step one', actionType: 'OBSERVATION' },
          { dayNumber: 2, title: 'Step two', actionType: 'OBSERVATION' },
        ],
      });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = ownerUser.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('closes the case only once the last task completes, not before', async () => {
    const stamp = Date.now();
    const cattleId = await makeCow(`E2E-RAKHAL417-A-${stamp}`);
    const planId = await makeTwoStepPlan(`E2E-RAKHAL417-Plan-A-${stamp}`);

    const applyRes = await request(server())
      .post(api(`/health/plans/${planId}/apply`))
      .set(...auth(owner))
      .send({ cattleIds: [cattleId] });
    expect(applyRes.status).toBe(201);
    const caseId = applyRes.body.data.results[0].healthCaseId as string;

    const tasks = await prisma.healthTask.findMany({
      where: { healthCaseId: caseId },
      orderBy: { stepNumber: 'asc' },
    });
    expect(tasks).toHaveLength(2);

    const scoreBefore = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
      select: { aqrScore: true },
    });

    const complete1 = await request(server())
      .post(api(`/health/tasks/${tasks[0].id}/complete`))
      .set(...auth(owner));
    expect(complete1.status).toBe(201);

    let caseRow = await prisma.healthCase.findUniqueOrThrow({
      where: { id: caseId },
    });
    expect(caseRow.status).toBe('ACTIVE');
    expect(caseRow.progressPercentage).toBe(50);
    expect(caseRow.closedDate).toBeNull();

    const complete2 = await request(server())
      .post(api(`/health/tasks/${tasks[1].id}/complete`))
      .set(...auth(owner));
    expect(complete2.status).toBe(201);

    caseRow = await prisma.healthCase.findUniqueOrThrow({
      where: { id: caseId },
    });
    expect(caseRow.status).toBe('CLOSED');
    expect(caseRow.progressPercentage).toBe(100);
    expect(caseRow.closeReason).toBe('protocol_completed');
    expect(caseRow.closedDate).not.toBeNull();
    expect(caseRow.deletedAt).not.toBeNull();

    const scoreAfter = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
      select: { aqrScore: true },
    });
    expect(scoreAfter.aqrScore).toBe((scoreBefore.aqrScore ?? 0) + 5);
  });

  it('a skipped task does not block auto-close — only non-skipped tasks must complete', async () => {
    const stamp = Date.now();
    const cattleId = await makeCow(`E2E-RAKHAL417-B-${stamp}`);
    const planId = await makeTwoStepPlan(`E2E-RAKHAL417-Plan-B-${stamp}`);

    const applyRes = await request(server())
      .post(api(`/health/plans/${planId}/apply`))
      .set(...auth(owner))
      .send({ cattleIds: [cattleId] });
    const caseId = applyRes.body.data.results[0].healthCaseId as string;
    const tasks = await prisma.healthTask.findMany({
      where: { healthCaseId: caseId },
      orderBy: { stepNumber: 'asc' },
    });

    const skip = await request(server())
      .post(api(`/health/tasks/${tasks[0].id}/skip`))
      .set(...auth(owner))
      .send({ reason: 'Not applicable' });
    expect(skip.status).toBe(201);

    let caseRow = await prisma.healthCase.findUniqueOrThrow({
      where: { id: caseId },
    });
    expect(caseRow.status).toBe('ACTIVE'); // skipping alone must not close it

    const complete = await request(server())
      .post(api(`/health/tasks/${tasks[1].id}/complete`))
      .set(...auth(owner));
    expect(complete.status).toBe(201);

    caseRow = await prisma.healthCase.findUniqueOrThrow({
      where: { id: caseId },
    });
    expect(caseRow.status).toBe('CLOSED');
    expect(caseRow.progressPercentage).toBe(100);
  });

  it('a hand-opened case with no protocol is never auto-closed', async () => {
    const stamp = Date.now();
    const cattleId = await makeCow(`E2E-RAKHAL417-C-${stamp}`);

    const caseRes = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        note: 'E2E hand-opened case',
        careType: 'CURATIVE',
        priority: 'LOW',
      });
    expect(caseRes.status).toBe(201);
    const caseId = caseRes.body.data.id as string;

    // Manually attach one task with no `healthPlanId` — same shape a case
    // with no protocol ever produces (createHealthCase never creates tasks).
    const task = await prisma.healthTask.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId: caseId,
        taskCode: `E2E-RAKHAL417-C-TASK-${stamp}`,
        taskDate: new Date(),
        dueDateTime: new Date(),
        taskType: 'OBSERVATION',
        title: 'Manual check',
      },
    });

    const complete = await request(server())
      .post(api(`/health/tasks/${task.id}/complete`))
      .set(...auth(owner));
    expect(complete.status).toBe(201);

    const caseRow = await prisma.healthCase.findUniqueOrThrow({
      where: { id: caseId },
    });
    expect(caseRow.status).toBe('ACTIVE');
    expect(caseRow.progressPercentage).toBe(100); // 1/1 task done...
    expect(caseRow.closedDate).toBeNull(); // ...but never auto-closed: no plan
    expect(caseRow.deletedAt).toBeNull();
  });

  it('an active SafetyWithdrawal survives the case auto-closing', async () => {
    const stamp = Date.now();
    const cattleId = await makeCow(`E2E-RAKHAL417-D-${stamp}`);
    const planId = await makeTwoStepPlan(`E2E-RAKHAL417-Plan-D-${stamp}`);

    const applyRes = await request(server())
      .post(api(`/health/plans/${planId}/apply`))
      .set(...auth(owner))
      .send({ cattleIds: [cattleId] });
    const caseId = applyRes.body.data.results[0].healthCaseId as string;
    const tasks = await prisma.healthTask.findMany({
      where: { healthCaseId: caseId },
      orderBy: { stepNumber: 'asc' },
    });

    await request(server())
      .post(api(`/health/tasks/${tasks[0].id}/complete`))
      .set(...auth(owner));

    // Log the last task's treatment with an explicit withdrawal, closing the
    // case in the same call that creates the SafetyWithdrawal.
    const logRes = await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({
        healthTaskId: tasks[1].id,
        doseAmount: 10,
        doseUnit: 'mL',
        route: 'IM',
        milkWithdrawalDays: 3,
        meatWithdrawalDays: 7,
      });
    expect(logRes.status).toBe(201);

    const caseRow = await prisma.healthCase.findUniqueOrThrow({
      where: { id: caseId },
    });
    expect(caseRow.status).toBe('CLOSED');

    const withdrawal = await prisma.safetyWithdrawal.findFirst({
      where: { farmId: owner.farmId, healthCaseId: caseId },
    });
    expect(withdrawal).not.toBeNull();
    expect(withdrawal?.status).toBe('ACTIVE');
    expect(withdrawal?.milkWithdrawalUntil).not.toBeNull();

    // Still surfaced by the Safety Withdrawals list, independent of the case
    // being closed — envelope interceptor lifts `CursorPage.items` into `data`.
    const listRes = await request(server())
      .get(api('/health/safety-withdrawals'))
      .set(...auth(owner));
    expect(listRes.status).toBe(200);
    const ids = (listRes.body.data as { id: string }[]).map((i) => i.id);
    expect(ids).toContain(withdrawal?.id);
  });
});

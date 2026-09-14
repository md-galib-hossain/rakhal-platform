import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-414 — `POST /health/plans/:id/apply` bulk-applies one plan to many
 * animals in a single transaction, replacing the frontend's old
 * create-case-then-apply-plan loop (2N sequential requests). An animal that
 * already has an active case for the plan is skipped, not duplicated; a bad
 * `cattleId` fails the whole call before anything is written.
 */
describe('Health — bulk plan apply (RAKHAL-414)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let planId: string;
  let cattleA: string;
  let cattleB: string;
  let cattleC: string;

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
            tagNumber: `E2E-RAKHAL414-${stamp}-${Math.random().toString(36).slice(2, 7)}`,
            gender: 'FEMALE',
            createdBy: ownerUser.id,
          },
        })
        .then((c) => c.id);
    cattleA = await makeCow();
    cattleB = await makeCow();
    cattleC = await makeCow();

    const planRes = await request(server())
      .post(api('/health/plans'))
      .set(...auth(owner))
      .send({
        // RAKHAL-415: a preventive category (VACCINATION/PREVENTION/DEWORMING/ROUTINE/BREEDING)
        // now bulk-applies onto PlanApplication/PlanEnrollment, not HealthCase — this spec's own
        // assertions below are specifically about the HealthCase-per-animal path, so the fixture
        // plan must stay TREATMENT (curative) to keep testing what it says it tests.
        name: `E2E-RAKHAL414-Plan-${stamp}`,
        category: 'TREATMENT',
        planType: 'MEDICAL',
        steps: [
          { dayNumber: 1, title: 'Primary dose', actionType: 'VACCINATION' },
          { dayNumber: 30, title: 'Booster', actionType: 'VACCINATION' },
        ],
      });
    expect(planRes.status).toBe(201);
    planId = planRes.body.data.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('applies the plan to multiple animals in one call, each getting its own case + tasks', async () => {
    const res = await request(server())
      .post(api(`/health/plans/${planId}/apply`))
      .set(...auth(owner))
      .send({ cattleIds: [cattleA, cattleB] });

    expect(res.status).toBe(201);
    expect(res.body.data.appliedCount).toBe(2);
    expect(res.body.data.skippedCount).toBe(0);
    expect(res.body.data.results).toHaveLength(2);
    expect(
      res.body.data.results.every(
        (r: { status: string }) => r.status === 'applied',
      ),
    ).toBe(true);

    const cases = await prisma.healthCase.findMany({
      where: {
        farmId: owner.farmId,
        healthPlanId: planId,
        cattleId: { in: [cattleA, cattleB] },
      },
    });
    expect(cases).toHaveLength(2);
    for (const c of cases) {
      expect(c.totalSteps).toBe(2);
      expect(c.diagnosisType).toBe('DISEASE'); // TREATMENT category -> DISEASE, see fixture note above
    }

    const tasks = await prisma.healthTask.findMany({
      where: {
        farmId: owner.farmId,
        healthPlanId: planId,
        cattleId: { in: [cattleA, cattleB] },
      },
    });
    expect(tasks).toHaveLength(4); // 2 steps x 2 animals
  });

  it('re-applying the same plan skips animals already on it, writing nothing new', async () => {
    const before = await prisma.healthCase.count({
      where: { farmId: owner.farmId, healthPlanId: planId },
    });

    const res = await request(server())
      .post(api(`/health/plans/${planId}/apply`))
      .set(...auth(owner))
      .send({ cattleIds: [cattleA, cattleB] });

    expect(res.status).toBe(201);
    expect(res.body.data.appliedCount).toBe(0);
    expect(res.body.data.skippedCount).toBe(2);
    expect(
      res.body.data.results.every(
        (r: { status: string }) => r.status === 'skipped',
      ),
    ).toBe(true);

    const after = await prisma.healthCase.count({
      where: { farmId: owner.farmId, healthPlanId: planId },
    });
    expect(after).toBe(before);
  });

  it('a bad cattleId in the list fails the whole call with nothing written', async () => {
    const before = await prisma.healthCase.count({
      where: { farmId: owner.farmId, healthPlanId: planId, cattleId: cattleC },
    });
    expect(before).toBe(0);

    const res = await request(server())
      .post(api(`/health/plans/${planId}/apply`))
      .set(...auth(owner))
      .send({ cattleIds: [cattleC, 'not-a-real-cattle-id'] });

    expect(res.status).toBe(404);

    const after = await prisma.healthCase.count({
      where: { farmId: owner.farmId, healthPlanId: planId, cattleId: cattleC },
    });
    expect(after).toBe(0);
  });

  it('rejects an empty cattleIds list', async () => {
    const res = await request(server())
      .post(api(`/health/plans/${planId}/apply`))
      .set(...auth(owner))
      .send({ cattleIds: [] });

    expect(res.status).toBe(400);
  });
});

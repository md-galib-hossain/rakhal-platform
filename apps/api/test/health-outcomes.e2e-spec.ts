import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-467 (MILESTONE 29) — a case's result and the farm's outcomes, derived from facts the case already holds.
 *  - `GET /health/cases/:id` gains `summary` (days, treatments, protocol, cost, outcome, recurrence).
 *  - `GET /health/outcomes?days=` aggregates the curative cases opened in the window.
 * Cost is the sum of the non-voided `Expense` rows the case's treatments posted (`TreatmentLog.financeTransactionId`).
 *
 * The dev DB is shared and the outcomes endpoint is farm-wide, so the aggregate assertions compare a baseline taken
 * before this spec's cases exist with the figures after (deltas), never absolute totals.
 */
describe('Health — case summary + farm outcomes (RAKHAL-467)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerId: string;
  const DAY = 24 * 60 * 60 * 1000;
  const ago = (days: number) => new Date(Date.now() - days * DAY);
  const tag = `E2E-RAKHAL467-${Date.now()}`;

  let cowA: string;
  let cowB: string;
  let firstCase: string; // MASTITIS, recovered 45 days ago
  let secondCase: string; // MASTITIS, open, started 4 days ago → a recurrence 41 days after the first closed
  let preventiveCase: string; // PREVENTIVE backing case — must stay out of the outcomes
  const expenseIds: string[] = [];

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  async function outcomes(days = 90) {
    const res = await request(server())
      .get(api(`/health/outcomes?days=${days}`))
      .set(...auth(owner))
      .expect(200);
    return res.body.data;
  }

  async function makeCase(
    cattleId: string,
    n: number,
    over: Record<string, unknown>,
  ) {
    return prisma.healthCase.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        caseCode: `${tag}-${n}`,
        careType: 'CURATIVE',
        priority: 'MEDIUM',
        ...over,
      } as never,
    });
  }

  async function makeTreatment(
    cattleId: string,
    healthCaseId: string,
    amount: number | null,
    opts: { voided?: boolean } = {},
  ) {
    let financeTransactionId: string | null = null;
    if (amount !== null) {
      const expense = await prisma.expense.create({
        data: {
          farmId: owner.farmId,
          category: 'OTHER',
          description: `${tag} treatment`,
          amount,
          expenseDate: new Date(),
          voidedAt: opts.voided ? new Date() : null,
          createdById: ownerId,
        },
      });
      expenseIds.push(expense.id);
      financeTransactionId = expense.id;
    }
    return prisma.treatmentLog.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        medicineName: 'Test medicine',
        administeredAt: new Date(),
        administeredBy: ownerId,
        financeTransactionId,
      },
    });
  }

  let before: {
    cases: number;
    recovered: number;
    totalCost: number;
    openCases: number;
  };

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

    const mk = async (s: string) =>
      (
        await prisma.cattle.create({
          data: {
            farmId: owner.farmId,
            tagNumber: `${tag}-${s}`,
            gender: 'FEMALE',
            createdBy: ownerId,
          },
        })
      ).id;
    cowA = await mk('A');
    cowB = await mk('B');

    const b = await outcomes();
    before = {
      cases: b.cases,
      recovered: b.recovered,
      totalCost: b.totalCost,
      openCases: b.openCases,
    };

    firstCase = (
      await makeCase(cowA, 1, {
        condition: 'MASTITIS',
        status: 'RECOVERED',
        startDate: ago(60),
        closedDate: ago(45),
      })
    ).id;
    secondCase = (
      await makeCase(cowA, 2, {
        condition: 'MASTITIS',
        status: 'ACTIVE',
        startDate: ago(4),
        note: 'Left hind quarter',
      })
    ).id;
    preventiveCase = (
      await makeCase(cowB, 3, {
        careType: 'PREVENTIVE',
        status: 'ACTIVE',
        startDate: ago(2),
      })
    ).id;

    // second case: ৳120 + ৳80 counted, ৳50 voided (ignored), one treatment with no cost
    await makeTreatment(cowA, secondCase, 120);
    await makeTreatment(cowA, secondCase, 80);
    await makeTreatment(cowA, secondCase, 50, { voided: true });
    await makeTreatment(cowA, secondCase, null);
  }, 40_000);

  afterAll(async () => {
    const caseIds = [firstCase, secondCase, preventiveCase].filter(Boolean);
    await prisma.treatmentLog.deleteMany({
      where: { healthCaseId: { in: caseIds } },
    });
    await prisma.expense.deleteMany({ where: { id: { in: expenseIds } } });
    await prisma.healthCase.deleteMany({ where: { id: { in: caseIds } } });
    await prisma.cattle.deleteMany({ where: { id: { in: [cowA, cowB] } } });
    await ctx.app.close();
  });

  describe('GET /health/cases/:id → summary', () => {
    it('sums the non-voided treatment cost and counts every treatment', async () => {
      const res = await request(server())
        .get(api(`/health/cases/${secondCase}`))
        .set(...auth(owner))
        .expect(200);

      const s = res.body.data.summary;
      expect(s.totalCost).toBe(200); // 120 + 80; the voided 50 and the cost-less treatment add nothing
      expect(s.treatmentCount).toBe(4);
      expect(s.outcome).toBeNull(); // still open
      expect(s.daysToRecover).toBeNull();
      expect(s.daysSick).toBe(5); // reported 4 days ago → day 5
      expect(s.protocol).toBeNull();
    });

    it('flags a recurrence — same animal, same condition, previous case closed 41 days earlier', async () => {
      const res = await request(server())
        .get(api(`/health/cases/${secondCase}`))
        .set(...auth(owner))
        .expect(200);

      expect(res.body.data.summary.recurrence).toMatchObject({
        isRecurrence: true,
        previousCaseId: firstCase,
        daysSincePrevious: 41,
      });
    });

    it('a closed case reports its outcome and days to recover, and is not itself a recurrence', async () => {
      const res = await request(server())
        .get(api(`/health/cases/${firstCase}`))
        .set(...auth(owner))
        .expect(200);

      const s = res.body.data.summary;
      expect(s.outcome).toBe('RECOVERED');
      expect(s.daysToRecover).toBe(15);
      expect(s.daysSick).toBe(15);
      expect(s.recurrence.isRecurrence).toBe(false);
      expect(s.totalCost).toBe(0);
    });

    it('keeps the existing case fields alongside the summary', async () => {
      const res = await request(server())
        .get(api(`/health/cases/${secondCase}`))
        .set(...auth(owner))
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: secondCase,
        condition: 'MASTITIS',
        careType: 'CURATIVE',
      });
      expect(Array.isArray(res.body.data.treatmentLogs)).toBe(true);
    });
  });

  describe('GET /health/outcomes', () => {
    it('adds this spec’s cases to the farm totals — and ignores the preventive backing case', async () => {
      const after = await outcomes();

      expect(after.cases - before.cases).toBe(2); // first + second; the PREVENTIVE one is excluded
      expect(after.recovered - before.recovered).toBe(1);
      expect(after.openCases - before.openCases).toBe(1);
      expect(after.totalCost - before.totalCost).toBeCloseTo(200, 2);
      expect(after.windowDays).toBe(90);
    });

    it('breaks results down by condition', async () => {
      const after = await outcomes();
      const mastitis = after.byCondition.find(
        (b: { condition: string }) => b.condition === 'MASTITIS',
      );
      expect(mastitis).toBeDefined();
      expect(mastitis.cases).toBeGreaterThanOrEqual(2);
    });

    it('a narrower window drops the older case', async () => {
      // first case opened 60 days ago, second 4 days ago
      const wide = await outcomes(90);
      const narrow = await outcomes(30);
      expect(wide.cases).toBeGreaterThan(narrow.cases);
    });

    it('validates the window (7–365 days)', async () => {
      await request(server())
        .get(api('/health/outcomes?days=3'))
        .set(...auth(owner))
        .expect(400);
      await request(server())
        .get(api('/health/outcomes?days=400'))
        .set(...auth(owner))
        .expect(400);
    });

    it('is readable by a worker (healthcare.read)', async () => {
      await request(server())
        .get(api('/health/outcomes'))
        .set(...auth(worker))
        .expect(200);
    });

    it('requires authentication', async () => {
      await request(server()).get(api('/health/outcomes')).expect(401);
    });
  });

  describe('GET /cattle/:id/health-summary (the cattle Health tab)', () => {
    it('already carries the structured fields next to the optional note', async () => {
      const res = await request(server())
        .get(api(`/cattle/${cowA}/health-summary`))
        .set(...auth(owner))
        .expect(200);

      const open = res.body.data.activeCases.find(
        (c: { id: string }) => c.id === secondCase,
      );
      expect(open).toMatchObject({
        note: 'Left hind quarter',
        condition: 'MASTITIS',
        careType: 'CURATIVE',
      });
      // no `diagnosis` field exists on these rows (RAKHAL-418) — readers must use `note`/`condition`
      expect(open.diagnosis).toBeUndefined();
    });
  });
});

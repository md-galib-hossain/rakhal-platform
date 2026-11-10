import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { seededCashAccountId } from './utils/finance';

/**
 * Reproduction + Health sync audit (2026-10-18): what a treatment void, a case
 * delete and a mortality must leave behind in AQR, the Activity Log, Finance
 * and Inventory.
 */
describe('Health — void / delete / mortality stay in sync with AQR, Activity Log, Finance, Inventory', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;

  let medicineId: string;

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
  const aqr = async (cattleId: string) =>
    (await prisma.cattle.findUniqueOrThrow({ where: { id: cattleId } }))
      .aqrScore;
  const stock = async () =>
    Number(
      (await prisma.medicine.findUniqueOrThrow({ where: { id: medicineId } }))
        .currentStock,
    );

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
    await seededCashAccountId(ctx, owner);
    const unit = await prisma.unit.findFirstOrThrow({
      where: { farmId: null, symbol: 'mL' },
    });
    medicineId = (
      await prisma.medicine.create({
        data: {
          farmId: owner.farmId,
          name: `E2E-SYNC-Med-${Date.now()}`,
          type: 'INJECTABLE',
          category: 'ANTIBIOTIC',
          unitId: unit.id,
          currentStock: 1000,
          costPerUnit: 20,
          purchaseDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 365 * 86_400_000).toISOString(),
          milkWithdrawalDays: 0,
          meatWithdrawalDays: 0,
          createdBy: ownerUserId,
        },
      })
    ).id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('voiding a quick treatment takes back its AQR +3 and writes an Activity Log entry', async () => {
    const cattleId = await makeCow(`E2E-SYNC-A-${Date.now()}`);
    const res = await request(server())
      .post(api('/health/treatments'))
      .set(...auth(owner))
      .send({
        cattleIds: [cattleId],
        medicineId,
        doseAmount: 5,
        doseUnit: 'mL',
        route: 'IM',
        treatedAt: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    const logId = res.body.data.results[0].treatmentLogId as string;
    expect(await aqr(cattleId)).toBe(3);

    const voidRes = await request(server())
      .post(api(`/health/treatments/${logId}/void`))
      .set(...auth(owner))
      .send({ reason: 'wrong cow' });
    expect(voidRes.status).toBe(200);

    expect(await aqr(cattleId)).toBe(0);
    const titles = (
      await prisma.activityLog.findMany({
        where: { farmId: owner.farmId, relatedCattleId: cattleId },
        select: { eventTitle: true },
      })
    ).map((a) => a.eventTitle);
    expect(titles).toContain('Reversal: Treatment Completed');
    expect(titles).toContain('Voided: Treatment');
  });

  it('deleting a case reverses its doses (stock, expense) and logs it', async () => {
    const cattleId = await makeCow(`E2E-SYNC-B-${Date.now()}`);
    const caseRes = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        note: 'E2E sync delete',
        careType: 'CURATIVE',
        priority: 'LOW',
      });
    expect(caseRes.status).toBe(201);
    const caseId = caseRes.body.data.id as string;

    const before = await stock();
    const logRes = await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({ medicineId, doseAmount: 10, doseUnit: 'mL', route: 'IM' });
    expect(logRes.status).toBe(201);
    expect(await stock()).toBe(before - 10);
    const treatment = await prisma.treatmentLog.findFirstOrThrow({
      where: { healthCaseId: caseId },
    });

    const del = await request(server())
      .delete(api(`/health/cases/${caseId}`))
      .set(...auth(owner));
    expect(del.status).toBe(200);

    expect(await stock()).toBe(before);
    const voided = await prisma.treatmentLog.findUniqueOrThrow({
      where: { id: treatment.id },
    });
    expect(voided.voidedAt).not.toBeNull();
    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: voided.financeTransactionId! },
    });
    expect(expense.voidedAt).not.toBeNull();
    const titles = (
      await prisma.activityLog.findMany({
        where: { farmId: owner.farmId, relatedCattleId: cattleId },
        select: { eventTitle: true },
      })
    ).map((a) => a.eventTitle);
    expect(titles).toContain('Deleted: Health case');
  });

  it("mortality disposalCost posts a Finance expense from the farm's single account", async () => {
    const cattleId = await makeCow(`E2E-SYNC-C-${Date.now()}`);
    const caseRes = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        note: 'E2E sync mortality',
        careType: 'CURATIVE',
        priority: 'LOW',
      });
    const caseId = caseRes.body.data.id as string;
    const mortality = {
      deathDate: new Date().toISOString(),
      primaryCauseOfDeath: 'Mastitis complications',
      disposalCost: 750,
    };

    // No account sent: the farm's single account is used.
    const ok = await request(server())
      .post(api(`/health/cases/${caseId}/close`))
      .set(...auth(owner))
      .send({ outcome: 'MORTALITY', mortality });
    expect(ok.status).toBe(201);

    const expense = await prisma.expense.findFirstOrThrow({
      where: { farmId: owner.farmId, cattleId, category: 'HEALTH' },
    });
    expect(Number(expense.amount)).toBe(750);
    const farmAccount = await prisma.financialAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(expense.financialAccountId).toBe(farmAccount.id);
  });
});

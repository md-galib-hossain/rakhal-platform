import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RD-013(d)/(e) — two report gaps this ticket closed:
 * (d) Annual Herd Inventory's "Estimated value" used to be the literal string
 *     "n/a — pending fixed-asset valuation (RD-010)"; now computed the same
 *     way `FinanceService.assets()` values the herd (sum of non-voided ANIMAL
 *     inventory-purchase transactions up to the report's year-end).
 * (e) Weekly Herd Health's "Medicine cost" was omitted (`TreatmentLog` has no
 *     cost field); now derived from `stockDeductionQuantity × Medicine.costPerUnit`
 *     for deducted treatments in the window.
 *
 * Creates its own isolated Finance/Medicine/Cattle/HealthCase/TreatmentLog
 * rows via Prisma (unique refs) so the assertions are exact deltas, not
 * dependent on the shared demo farm's accumulated state.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Reports — herd value + medicine cost (RD-013d/e)', () => {
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

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function pollUntilCompleted(jobId: string): Promise<any> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const res = await request(server())
        .get(api(`/reports/jobs/${jobId}`))
        .set(...auth(owner));
      const status = (res.body as { data: { status: string } }).data.status;
      if (status === 'completed' || status === 'failed') return res.body;
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(`Report job ${jobId} did not settle within 15s`);
  }

  async function generateCsv(
    reportId: string,
    parameters: Record<string, string>,
  ): Promise<string> {
    const generateRes = await request(server())
      .post(api('/reports/generate'))
      .set(...auth(owner))
      .send({ reportId, format: 'csv', parameters });
    expect(generateRes.status).toBe(201);
    const jobId = (generateRes.body as { data: { job_id: string } }).data
      .job_id;
    const settled = await pollUntilCompleted(jobId);
    expect((settled as { data: { status: string } }).data.status).toBe(
      'completed',
    );
    const download = await request(server())
      .get(api(`/reports/jobs/${jobId}/download`))
      .set(...auth(owner));
    expect(download.status).toBe(200);
    return download.text;
  }

  function metricValue(csv: string, label: string): string {
    const line = csv.split('\r\n').find((l) => l.startsWith(`${label},`));
    if (!line) throw new Error(`Row "${label}" not found in CSV`);
    return line.split(',')[1];
  }

  it('Annual Herd Inventory: estimated value reflects animal-purchase spend, not "n/a"', async () => {
    const year = 2019; // isolated year, unlikely to collide with other specs' fixtures
    const before = await generateCsv('rpt_annual_herd_inventory', {
      year: String(year),
    });
    const baseline = Number(metricValue(before, 'Estimated value (৳)'));
    expect(Number.isNaN(baseline)).toBe(false);

    await prisma.financeTransaction.create({
      data: {
        farmId: owner.farmId,
        reference: `E2E-RD013D-${Date.now()}`,
        date: new Date(Date.UTC(year, 5, 15)),
        type: 'INVENTORY_PURCHASE',
        category: 'INVENTORY',
        subType: 'animal',
        amount: 15000,
        createdBy: ownerUserId,
      },
    });

    const after = await generateCsv('rpt_annual_herd_inventory', {
      year: String(year),
    });
    const updated = Number(metricValue(after, 'Estimated value (৳)'));
    expect(updated).toBeCloseTo(baseline + 15000, 2);
  }, 30_000);

  it('Weekly Herd Health: medicine cost reflects deducted treatments', async () => {
    const before = await generateCsv('rpt_weekly_health', {
      fromDate: '2019-06-09',
      toDate: '2019-06-15',
    });
    const baseline = Number(metricValue(before, 'Medicine cost (৳)'));
    expect(Number.isNaN(baseline)).toBe(false);

    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-RD013E-${Date.now()}`,
        gender: 'FEMALE',
        purpose: 'MILK',
        createdBy: ownerUserId,
      },
    });
    const medicine = await prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: `E2E-RD013E-Med-${Date.now()}`,
        type: 'INJECTABLE',
        category: 'ANTIBIOTIC',
        unitId: 'unit_ml',
        currentStock: 100,
        costPerUnit: 12,
        lowStockThreshold: 0,
        purchaseDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 86_400_000),
        createdBy: ownerUserId,
      },
    });
    const healthCase = await prisma.healthCase.create({
      data: {
        farmId: owner.farmId,
        cattleId: cow.id,
        caseCode: `E2E-RD013E-${Date.now()}`,
        diagnosis: 'RD-013e e2e case',
        diagnosisType: 'DISEASE',
        priority: 'MEDIUM',
        status: 'ACTIVE',
        startDate: new Date(Date.UTC(2019, 5, 10)),
      },
    });
    await prisma.treatmentLog.create({
      data: {
        farmId: owner.farmId,
        cattleId: cow.id,
        healthCaseId: healthCase.id,
        medicineId: medicine.id,
        administeredAt: new Date(Date.UTC(2019, 5, 12)),
        administeredBy: ownerUserId,
        stockDeducted: true,
        stockDeductionQuantity: 5,
      },
    });

    const csv = await generateCsv('rpt_weekly_health', {
      fromDate: '2019-06-09',
      toDate: '2019-06-15',
    });
    const medicineCost = Number(metricValue(csv, 'Medicine cost (৳)'));
    expect(medicineCost).toBeCloseTo(baseline + 5 * 12, 2);
  }, 30_000);
});

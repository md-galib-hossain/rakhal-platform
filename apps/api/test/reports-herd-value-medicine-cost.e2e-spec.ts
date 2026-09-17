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

  // RAKHAL-354: `herdPurchaseValue()` used to read V1 `FinanceTransaction`
  // rows (`type: INVENTORY_PURCHASE, category: INVENTORY, subType: 'animal'`)
  // — the same read this test used to seed directly. That table is dropped;
  // no V2 "animal acquisition cost" concept exists to re-point it at
  // (RAKHAL-351 already flagged the gap, tech debt RD-065 tracks it). The
  // report still generates a real "Estimated value" number, it's just
  // permanently 0 now, not "n/a" (the original RD-013d bug this test
  // guarded against) and not silently missing from the CSV.
  it('Annual Herd Inventory: estimated value is a real number (0, not "n/a") — no V2 herd-acquisition-cost source exists (RD-065)', async () => {
    const year = 2019; // isolated year, unlikely to collide with other specs' fixtures
    const csv = await generateCsv('rpt_annual_herd_inventory', {
      year: String(year),
    });
    const value = Number(metricValue(csv, 'Estimated value (৳)'));
    expect(Number.isNaN(value)).toBe(false);
    expect(value).toBe(0);
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
        note: 'RD-013e e2e case',
        careType: 'CURATIVE',
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

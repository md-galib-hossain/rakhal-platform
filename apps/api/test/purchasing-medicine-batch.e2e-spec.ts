import request from 'supertest';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-436 (`docs/EPIC_MEDICINE_BATCH_MODEL.md`) — a medicine purchase line
 * now creates its own `MedicineBatch` (a real, separate lot) instead of
 * folding into whatever batch `MedicineService.adjustStock` would otherwise
 * pick. Proves: `expiryDate` is required on a medicine line; a purchase
 * creates a batch with the line's own cost/expiry; a second purchase of the
 * same product at a different cost/expiry creates a second, distinct batch
 * rather than blending into the first; `Medicine.currentStock` (the synced
 * summary) reflects the sum across both.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Purchasing — medicine line creates a real MedicineBatch (e2e, RAKHAL-436)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const uniqueName = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

  async function createMedicine() {
    const now = new Date();
    return prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: uniqueName('E2E-436-Medicine'),
        type: 'INJECTABLE',
        category: 'ANTIBIOTIC',
        unitId: 'unit_ml',
        currentStock: 0,
        costPerUnit: 0,
        lowStockThreshold: 0,
        purchaseDate: now,
        expiryDate: new Date(now.getTime() + 365 * 86_400_000),
        createdBy: ownerUserId,
      },
    });
  }

  it('rejects a medicine purchase line with no expiryDate', async () => {
    const medicine = await createMedicine();

    await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [{ medicineId: medicine.id, quantity: 10, unitCost: 15 }],
      })
      .expect(400);
  });

  it('creates a MedicineBatch per purchase — two purchases at different cost/expiry produce two distinct batches, not a blended one', async () => {
    const medicine = await createMedicine();
    const firstExpiry = new Date(Date.now() + 60 * 86_400_000).toISOString();
    const secondExpiry = new Date(Date.now() + 120 * 86_400_000).toISOString();

    const res1 = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [
          {
            medicineId: medicine.id,
            quantity: 10,
            unitCost: 15,
            expiryDate: firstExpiry,
            batchCode: 'LOT-A',
          },
        ],
      })
      .expect(201);
    expect(res1.body.data.status).toBeDefined();

    const res2 = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [
          {
            medicineId: medicine.id,
            quantity: 5,
            unitCost: 22,
            expiryDate: secondExpiry,
            batchCode: 'LOT-B',
          },
        ],
      })
      .expect(201);
    expect(res2.body.data.status).toBeDefined();

    const batches = await prisma.medicineBatch.findMany({
      where: { medicineId: medicine.id },
      orderBy: { batchCode: 'asc' },
    });
    expect(batches).toHaveLength(2);
    expect(batches[0].batchCode).toBe('LOT-A');
    expect(batches[0].currentStock).toBe(10);
    expect(batches[0].costPerUnit).toBe(15);
    expect(batches[1].batchCode).toBe('LOT-B');
    expect(batches[1].currentStock).toBe(5);
    expect(batches[1].costPerUnit).toBe(22);

    const updatedMedicine = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(updatedMedicine.currentStock).toBe(15); // 10 + 5, summed across both batches
  });
});

import request from 'supertest';
import {
  FinancialAccountType,
  MedicineStockMovementReason,
  PaymentMethod,
} from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-376 (MILESTONE 22, `BUSINESS_IA_PRD.md` §1.4/§16.8) — HTTP routes
 * for the orphaned use cases. `SellAnimalUseCase` already had a route
 * (RAKHAL-357/399, `AnimalSaleController`) before this ticket — out of
 * scope here. This spec proves the three genuinely new routes are reachable
 * over real HTTP, guard-chained, and pass through to the exact same
 * use-case logic their own dedicated e2e specs (`sell-inventory`,
 * `sell-manure`, `purchasing-pay-supplier`) already prove functionally —
 * this spec's job is the HTTP wiring, not re-deriving that functional
 * matrix:
 *
 * - `POST /sales/inventory` -> `SellInventoryUseCase`;
 * - `POST /sales/manure` -> `RecordManureSaleUseCase`;
 * - `POST /purchasing/payables/:id/payments` -> `PaySupplierUseCase`;
 * - each rejects a Worker login (no `sales.create`/`purchasing.create`) with 403.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Orphaned use-case HTTP routes (e2e, RAKHAL-376)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const uniqueTag = () =>
    `E2E-376-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const createdAccountIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.financialAccount
      .deleteMany({ where: { id: { in: createdAccountIds } } })
      .catch(() => undefined);
    await ctx.app.close();
  });

  async function createAccount(): Promise<string> {
    const res = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({
        name: `E2E-376-Account-${uniqueTag()}`,
        type: FinancialAccountType.CASH,
      })
      .expect(201);
    const id = (res.body as { data: { id: string } }).data.id;
    createdAccountIds.push(id);
    return id;
  }

  it('POST /sales/inventory sells a Medicine and decrements stock', async () => {
    const medicine = await prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: `E2E-376 Medicine ${uniqueTag()}`,
        type: 'INJECTABLE',
        category: 'ANTIBIOTIC',
        unitId: 'unit_ml',
        currentStock: 100,
        costPerUnit: 10,
        lowStockThreshold: 0,
        purchaseDate: new Date(),
        expiryDate: new Date(Date.now() + 90 * 86_400_000),
        createdBy: ownerUserId,
        stockMovements: {
          create: {
            farmId: owner.farmId,
            reason: MedicineStockMovementReason.PURCHASE,
            delta: 100,
            balanceAfter: 100,
            createdBy: ownerUserId,
            notes: 'Opening stock',
          },
        },
      },
    });

    const res = await request(server())
      .post(api('/sales/inventory'))
      .set(...bearer(owner))
      .send({
        itemType: 'MEDICINE',
        itemId: medicine.id,
        quantity: 10,
        unitPrice: 50,
        saleDate: new Date().toISOString(),
      })
      .expect(201);
    expect(res.body.data.sale.status).toBe('CONFIRMED');
    expect(res.body.data.sale.totalAmount).toBe('500');

    const updated = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(updated.currentStock).toBe(90);

    await request(server())
      .post(api('/sales/inventory'))
      .set(...bearer(worker))
      .send({
        itemType: 'MEDICINE',
        itemId: medicine.id,
        quantity: 1,
        unitPrice: 50,
        saleDate: new Date().toISOString(),
      })
      .expect(403);
  });

  it('POST /sales/manure records a revenue-first manure sale', async () => {
    const accountId = await createAccount();

    const res = await request(server())
      .post(api('/sales/manure'))
      .set(...bearer(owner))
      .send({
        totalAmount: 400,
        saleDate: new Date().toISOString(),
        amountReceived: 400,
        financialAccountId: accountId,
        paymentMethod: PaymentMethod.CASH,
        notes: `E2E-376 manure ${uniqueTag()}`,
      })
      .expect(201);
    expect(res.body.data.sale.status).toBe('CONFIRMED');
    expect(res.body.data.paymentId).not.toBeNull();

    await request(server())
      .post(api('/sales/manure'))
      .set(...bearer(worker))
      .send({ totalAmount: 100, saleDate: new Date().toISOString() })
      .expect(403);
  });

  it('POST /purchasing/payables/:id/payments pays down a real Payable', async () => {
    const accountId = await createAccount();
    const supplier = await prisma.supplier.create({
      data: {
        farmId: owner.farmId,
        name: `E2E-376 Supplier ${uniqueTag()}`,
        paymentTermsDays: 0,
      },
    });
    const purchase = await prisma.purchase.create({
      data: {
        farmId: owner.farmId,
        supplierId: supplier.id,
        purchaseNumber: `E2E-376-PUR-${uniqueTag()}`,
        purchaseDate: new Date(),
        totalAmount: 1000,
        createdById: ownerUserId,
      },
    });
    const payable = await prisma.payable.create({
      data: {
        farmId: owner.farmId,
        purchaseId: purchase.id,
        supplierId: supplier.id,
        totalAmount: 1000,
        dueDate: null,
      },
    });

    const res = await request(server())
      .post(api(`/purchasing/payables/${payable.id}/payments`))
      .set(...bearer(owner))
      .send({
        financialAccountId: accountId,
        amount: 600,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    expect(res.body.data.payable.status).toBe('PARTIALLY_PAID');
    expect(res.body.data.payable.outstanding).toBe('400');

    await request(server())
      .post(api(`/purchasing/payables/${payable.id}/payments`))
      .set(...bearer(worker))
      .send({
        financialAccountId: accountId,
        amount: 100,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(403);
  });
});

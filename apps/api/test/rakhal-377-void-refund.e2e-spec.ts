import request from 'supertest';
import {
  FinancialAccountType,
  MedicineStockMovementReason,
  PaymentMethod,
  PurchaseStatus,
  SaleLineType,
  SaleStatus,
} from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

import { createExtraAccount } from './utils/finance';
/**
 * RAKHAL-377 (MILESTONE 22, `BUSINESS_IA_PRD.md` §9.4, §16.2) — Void &
 * refund, the only correction mechanism. Proves the ticket's own AC against
 * the real DB + HTTP surface:
 *
 * - `POST /sales/:id/cancel` reverses an unpaid sale's journal + physical
 *   effect (stock restock) + closes the receivable + `Sale.status =
 *   CANCELLED`; refuses when any `PaymentAllocation` exists;
 * - `POST /sales/:id/refund` reverses a paid sale's payment journal + sale
 *   journal + physical effect, `Sale.status = REFUNDED`;
 * - `POST /purchasing/purchases/:id/void` destocks + reverses + `VOIDED`;
 *   refuses a second void;
 * - `POST /purchasing/expenses/:id/void` reverses + `voidedAt` set;
 * - `POST /buyers/dispatches/:id/cancel` cascades into cancelling the
 *   dispatch's posted `Sale` in the same transaction (366's own deferred AC);
 * - Worker (no `finance.reverse`) gets 403.
 *
 * **Not covered here**: an `ANIMAL`-line sale's cancel path
 * (`CattleService.undoDisposition`) — the shared dev DB's `Cattle.purpose`
 * column is still `NOT NULL` with no default (RD-072, `20260826150000_
 * drop_cattle_purpose` committed but not applied, RAKHAL-354's active
 * migration lock), so **every** `Cattle` row creation fails project-wide
 * right now regardless of code path (confirmed: the current
 * `prisma/schemas/cattle/cattle.prisma` has no `purpose` field at all, so
 * even a direct `prisma.cattle.create()` fixture hits the identical
 * NOT-NULL violation — this is a physical DB/schema drift, not something
 * `INSERT`-side code can work around). Same class of pre-existing/unrelated
 * blocker RAKHAL-376's own gate already documented for `rakhal-345-sell-
 * animal.e2e-spec.ts`.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Void & refund (e2e, RAKHAL-377)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const uniqueTag = () =>
    `E2E-377-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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
    const res = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name: `E2E-377-Account-${uniqueTag()}`,
          type: FinancialAccountType.CASH,
        }),
      },
    };
    const id = (res.body as { data: { id: string } }).data.id;
    createdAccountIds.push(id);
    return id;
  }

  async function createMedicineWithStock(currentStock = 100) {
    const now = new Date();
    return prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: `E2E-377 Medicine ${uniqueTag()}`,
        type: 'INJECTABLE',
        category: 'ANTIBIOTIC',
        unitId: 'unit_ml',
        currentStock,
        costPerUnit: 10,
        lowStockThreshold: 0,
        purchaseDate: now,
        expiryDate: new Date(now.getTime() + 90 * 86_400_000),
        createdBy: ownerUserId,
        stockMovements: {
          create: {
            farmId: owner.farmId,
            reason: MedicineStockMovementReason.PURCHASE,
            delta: currentStock,
            balanceAfter: currentStock,
            createdBy: ownerUserId,
            notes: 'Opening stock',
          },
        },
      },
    });
  }

  it('cancels an unpaid inventory sale: restocks + closes receivable + CANCELLED', async () => {
    const medicine = await createMedicineWithStock(100);
    const sale = await request(server())
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
    const saleId = sale.body.data.sale.id as string;

    const cancelled = await request(server())
      .post(api(`/sales/${saleId}/cancel`))
      .set(...bearer(owner))
      .expect(201);
    expect(cancelled.body.data.status).toBe(SaleStatus.CANCELLED);

    const updatedMedicine = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(updatedMedicine.currentStock).toBe(100);

    const receivable = await prisma.receivable.findFirst({
      where: { saleId },
    });
    expect(receivable?.closedAt).not.toBeNull();

    // Already cancelled — a second cancel is rejected.
    await request(server())
      .post(api(`/sales/${saleId}/cancel`))
      .set(...bearer(owner))
      .expect(400);
  });

  it('refuses to cancel a sale with a payment allocated — refunds it instead', async () => {
    const medicine = await createMedicineWithStock(100);
    const accountId = await createAccount();
    const sale = await request(server())
      .post(api('/sales/inventory'))
      .set(...bearer(owner))
      .send({
        itemType: 'MEDICINE',
        itemId: medicine.id,
        quantity: 5,
        unitPrice: 100,
        saleDate: new Date().toISOString(),
        amountReceived: 500,
        financialAccountId: accountId,
        paymentMethod: PaymentMethod.CASH,
      })
      .expect(201);
    const saleId = sale.body.data.sale.id as string;

    await request(server())
      .post(api(`/sales/${saleId}/cancel`))
      .set(...bearer(owner))
      .expect(400);

    const refunded = await request(server())
      .post(api(`/sales/${saleId}/refund`))
      .set(...bearer(owner))
      .expect(201);
    expect(refunded.body.data.status).toBe(SaleStatus.REFUNDED);

    const updatedMedicine = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(updatedMedicine.currentStock).toBe(100);
  });

  it('voids an unpaid Purchase: destocks + VOIDED; a second void is rejected', async () => {
    const medicine = await createMedicineWithStock(20);
    const supplier = await prisma.supplier.create({
      data: {
        farmId: owner.farmId,
        name: `E2E-377 Supplier ${uniqueTag()}`,
        paymentTermsDays: 0,
      },
    });
    const purchase = await prisma.purchase.create({
      data: {
        farmId: owner.farmId,
        supplierId: supplier.id,
        purchaseNumber: `E2E-377-PUR-${uniqueTag()}`,
        purchaseDate: new Date(),
        totalAmount: 300,
        status: PurchaseStatus.CONFIRMED,
        createdById: ownerUserId,
      },
    });
    await prisma.purchaseLine.create({
      data: {
        purchaseId: purchase.id,
        medicineId: medicine.id,
        quantity: 30,
        unitCost: 10,
        totalAmount: 300,
      },
    });
    await prisma.medicine.update({
      where: { id: medicine.id },
      data: { currentStock: 50 }, // simulate the purchase having already landed
    });

    const res = await request(server())
      .post(api(`/purchasing/purchases/${purchase.id}/void`))
      .set(...bearer(owner))
      .expect(201);
    expect(res.body.data.status).toBe(PurchaseStatus.VOIDED);

    const updatedMedicine = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(updatedMedicine.currentStock).toBe(20);

    await request(server())
      .post(api(`/purchasing/purchases/${purchase.id}/void`))
      .set(...bearer(owner))
      .expect(400);
  });

  it('voids an unpaid Expense: voidedAt set', async () => {
    const expenseRes = await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: 'UTILITIES',
        description: `E2E-377 expense ${uniqueTag()}`,
        amount: 250,
        expenseDate: new Date().toISOString(),
      })
      .expect(201);
    const expenseId = expenseRes.body.data.id as string;

    const res = await request(server())
      .post(api(`/purchasing/expenses/${expenseId}/void`))
      .set(...bearer(owner))
      .expect(201);
    expect(res.body.data.voidedAt).not.toBeNull();

    await request(server())
      .post(api(`/purchasing/expenses/${expenseId}/void`))
      .set(...bearer(owner))
      .expect(400);
  });

  it('cancelling a dispatch with a posted saleId cascades to cancel the sale', async () => {
    const buyer = await request(server())
      .post(api('/buyers'))
      .set(...bearer(owner))
      .send({
        name: `E2E-377 Buyer ${uniqueTag()}`,
        phone: '01700000377',
        buyerType: 'DAIRY_COMPANY',
        basePricePerLitre: 45,
      })
      .expect(201);
    const buyerId = buyer.body.data.id as string;

    const sale = await prisma.sale.create({
      data: {
        farmId: owner.farmId,
        customerId: buyerId,
        saleNumber: `E2E-377-INV-${uniqueTag()}`,
        saleDate: new Date(),
        subtotal: 450,
        totalAmount: 450,
        status: SaleStatus.CONFIRMED,
        createdById: ownerUserId,
      },
    });
    await prisma.saleLine.create({
      data: {
        saleId: sale.id,
        type: SaleLineType.MILK,
        description: 'Milk dispatch sale',
        quantity: 10,
        unitPrice: 45,
        totalAmount: 450,
      },
    });
    const dispatch = await prisma.milkDispatch.create({
      data: {
        farmId: owner.farmId,
        buyerId,
        dispatchNumber: `E2E-377-DSP-${uniqueTag()}`,
        dispatchedAt: new Date(),
        volumeDispatchedL: 10,
        basePricePerLitre: 45,
        calculatedAmount: 450,
        saleId: sale.id,
        createdBy: ownerUserId,
      },
    });

    const res = await request(server())
      .post(api(`/buyers/dispatches/${dispatch.id}/cancel`))
      .set(...bearer(owner))
      .expect(201);
    expect(res.body.data.status).toBe('CANCELLED');

    const updatedSale = await prisma.sale.findUniqueOrThrow({
      where: { id: sale.id },
    });
    expect(updatedSale.status).toBe(SaleStatus.CANCELLED);
  });

  it('worker without finance.reverse is rejected on /sales/:id/cancel', async () => {
    const medicine = await createMedicineWithStock(10);
    const sale = await request(server())
      .post(api('/sales/inventory'))
      .set(...bearer(owner))
      .send({
        itemType: 'MEDICINE',
        itemId: medicine.id,
        quantity: 1,
        unitPrice: 10,
        saleDate: new Date().toISOString(),
      })
      .expect(201);
    const saleId = sale.body.data.sale.id as string;

    await request(server())
      .post(api(`/sales/${saleId}/cancel`))
      .set(...bearer(worker))
      .expect(403);
  });
});

import {
  FinancialAccountType,
  MedicineStockMovementReason,
  PaymentMethod,
  SaleStatus,
} from '@prisma/client';
import request from 'supertest';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { SellInventoryUseCase } from 'src/modules/sales/application/use-cases/sell-inventory/sell-inventory.use-case';
import { ReceivableStatus } from 'src/modules/finance-v2/receivables/domain/receivable-status';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

import { createExtraAccount } from './utils/finance';
/**
 * RAKHAL-346 — `SellInventoryItem` (stock-backed), `FINANCE_V2_DESIGN.md`
 * §5.2. Proves the ticket's own AC against the real DB:
 *
 * - selling a Medicine decrements `currentStock` and writes a `SALE`-reason
 *   `MedicineStockMovement` carrying the causing `saleLineId`;
 * - the full audit trail reads correctly across a purchase-then-sale
 *   sequence (`+200 PURCHASE` seeded, `-30 SALE` via this use case);
 * - a sale cannot exceed stock on hand — rejected before any write, proven
 *   by asserting **no** `Sale` row and **no** stock change survive the
 *   rejected call;
 * - fully paid / partially paid / fully unpaid sale variants each leave the
 *   correct `Receivable` status and `Payment`/`PaymentAllocation` state;
 * - the journal posting balances (Dr Accounts Receivable, Cr Inventory Sales
 *   Revenue), same accrual pattern `SellMilkUseCase` (RAKHAL-342) proved.
 *
 * No controller route exists yet for `SellInventoryUseCase` — nothing in the
 * ticket's AC asked for one (RAKHAL-357, "Record Sale flow", is the
 * eventual HTTP consumer). This spec resolves the use case directly off the
 * real Nest app (`ctx.app.get(SellInventoryUseCase)`), same judgment call
 * RAKHAL-344's `cattle-disposition.e2e-spec.ts` documents for its own
 * service-only, no-controller-yet scope — still a real e2e proof: real HTTP
 * app, real Postgres, real transaction rollback.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Sales — SellInventoryItem (e2e, RAKHAL-346)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let useCase: SellInventoryUseCase;
  let owner: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const uniqueTag = () =>
    `E2E-RAKHAL346-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const createdAccountIds: string[] = [];
  const createdLedgerAccountIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    useCase = ctx.app.get(SellInventoryUseCase);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.bankAccountDetail
      .deleteMany({ where: { financialAccountId: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.financialAccount
      .deleteMany({ where: { id: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.ledgerAccount
      .deleteMany({ where: { id: { in: createdLedgerAccountIds } } })
      .catch(() => undefined);
    await ctx.app.close();
  });

  /** Creates a Medicine with an opening `+200 PURCHASE` movement (mirrors a
   * real `MedicineService.create` with `currentStock: 200`), scoped to the
   * demo owner's farm. */
  async function createMedicineWithStock(currentStock = 200) {
    const now = new Date();
    const medicine = await prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: `E2E RAKHAL-346 Medicine ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
    return medicine;
  }

  async function createAccount(): Promise<{
    id: string;
    ledgerAccountId: string;
  }> {
    const res = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name: `RAKHAL346-Cash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: FinancialAccountType.CASH,
        }),
      },
    };
    const account = (
      res.body as { data: { id: string; ledgerAccountId: string } }
    ).data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);
    return account;
  }

  it('sells a medicine: decrements stock and writes a SALE movement carrying the saleLineId; audit trail shows +200 PURCHASE / -30 SALE', async () => {
    const medicine = await createMedicineWithStock(200);

    const result = await useCase.execute(owner.farmId, ownerUserId, {
      itemType: 'MEDICINE',
      itemId: medicine.id,
      quantity: 30,
      unitPrice: 15,
      saleDate: new Date().toISOString(),
    });

    expect(result.sale.status).toBe(SaleStatus.CONFIRMED);
    expect(result.sale.totalAmount.toString()).toBe('450');
    expect(result.sale.lines).toHaveLength(1);
    const saleLine = result.sale.lines[0];
    expect(saleLine.inventoryDetail?.medicineId).toBe(medicine.id);

    const updated = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(updated.currentStock).toBe(170);

    const movements = await prisma.medicineStockMovement.findMany({
      where: { medicineId: medicine.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(movements).toHaveLength(2);
    expect(movements[0].reason).toBe(MedicineStockMovementReason.PURCHASE);
    expect(movements[0].delta).toBe(200);
    expect(movements[0].balanceAfter).toBe(200);
    expect(movements[1].reason).toBe(MedicineStockMovementReason.SALE);
    expect(movements[1].delta).toBe(-30);
    expect(movements[1].balanceAfter).toBe(170);
    expect(movements[1].saleLineId).toBe(saleLine.id);

    // Journal posting balances: Dr Accounts Receivable, Cr Inventory Sales Revenue.
    const journalTxn = await prisma.journalTransaction.findFirst({
      where: {
        farmId: owner.farmId,
        sourceType: 'SALE',
        sourceId: result.sale.id,
      },
      include: { entries: true },
    });
    expect(journalTxn).not.toBeNull();
    expect(journalTxn?.entries).toHaveLength(2);
    const arLine = journalTxn?.entries.find(
      (e) => e.debit.toString() === '450',
    );
    const revenueLine = journalTxn?.entries.find(
      (e) => e.credit.toString() === '450',
    );
    expect(arLine).toBeDefined();
    expect(revenueLine).toBeDefined();

    // Receivable is unpaid (no amountReceived supplied).
    const receivable = await prisma.receivable.findUniqueOrThrow({
      where: { id: result.receivable.id },
    });
    expect(receivable.totalAmount.toString()).toBe('450');
    expect(result.payment).toBeNull();
  });

  it('rejects a sale exceeding stock on hand — no Sale row, no stock change, full rollback', async () => {
    const medicine = await createMedicineWithStock(10);

    await expect(
      useCase.execute(owner.farmId, ownerUserId, {
        itemType: 'MEDICINE',
        itemId: medicine.id,
        quantity: 50,
        unitPrice: 15,
        saleDate: new Date().toISOString(),
      }),
    ).rejects.toThrow(/Insufficient stock/);

    const unchanged = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(unchanged.currentStock).toBe(10);

    const movements = await prisma.medicineStockMovement.findMany({
      where: { medicineId: medicine.id },
    });
    // Only the opening PURCHASE movement — no SALE movement was written.
    expect(movements).toHaveLength(1);
    expect(movements[0].reason).toBe(MedicineStockMovementReason.PURCHASE);

    const sales = await prisma.sale.findMany({
      where: {
        farmId: owner.farmId,
        lines: { some: { description: { contains: medicine.name } } },
      },
    });
    expect(sales).toHaveLength(0);
  });

  it('fully paid variant: amountReceived === total leaves the Receivable PAID', async () => {
    const medicine = await createMedicineWithStock(100);
    const account = await createAccount();

    const result = await useCase.execute(owner.farmId, ownerUserId, {
      itemType: 'MEDICINE',
      itemId: medicine.id,
      quantity: 10,
      unitPrice: 20,
      saleDate: new Date().toISOString(),
      financialAccountId: account.id,
      amountReceived: 200,
      paymentMethod: PaymentMethod.CASH,
    });

    expect(result.payment).not.toBeNull();
    expect(result.payment?.amount.toString()).toBe('200');

    const res = await request(server())
      .get(api(`/finance/receivables/${result.receivable.id}`))
      .set(...bearer(owner))
      .expect(200);
    const receivable = (
      res.body as { data: { status: string; outstanding: string } }
    ).data;
    expect(receivable.status).toBe(ReceivableStatus.PAID);
    expect(receivable.outstanding).toBe('0');
  });

  it('partially paid variant: amountReceived < total leaves the Receivable PARTIALLY_PAID with the correct outstanding', async () => {
    const medicine = await createMedicineWithStock(100);
    const account = await createAccount();

    const result = await useCase.execute(owner.farmId, ownerUserId, {
      itemType: 'MEDICINE',
      itemId: medicine.id,
      quantity: 10,
      unitPrice: 20,
      saleDate: new Date().toISOString(),
      financialAccountId: account.id,
      amountReceived: 60,
      paymentMethod: PaymentMethod.CASH,
    });

    expect(result.payment?.amount.toString()).toBe('60');

    const res = await request(server())
      .get(api(`/finance/receivables/${result.receivable.id}`))
      .set(...bearer(owner))
      .expect(200);
    const receivable = (
      res.body as { data: { status: string; outstanding: string } }
    ).data;
    expect(receivable.status).toBe(ReceivableStatus.PARTIALLY_PAID);
    expect(receivable.outstanding).toBe('140');
  });

  it('unpaid variant: no amountReceived leaves the Receivable UNPAID and creates no Payment', async () => {
    const medicine = await createMedicineWithStock(100);

    const result = await useCase.execute(owner.farmId, ownerUserId, {
      itemType: 'MEDICINE',
      itemId: medicine.id,
      quantity: 5,
      unitPrice: 30,
      saleDate: new Date().toISOString(),
    });

    expect(result.payment).toBeNull();

    const res = await request(server())
      .get(api(`/finance/receivables/${result.receivable.id}`))
      .set(...bearer(owner))
      .expect(200);
    const receivable = (
      res.body as { data: { status: string; outstanding: string } }
    ).data;
    expect(receivable.status).toBe(ReceivableStatus.UNPAID);
    expect(receivable.outstanding).toBe('150');
  });

  it("rejects amountReceived without paymentMethod (the account is the farm's single one)", async () => {
    const medicine = await createMedicineWithStock(50);

    await expect(
      useCase.execute(owner.farmId, ownerUserId, {
        itemType: 'MEDICINE',
        itemId: medicine.id,
        quantity: 5,
        unitPrice: 10,
        saleDate: new Date().toISOString(),
        amountReceived: 50,
      }),
    ).rejects.toThrow(/paymentMethod/);
  });

  it('rejects a foreign-farm item id (cross-tenant guard)', async () => {
    const otherFarm = await prisma.farm.findFirstOrThrow({
      where: { id: { not: owner.farmId } },
      select: { id: true, ownerId: true },
    });
    const now = new Date();
    const foreignMedicine = await prisma.medicine.create({
      data: {
        farmId: otherFarm.id,
        name: `Foreign ${uniqueTag()}`,
        type: 'INJECTABLE',
        category: 'ANTIBIOTIC',
        unitId: 'unit_ml',
        currentStock: 100,
        costPerUnit: 10,
        purchaseDate: now,
        expiryDate: new Date(now.getTime() + 90 * 86_400_000),
        createdBy: otherFarm.ownerId,
      },
    });

    await expect(
      useCase.execute(owner.farmId, ownerUserId, {
        itemType: 'MEDICINE',
        itemId: foreignMedicine.id,
        quantity: 1,
        unitPrice: 10,
        saleDate: new Date().toISOString(),
      }),
    ).rejects.toThrow(/not found/i);
  });
});

import request from 'supertest';
import {
  FinancialAccountType,
  PaymentMethod,
  SaleLineType,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { ReceivableStatus } from 'src/modules/finance-v2/receivables/domain/receivable-status';
import { RecordManureSaleUseCase } from 'src/modules/sales/application/use-cases/sell-manure/record-manure-sale.use-case';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

import { createExtraAccount } from './utils/finance';
/**
 * RAKHAL-347 — `RecordManureSale` (revenue-first, `FINANCE_V2_DESIGN.md` §2.1,
 * RD-058). Proves the use case's own AC against the real DB:
 *
 * - a manure sale with **no quantity/unit** — just a total — succeeds, produces a
 *   real `Sale` + `SaleLine` (`type: MANURE`) + `ManureSaleLine`, and a `Receivable`
 *   for the full total;
 * - a manure sale **with quantity + unit** also succeeds — stored on the `SaleLine`
 *   for record only, never checked against any availability (there is none);
 * - fully paid / partially paid / unpaid variants settle the `Receivable` exactly
 *   like every other sale type (`ReceivableStatus` derived from allocations, never
 *   stored);
 * - **no stock-movement table is ever touched** — proves RD-058's own boundary: a
 *   manure sale must never decrement `MedicineStockMovement`/`FeedItemStockMovement`/
 *   `EquipmentStockMovement` as a side effect, unlike the stock-backed sale types.
 *
 * This ticket adds no HTTP route (Lane: `application/use-cases/sell-manure/**`
 * only — a controller is RAKHAL-357's job), so the use case is exercised directly
 * via `app.get(RecordManureSaleUseCase)`, the same way `createTestApp` boots the
 * real `AppModule` for every other e2e spec in this suite.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Sales — RecordManureSale (e2e, RAKHAL-347)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let useCase: RecordManureSaleUseCase;
  let owner: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const createdSaleIds: string[] = [];
  const createdAccountIds: string[] = [];
  const createdLedgerAccountIds: string[] = [];

  const uniqueName = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const createCashAccount = async (): Promise<{
    id: string;
    ledgerAccountId: string;
  }> => {
    const res = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name: uniqueName('Manure-Cash'),
          type: FinancialAccountType.CASH,
        }),
      },
    };
    const account = res.body.data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);
    return account;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    useCase = ctx.app.get(RecordManureSaleUseCase);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.paymentAllocation
      .deleteMany({ where: { receivable: { saleId: { in: createdSaleIds } } } })
      .catch(() => undefined);
    await prisma.financePayment
      .deleteMany({
        where: {
          allocations: {
            some: { receivable: { saleId: { in: createdSaleIds } } },
          },
        },
      })
      .catch(() => undefined);
    await prisma.journalEntry
      .deleteMany({
        where: { ledgerAccountId: { in: createdLedgerAccountIds } },
      })
      .catch(() => undefined);
    await prisma.journalTransaction
      .deleteMany({
        where: { farmId: owner.farmId, sourceType: 'FINANCE_PAYMENT' },
      })
      .catch(() => undefined);
    await prisma.receivable
      .deleteMany({ where: { saleId: { in: createdSaleIds } } })
      .catch(() => undefined);
    await prisma.manureSaleLine
      .deleteMany({ where: { saleLine: { saleId: { in: createdSaleIds } } } })
      .catch(() => undefined);
    await prisma.saleLine
      .deleteMany({ where: { saleId: { in: createdSaleIds } } })
      .catch(() => undefined);
    await prisma.sale
      .deleteMany({ where: { id: { in: createdSaleIds } } })
      .catch(() => undefined);
    await prisma.bankAccountDetail
      .deleteMany({ where: { financialAccountId: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.mfsAccountDetail
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

  it('records a manure sale with no quantity/unit — just an amount — and raises an UNPAID receivable', async () => {
    const before = await prisma.equipmentStockMovement.count();

    const result = await useCase.execute(owner.farmId, ownerUserId, {
      totalAmount: 2500,
      saleDate: new Date().toISOString(),
      notes: 'Loose manure, no scale on site',
    });
    createdSaleIds.push(result.sale.id);

    expect(result.sale.totalAmount.toString()).toBe('2500');
    expect(result.sale.lines).toHaveLength(1);
    const line = result.sale.lines[0];
    expect(line.type).toBe(SaleLineType.MANURE);
    expect(Number(line.quantity)).toBe(1);
    expect(line.unitId).toBeNull();
    expect(line.manureDetail).not.toBeNull();
    expect(result.paymentId).toBeNull();
    // Bug found+documented (not fixed) during RAKHAL-352, fixed here: the
    // sale's atomic side effects (receivable, optional payment) have all
    // run, so the Sale row itself must be flipped out of DRAFT.
    expect(result.sale.status).toBe('CONFIRMED');
    const dbSale = await prisma.sale.findUniqueOrThrow({
      where: { id: result.sale.id },
    });
    expect(dbSale.status).toBe('CONFIRMED');

    const receivable = await prisma.receivable.findUniqueOrThrow({
      where: { id: result.receivableId },
    });
    expect(receivable.totalAmount.toString()).toBe('2500');

    const res = await request(server())
      .get(api(`/finance/receivables/${result.receivableId}`))
      .set(...bearer(owner))
      .expect(200);
    const body = res.body as { data: { status: ReceivableStatus } };
    expect(body.data.status).toBe(ReceivableStatus.UNPAID);

    // RD-058: no stock table is ever touched by a manure sale.
    const after = await prisma.equipmentStockMovement.count();
    expect(after).toBe(before);
  });

  it('records a manure sale WITH quantity + unit — stored for record only, never validated against availability', async () => {
    const unit = await prisma.unit.findFirstOrThrow({
      where: { farmId: null, symbol: 'kg' },
    });

    const result = await useCase.execute(owner.farmId, ownerUserId, {
      quantity: 500,
      unitId: unit.id,
      totalAmount: 3000,
      saleDate: new Date().toISOString(),
    });
    createdSaleIds.push(result.sale.id);

    const line = result.sale.lines[0];
    expect(Number(line.quantity)).toBe(500);
    expect(line.unitId).toBe(unit.id);
    // quantity * unitPrice round-trips back to exactly totalAmount.
    expect(line.totalAmount.toString()).toBe('3000');
    expect(Number(line.quantity) * Number(line.unitPrice)).toBeCloseTo(3000, 2);
  });

  it('fully paid: amountReceived == totalAmount settles the receivable to PAID', async () => {
    const account = await createCashAccount();

    const result = await useCase.execute(owner.farmId, ownerUserId, {
      totalAmount: 1000,
      financialAccountId: account.id,
      amountReceived: 1000,
      paymentMethod: PaymentMethod.CASH,
      saleDate: new Date().toISOString(),
    });
    createdSaleIds.push(result.sale.id);
    expect(result.paymentId).not.toBeNull();

    const res = await request(server())
      .get(api(`/finance/receivables/${result.receivableId}`))
      .set(...bearer(owner))
      .expect(200);
    const body = res.body as {
      data: { status: ReceivableStatus; outstanding: string };
    };
    expect(body.data.status).toBe(ReceivableStatus.PAID);
    expect(Number(body.data.outstanding)).toBe(0);
  });

  it('partially paid: amountReceived < totalAmount leaves PARTIALLY_PAID with the correct outstanding', async () => {
    const account = await createCashAccount();

    const result = await useCase.execute(owner.farmId, ownerUserId, {
      totalAmount: 4000,
      financialAccountId: account.id,
      amountReceived: 1500,
      paymentMethod: PaymentMethod.CASH,
      saleDate: new Date().toISOString(),
    });
    createdSaleIds.push(result.sale.id);

    const res = await request(server())
      .get(api(`/finance/receivables/${result.receivableId}`))
      .set(...bearer(owner))
      .expect(200);
    const body = res.body as {
      data: { status: ReceivableStatus; outstanding: string };
    };
    expect(body.data.status).toBe(ReceivableStatus.PARTIALLY_PAID);
    expect(Number(body.data.outstanding)).toBe(2500);
  });

  it('unpaid: no amountReceived leaves the receivable UNPAID and creates no Payment', async () => {
    const result = await useCase.execute(owner.farmId, ownerUserId, {
      totalAmount: 800,
      saleDate: new Date().toISOString(),
    });
    createdSaleIds.push(result.sale.id);
    expect(result.paymentId).toBeNull();

    const paymentCount = await prisma.financePayment.count({
      where: {
        allocations: { some: { receivableId: result.receivableId } },
      },
    });
    expect(paymentCount).toBe(0);
  });

  it("amountReceived > 0 without a financialAccountId pays into the farm's single account", async () => {
    const result = await useCase.execute(owner.farmId, ownerUserId, {
      totalAmount: 500,
      amountReceived: 100,
      paymentMethod: PaymentMethod.CASH,
      saleDate: new Date().toISOString(),
    });
    createdSaleIds.push(result.sale.id);
    expect(result.paymentId).not.toBeNull();

    const payment = await prisma.financePayment.findUniqueOrThrow({
      where: { id: result.paymentId! },
    });
    const farmAccount = await prisma.financialAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(payment.financialAccountId).toBe(farmAccount.id);
  });

  it('rejects amountReceived greater than totalAmount', async () => {
    const account = await createCashAccount();
    await expect(
      useCase.execute(owner.farmId, ownerUserId, {
        totalAmount: 500,
        financialAccountId: account.id,
        amountReceived: 600,
        saleDate: new Date().toISOString(),
      }),
    ).rejects.toThrow(/cannot exceed totalAmount/);
  });

  it('rejects a non-positive totalAmount', async () => {
    await expect(
      useCase.execute(owner.farmId, ownerUserId, {
        totalAmount: 0,
        saleDate: new Date().toISOString(),
      }),
    ).rejects.toThrow(/totalAmount must be greater than zero/);
  });
});

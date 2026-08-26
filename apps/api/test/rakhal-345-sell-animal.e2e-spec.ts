import request from 'supertest';
import {
  FinancialAccountType,
  LactationStatus,
  PaymentMethod,
} from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { SellAnimalUseCase } from '../src/modules/sales/application/use-cases/sell-animal/sell-animal.use-case';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-345 — `SellAnimal` use case; delete Finance's cattle mutation
 * (`FINANCE_V2_DESIGN.md` §1.1, §4.2). No controller route exists yet
 * (RAKHAL-357 wires the real HTTP surface) — this spec calls
 * `SellAnimalUseCase` directly through the app's DI container, same
 * precedent `test/cattle-disposition.e2e-spec.ts` (RAKHAL-344) established.
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Sales — SellAnimal use case (e2e, RAKHAL-345)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let sellAnimal: SellAnimalUseCase;
  let owner: AuthedUser;
  let ownerUserId: string;

  const server = () => ctx.app.getHttpServer();
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const tag = () =>
    `E2E-345-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    sellAnimal = ctx.app.get(SellAnimalUseCase);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = ownerUser.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createCattle(): Promise<string> {
    const res = await request(server())
      .post(api('/cattle'))
      .set(...bearer(owner))
      .send({ tagNumber: tag(), gender: 'FEMALE', purpose: 'MILK' })
      .expect(201);
    return res.body.data.id as string;
  }

  async function createAccount(): Promise<{
    id: string;
    ledgerAccountId: string;
  }> {
    const res = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({ name: `SellAnimal-${tag()}`, type: FinancialAccountType.CASH })
      .expect(201);
    return (res.body as { data: { id: string; ledgerAccountId: string } }).data;
  }

  it('sells an animal atomically: Sale + AnimalSaleLine + CattleDisposition + Receivable + journal', async () => {
    const cattleId = await createCattle();

    const result = await sellAnimal.execute(
      owner.farmId,
      ownerUserId,
      cattleId,
      {
        salePrice: 45000,
        buyerName: 'Rahim Traders',
        saleDate: new Date().toISOString(),
      },
    );

    expect(result.totalAmount).toBe('45000');
    expect(result.paymentId).toBeNull();

    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: result.saleId },
      include: { lines: { include: { animalDetail: true } } },
    });
    expect(sale.totalAmount.toString()).toBe('45000');
    expect(sale.lines).toHaveLength(1);
    expect(sale.lines[0].animalDetail?.cattleId).toBe(cattleId);
    // Bug found+documented (not fixed) during RAKHAL-352, fixed here: the
    // sale's atomic side effects (disposition, receivable, journal) have all
    // run, so the Sale row itself must be flipped out of DRAFT.
    expect(sale.status).toBe('CONFIRMED');

    const disposition = await prisma.cattleDisposition.findUniqueOrThrow({
      where: { id: result.dispositionId },
    });
    expect(disposition.type).toBe('SALE');
    expect(disposition.saleId).toBe(result.saleId);

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).toBe('SOLD');
    expect(cattle.deletedAt).toBeNull();

    const receivable = await prisma.receivable.findUniqueOrThrow({
      where: { id: result.receivableId },
    });
    expect(receivable.totalAmount.toString()).toBe('45000');

    const journal = await prisma.journalTransaction.findUniqueOrThrow({
      where: { id: result.journalTransactionId },
      include: { entries: true },
    });
    const debits = journal.entries.reduce((s, e) => s + Number(e.debit), 0);
    const credits = journal.entries.reduce((s, e) => s + Number(e.credit), 0);
    expect(debits).toBeCloseTo(45000, 2);
    expect(credits).toBeCloseTo(45000, 2);
  });

  it('selling a milking cow closes her ACTIVE lactation', async () => {
    const cattleId = await createCattle();
    const lactation = await prisma.lactation.create({
      data: {
        cattleId,
        lactationNumber: 1,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        status: LactationStatus.ACTIVE,
      },
    });

    await sellAnimal.execute(owner.farmId, ownerUserId, cattleId, {
      salePrice: 40000,
      saleDate: new Date().toISOString(),
    });

    const closedLactation = await prisma.lactation.findUniqueOrThrow({
      where: { id: lactation.id },
    });
    expect(closedLactation.status).toBe('ENDED');
    expect(closedLactation.endReason).toBe('SOLD');
  });

  it('a sold animal cannot be sold again — second call rejected, first sale untouched', async () => {
    const cattleId = await createCattle();

    const first = await sellAnimal.execute(
      owner.farmId,
      ownerUserId,
      cattleId,
      {
        salePrice: 30000,
        saleDate: new Date().toISOString(),
      },
    );

    await expect(
      sellAnimal.execute(owner.farmId, ownerUserId, cattleId, {
        salePrice: 31000,
        saleDate: new Date().toISOString(),
      }),
    ).rejects.toThrow(
      'This animal has already been sold and cannot be sold again.',
    );

    const saleCount = await prisma.sale.count({
      where: {
        farmId: owner.farmId,
        lines: { some: { animalDetail: { cattleId } } },
      },
    });
    expect(saleCount).toBe(1);
    const dispositionCount = await prisma.cattleDisposition.count({
      where: { cattleId, type: 'SALE' },
    });
    expect(dispositionCount).toBe(1);

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.dispositionId).toBe(first.dispositionId);
  });

  it('a financially failing sale leaves the animal NOT sold and persists nothing', async () => {
    const cattleId = await createCattle();

    await expect(
      sellAnimal.execute(owner.farmId, ownerUserId, cattleId, {
        salePrice: 50000,
        amountReceived: 20000,
        financialAccountId: 'does-not-exist',
        paymentMethod: PaymentMethod.CASH,
        saleDate: new Date().toISOString(),
      }),
    ).rejects.toThrow();

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).not.toBe('SOLD');
    expect(cattle.deletedAt).toBeNull();
    expect(cattle.dispositionId).toBeNull();

    const saleCount = await prisma.sale.count({
      where: {
        farmId: owner.farmId,
        lines: { some: { animalDetail: { cattleId } } },
      },
    });
    expect(saleCount).toBe(0);
    const dispositionCount = await prisma.cattleDisposition.count({
      where: { cattleId },
    });
    expect(dispositionCount).toBe(0);
    const receivableCount = await prisma.receivable.count({
      where: { sale: { lines: { some: { animalDetail: { cattleId } } } } },
    });
    expect(receivableCount).toBe(0);
  });

  it('a fully-paid sale creates a Payment + allocation that settles the receivable', async () => {
    const cattleId = await createCattle();
    const account = await createAccount();

    const result = await sellAnimal.execute(
      owner.farmId,
      ownerUserId,
      cattleId,
      {
        salePrice: 60000,
        amountReceived: 60000,
        financialAccountId: account.id,
        paymentMethod: PaymentMethod.CASH,
        saleDate: new Date().toISOString(),
      },
    );

    expect(result.paymentId).not.toBeNull();
    const payment = await prisma.financePayment.findUniqueOrThrow({
      where: { id: result.paymentId! },
      include: { allocations: true },
    });
    expect(payment.amount.toString()).toBe('60000');
    expect(payment.allocations).toHaveLength(1);
    expect(payment.allocations[0].receivableId).toBe(result.receivableId);

    const receivable = await prisma.receivable.findUniqueOrThrow({
      where: { id: result.receivableId },
    });
    expect(receivable.closedAt).not.toBeNull();
  });

  // RAKHAL-354 update: the V1 regression this test used to guard
  // ("`POST /finance/transactions` with `subType: 'animal'` no longer
  // touches `Cattle.status`") is now structurally impossible rather than
  // merely fixed — `FinanceTransaction`/`recordTransaction`/the whole V1
  // `/finance/transactions` route are deleted outright (RAKHAL-354,
  // `FINANCE_V2_DESIGN.md` §5.3). Confirms the route itself is gone (404,
  // not 201) instead of re-testing a no-longer-reachable code path.
  it('V1 POST /finance/transactions no longer exists — the only sell-animal path is SellAnimalUseCase', async () => {
    const cattleId = await createCattle();

    await request(server())
      .post(api('/finance/transactions'))
      .set(...bearer(owner))
      .send({
        type: 'REVENUE',
        category: 'REVENUE',
        subType: 'animal',
        cattleId,
        amount: 12345,
        entityName: 'E2E V1 regression buyer',
      })
      .expect(404);

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).not.toBe('SOLD');
    expect(cattle.deletedAt).toBeNull();
  });
});

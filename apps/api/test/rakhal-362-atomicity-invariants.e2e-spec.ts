import request from 'supertest';
import { FinancialAccountType, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { SellAnimalUseCase } from '../src/modules/sales/application/use-cases/sell-animal/sell-animal.use-case';
import { SellMilkUseCase } from '../src/modules/sales/application/use-cases/sell-milk/sell-milk.use-case';
import { JournalService } from '../src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from '../src/modules/finance-v2/ledger/application/ledger-account.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

import { createExtraAccount } from './utils/finance';
import { TransferService } from 'src/modules/finance-v2/transfers/application/transfer.service';
/**
 * RAKHAL-362 — Atomicity + invariant e2e suite (`FINANCE_V2_DESIGN.md` §10).
 * Test-only ticket — no production code touched.
 *
 * Most of §10's AC list is already proven piecemeal by earlier tickets'
 * own specs: milk 100L/ledger-fails rollback (`sell-milk.e2e-spec.ts`),
 * animal fails-not-sold + sold-twice guard (`rakhal-345-sell-animal.e2e-spec.ts`),
 * two concurrent 80L milk sales against 100L (`rakhal-343-milk-availability.e2e-spec.ts`),
 * transfer with fee (`finance-v2-transfers.e2e-spec.ts`), expense paid vs
 * unpaid (`purchasing-expense.e2e-spec.ts`), supplier payable settlement
 * (`purchasing-pay-supplier.e2e-spec.ts`), milk/inventory sale fully paid /
 * partially paid / fully unpaid (`sell-milk.e2e-spec.ts`,
 * `sell-inventory.e2e-spec.ts`). This file closes the remaining gaps rather
 * than duplicating that coverage:
 *
 * 1. Animal sale — partially-paid variant (only fully-paid + fully-unpaid
 *    existed before this ticket).
 * 2. A receivable moving PARTIALLY_PAID -> PAID across two separate payments
 *    (the existing three-payment worked example in
 *    `finance-v2-payments.e2e-spec.ts` only asserts the final `due === 0`,
 *    never reads the intermediate status).
 * 3. A cross-flow invariant sweep: every `JournalTransaction` created by a
 *    mixed batch of real flows (animal sale, transfer, milk sale if a tank
 *    exists) balances — proven as one *generic* assertion over every entry,
 *    not spot-checked per flow.
 * 4. "A duplicate request moves money once" — proven at the layer that
 *    actually guarantees it. There is no HTTP-level `Idempotency-Key`
 *    header or dedup guard anywhere in `SaleController`/`SellMilkUseCase`/
 *    `SellAnimalUseCase` (confirmed by code search) — a second real HTTP
 *    call creates a brand-new `Sale` with a brand-new derived
 *    `idempotencyKey` (`sale:<newId>`) and is **not** deduplicated. What
 *    *is* guaranteed, and is what this ticket can honestly prove without
 *    touching production code, is `JournalService.postJournal`'s own
 *    `(farmId, idempotencyKey)` no-op replay. Documented here as a real
 *    gap rather than asserted as if it were closed.
 */
describe('RAKHAL-362 — Atomicity + invariant e2e suite', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let sellAnimal: SellAnimalUseCase;
  let sellMilk: SellMilkUseCase;
  let journal: JournalService;
  let ledgerAccounts: LedgerAccountService;
  let owner: AuthedUser;
  let ownerUserId: string;

  const server = () => ctx.app.getHttpServer();
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const tag = () =>
    `E2E-362-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const createdAccountIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    sellAnimal = ctx.app.get(SellAnimalUseCase);
    sellMilk = ctx.app.get(SellMilkUseCase);
    journal = ctx.app.get(JournalService);
    ledgerAccounts = ctx.app.get(LedgerAccountService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = ownerUser.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.financialAccount
      .deleteMany({ where: { id: { in: createdAccountIds } } })
      .catch(() => undefined);
    await ctx.app.close();
  });

  async function createCattle(): Promise<string> {
    const res = await request(server())
      .post(api('/cattle'))
      .set(...bearer(owner))
      .send({ tagNumber: tag(), gender: 'FEMALE' })
      .expect(201);
    return res.body.data.id as string;
  }

  async function createAccount(
    openingBalance?: number,
  ): Promise<{ id: string; ledgerAccountId: string }> {
    const res = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name: `Rakhal362-${tag()}`,
          type: FinancialAccountType.CASH,
          ...(openingBalance !== undefined ? { openingBalance } : {}),
        }),
      },
    };
    const account = res.body.data;
    createdAccountIds.push(account.id);
    return account;
  }

  it('a partially-paid animal sale leaves the receivable PARTIALLY_PAID with the exact outstanding amount', async () => {
    const cattleId = await createCattle();
    const account = await createAccount();

    const result = await sellAnimal.execute(
      owner.farmId,
      ownerUserId,
      cattleId,
      {
        salePrice: 50_000,
        amountReceived: 20_000,
        financialAccountId: account.id,
        paymentMethod: PaymentMethod.CASH,
        saleDate: new Date().toISOString(),
      },
    );

    expect(result.paymentId).not.toBeNull();

    const res = await request(server())
      .get(api(`/finance/receivables/${result.receivableId}`))
      .set(...bearer(owner))
      .expect(200);
    const receivable = (
      res.body as { data: { status: string; outstanding: string | number } }
    ).data;
    expect(receivable.status).toBe('PARTIALLY_PAID');
    expect(Number(receivable.outstanding)).toBe(30_000);

    // The animal itself is unaffected by how much of the sale was paid —
    // disposition + Cattle.status flip on the sale existing, not on payment.
    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).toBe('SOLD');
  });

  it('a receivable moves PARTIALLY_PAID -> PAID across two separate payments, outstanding reaching exactly zero', async () => {
    const cattleId = await createCattle();
    const account = await createAccount();

    const result = await sellAnimal.execute(
      owner.farmId,
      ownerUserId,
      cattleId,
      {
        salePrice: 40_000,
        saleDate: new Date().toISOString(),
      },
    );

    const readReceivable = async () => {
      const res = await request(server())
        .get(api(`/finance/receivables/${result.receivableId}`))
        .set(...bearer(owner))
        .expect(200);
      return (
        res.body as { data: { status: string; outstanding: string | number } }
      ).data;
    };

    // Leg 1: partial payment.
    const pay1 = await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(owner))
      .send({
        direction: 'INCOMING',
        financialAccountId: account.id,
        amount: 15_000,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    await request(server())
      .post(api(`/finance/payments/${pay1.body.data.id}/allocations`))
      .set(...bearer(owner))
      .send({
        allocations: [{ receivableId: result.receivableId, amount: 15_000 }],
      })
      .expect(201);

    const midway = await readReceivable();
    expect(midway.status).toBe('PARTIALLY_PAID');
    expect(Number(midway.outstanding)).toBe(25_000);

    // Leg 2: completes it.
    const pay2 = await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(owner))
      .send({
        direction: 'INCOMING',
        financialAccountId: account.id,
        amount: 25_000,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    await request(server())
      .post(api(`/finance/payments/${pay2.body.data.id}/allocations`))
      .set(...bearer(owner))
      .send({
        allocations: [{ receivableId: result.receivableId, amount: 25_000 }],
      })
      .expect(201);

    const final = await readReceivable();
    expect(final.status).toBe('PAID');
    expect(Number(final.outstanding)).toBe(0);
  });

  it('invariant: every JournalTransaction posted by a mixed batch of real flows balances (sum(debit) === sum(credit))', async () => {
    const before = await prisma.journalTransaction.findMany({
      where: { farmId: owner.farmId },
      select: { id: true },
    });
    const beforeIds = new Set(before.map((t) => t.id));

    // Fire a few unrelated flows in the same farm — an animal sale, a
    // transfer, and a milk sale if a sellable tank exists — each posts
    // through the shared JournalService.
    const cattleId = await createCattle();
    await sellAnimal.execute(owner.farmId, ownerUserId, cattleId, {
      salePrice: 22_000,
      saleDate: new Date().toISOString(),
    });

    // Opening balance posts a real journal entry at creation time — the
    // only way to give a fresh account a real source balance to transfer.
    const cashAccount = await createAccount(5_000);
    const bankRes = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name: `Rakhal362-Bank-${tag()}`,
          type: FinancialAccountType.BANK,
          bankDetail: { bankName: 'City Bank', accountNumber: `${Date.now()}` },
        }),
      },
    };
    const bankAccount = (bankRes.body as { data: { id: string } }).data;
    createdAccountIds.push(bankAccount.id);

    // The HTTP route is retired (one account per farm); legacy multi-account farms still hold
    // transfers, so exercise the service directly.
    const ownerRow = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    await ctx.app
      .get(TransferService)
      .createTransfer(owner.farmId, ownerRow.id, {
        fromFinancialAccountId: cashAccount.id,
        toFinancialAccountId: bankAccount.id,
        amount: 3_000,
        transactionDate: new Date().toISOString(),
      });

    const tank = await prisma.milkTank.findFirst({
      where: { farmId: owner.farmId, deletedAt: null, tankType: 'SELLABLE' },
    });
    if (tank) {
      const milkAccount = await createAccount();
      const availability = await request(server())
        .get(api(`/milk/availability?tankId=${tank.id}`))
        .set(...bearer(owner))
        .expect(200);
      const currentVolumeL = Number(
        (availability.body as { data: Array<{ currentVolumeL: number }> })
          .data[0]?.currentVolumeL ?? 0,
      );
      if (currentVolumeL >= 5) {
        await sellMilk.execute(owner.farmId, ownerUserId, {
          tankId: tank.id,
          volumeL: 5,
          pricePerLitre: 60,
          saleDate: new Date().toISOString(),
          amountReceived: 300,
          financialAccountId: milkAccount.id,
          paymentMethod: PaymentMethod.CASH,
        });
      }
    }

    const after = await prisma.journalTransaction.findMany({
      where: { farmId: owner.farmId },
      include: { entries: true },
    });
    const newTransactions = after.filter((t) => !beforeIds.has(t.id));
    expect(newTransactions.length).toBeGreaterThan(0);

    for (const txn of newTransactions) {
      const debits = txn.entries.reduce((s, e) => s + Number(e.debit), 0);
      const credits = txn.entries.reduce((s, e) => s + Number(e.credit), 0);
      expect(debits).toBeCloseTo(credits, 2);
    }
  });

  it('a duplicate JournalService.postJournal call with the same idempotencyKey moves money once (documents the guarantee that actually exists)', async () => {
    const ar = await ledgerAccounts.findByCode(owner.farmId, '1100');
    const revenue = await ledgerAccounts.findByCode(owner.farmId, '4100');
    expect(ar).not.toBeNull();
    expect(revenue).not.toBeNull();

    const idempotencyKey = `e2e-362-dup-${tag()}`;
    const input = {
      farmId: owner.farmId,
      sourceType: 'E2E_TEST',
      sourceId: idempotencyKey,
      transactionDate: new Date(),
      description: 'RAKHAL-362 duplicate-post test',
      idempotencyKey,
      createdById: ownerUserId,
      entries: [
        { ledgerAccountId: ar!.id, debit: 1_000 },
        { ledgerAccountId: revenue!.id, credit: 1_000 },
      ],
    };

    const first = await journal.postJournal(input);
    const second = await journal.postJournal(input);
    expect(second.id).toBe(first.id);

    const count = await prisma.journalTransaction.count({
      where: { farmId: owner.farmId, idempotencyKey },
    });
    expect(count).toBe(1);

    await prisma.journalEntry.deleteMany({
      where: { journalTransactionId: first.id },
    });
    await prisma.journalTransaction.delete({ where: { id: first.id } });
  });
});

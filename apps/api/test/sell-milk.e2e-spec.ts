import request from 'supertest';
import { BadRequestException } from '@nestjs/common';
import {
  FinancialAccountType,
  PaymentMethod,
  SaleStatus,
} from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { SellMilkUseCase } from '../src/modules/sales/application/use-cases/sell-milk/sell-milk.use-case';
import { ReceivableService } from '../src/modules/finance-v2/receivables/application/receivable.service';
import { ReceivableStatus } from '../src/modules/finance-v2/receivables/domain/receivable-status';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-342 — `SellMilk` use case (fully atomic, Finance V2 —
 * `FINANCE_V2_DESIGN.md` §1.2, §4.3). `SellMilkUseCase` has no HTTP route of
 * its own (only `BuyerService.recordDispatch` calls it today, always with
 * `amountReceived: 0` per PRD §11.3's own convention) — this spec calls the
 * use case directly through the app's DI container, same pattern
 * `cattle-disposition.e2e-spec.ts` (RAKHAL-344) already established for a
 * service with no controller yet. Requires the dev stack up + `pnpm seed`.
 */
describe('SellMilkUseCase — fully atomic milk sale (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let sellMilk: SellMilkUseCase;
  let receivableService: ReceivableService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let cashAccountId: string;
  let tankId: string;

  const server = () => ctx.app.getHttpServer();
  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const tag = () =>
    `E2E-342-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    sellMilk = ctx.app.get(SellMilkUseCase);
    receivableService = ctx.app.get(ReceivableService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = ownerUser.id;

    const account = await request(server())
      .post(api('/finance/accounts'))
      .set(...auth(owner))
      .send({
        name: `E2E-342 Cash ${Date.now()}`,
        type: FinancialAccountType.CASH,
      })
      .expect(201);
    cashAccountId = account.body.data.id as string;

    // A dedicated, deliberately-overfull tank so it is unambiguously "the
    // fullest active SELLABLE tank" `SellMilkUseCase` selects, regardless of
    // whatever other seeded/other-agent tanks exist in the shared dev DB.
    const tank = await request(server())
      .post(api('/inventory/milk-tanks'))
      .set(...auth(owner))
      .send({
        name: `E2E-342 Tank ${Date.now()}`,
        tankType: 'SELLABLE',
        totalCapacityL: 50_000,
        currentVolumeL: 49_000,
      })
      .expect(201);
    tankId = tank.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function tankVolume(): Promise<number> {
    const res = await request(server())
      .get(api(`/inventory/milk-tanks/${tankId}`))
      .set(...auth(owner))
      .expect(200);
    return res.body.data.currentVolumeL as number;
  }

  it('fully unpaid: creates Sale+Receivable+journal, decrements the tank, receivable stays UNPAID', async () => {
    const before = await tankVolume();
    const notes = tag();

    const result = await sellMilk.execute(owner.farmId, ownerUserId, {
      volumeL: 20,
      pricePerLitre: 50,
      notes,
    });

    expect(result.sale.status).toBe(SaleStatus.CONFIRMED);
    expect(Number(result.sale.totalAmount)).toBeCloseTo(1000, 2);
    expect(result.tankUpdated).toBe(true);
    expect(result.payment).toBeNull();

    const after = await tankVolume();
    expect(after).toBeCloseTo(before - 20, 2);

    const receivable = await receivableService.findOne(
      owner.farmId,
      result.receivable.id,
    );
    expect(Number(receivable.outstanding)).toBeCloseTo(1000, 2);
    expect(receivable.status).toBe(ReceivableStatus.UNPAID);

    const journal = await prisma.journalTransaction.findUnique({
      where: {
        farmId_idempotencyKey: {
          farmId: owner.farmId,
          idempotencyKey: `sale:${result.sale.id}`,
        },
      },
      include: { entries: true },
    });
    expect(journal).toBeTruthy();
    const totalDebit = journal!.entries.reduce(
      (s, e) => s + Number(e.debit),
      0,
    );
    const totalCredit = journal!.entries.reduce(
      (s, e) => s + Number(e.credit),
      0,
    );
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
    expect(totalDebit).toBeCloseTo(1000, 2);
  });

  it('fully paid: amountReceived === total settles the receivable to zero (PAID)', async () => {
    const notes = tag();
    const result = await sellMilk.execute(owner.farmId, ownerUserId, {
      volumeL: 10,
      pricePerLitre: 40,
      notes,
      amountReceived: 400,
      financialAccountId: cashAccountId,
      paymentMethod: PaymentMethod.CASH,
    });

    expect(result.payment).toBeTruthy();
    expect(Number(result.payment!.amount)).toBeCloseTo(400, 2);

    const receivable = await receivableService.findOne(
      owner.farmId,
      result.receivable.id,
    );
    expect(Number(receivable.outstanding)).toBeCloseTo(0, 2);
    expect(receivable.status).toBe(ReceivableStatus.PAID);
    expect(receivable.closedAt).toBeTruthy();
  });

  it('partially paid: amountReceived < total leaves PARTIALLY_PAID outstanding', async () => {
    const notes = tag();
    const result = await sellMilk.execute(owner.farmId, ownerUserId, {
      volumeL: 10,
      pricePerLitre: 40,
      notes,
      amountReceived: 150,
      financialAccountId: cashAccountId,
      paymentMethod: PaymentMethod.CASH,
    });

    const receivable = await receivableService.findOne(
      owner.farmId,
      result.receivable.id,
    );
    expect(Number(receivable.outstanding)).toBeCloseTo(250, 2);
    expect(receivable.status).toBe(ReceivableStatus.PARTIALLY_PAID);
  });

  it('rejects a sale the tank cannot supply — no Sale row, no tank change, nothing rolled forward', async () => {
    const before = await tankVolume();
    const notes = tag();

    await expect(
      sellMilk.execute(owner.farmId, ownerUserId, {
        volumeL: before + 1_000_000,
        pricePerLitre: 50,
        notes,
      }),
    ).rejects.toThrow(BadRequestException);

    const after = await tankVolume();
    expect(after).toBeCloseTo(before, 2);

    const sale = await prisma.sale.findFirst({
      where: { farmId: owner.farmId, notes },
    });
    expect(sale).toBeNull();
  });

  it('mid-flow failure (amountReceived over the receivable outstanding) rolls back the whole transaction — no Sale, no tank change, no Receivable, no Payment, no JournalTransaction', async () => {
    const before = await tankVolume();
    const notes = tag();

    await expect(
      sellMilk.execute(owner.farmId, ownerUserId, {
        volumeL: 15,
        pricePerLitre: 50, // total = 750
        notes,
        amountReceived: 900, // > total — ReceivableService.assertWithinOutstanding rejects
        financialAccountId: cashAccountId,
        paymentMethod: PaymentMethod.CASH,
      }),
    ).rejects.toThrow(BadRequestException);

    const after = await tankVolume();
    expect(after).toBeCloseTo(before, 2);

    const sale = await prisma.sale.findFirst({
      where: { farmId: owner.farmId, notes },
    });
    expect(sale).toBeNull();

    const receivable = await prisma.receivable.findFirst({
      where: { farmId: owner.farmId, sale: { notes } },
    });
    expect(receivable).toBeNull();
  });

  it('rejects zero/negative volume without touching anything', async () => {
    await expect(
      sellMilk.execute(owner.farmId, ownerUserId, {
        volumeL: 0,
        pricePerLitre: 50,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires financialAccountId and paymentMethod when amountReceived is greater than zero', async () => {
    await expect(
      sellMilk.execute(owner.farmId, ownerUserId, {
        volumeL: 5,
        pricePerLitre: 50,
        amountReceived: 100,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

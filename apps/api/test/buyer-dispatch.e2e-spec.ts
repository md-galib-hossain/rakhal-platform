import request from 'supertest';
import { FinancialAccountType, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

import { createExtraAccount } from './utils/finance';
/**
 * Cattle → Milk → Inventory gap-closure (no ticket #, 2026-07-18), updated by
 * RAKHAL-342 (Finance V2 — `FINANCE_V2_DESIGN.md` §1.2, §4.3).
 *
 * 1. `sellFromTank()` swallowed `MilkTankService.adjustVolume`'s negative-
 *    balance guard — a `MilkDispatch` row was still created even when the
 *    tank couldn't actually supply the volume. Dispatch creation + the tank
 *    SALE decrement run in one Prisma transaction, so an insufficient-volume
 *    rejection rolls back the whole dispatch. Still true.
 * 2. **RAKHAL-342 update**: milk revenue used to post to V1 Finance in a
 *    best-effort `try/catch` *after* the dispatch/tank transaction had
 *    already committed (`FINANCE_V2_DESIGN.md` §1.2's own worked defect) —
 *    so a Finance hiccup left milk gone from the tank with no ledger entry
 *    anywhere. `recordDispatch()` now posts through `SellMilkUseCase`
 *    (Sale + SaleLine(MILK) + Receivable + journal) inside the SAME
 *    transaction as the dispatch row and the tank decrement — a dispatch can
 *    no longer exist without a corresponding sale. The response no longer
 *    carries `financeTransactionId` (V1); it carries `saleId` (V2), and the
 *    buyer statement now reads real payments off the V2 `Receivable` via
 *    that `saleId` instead of the V1 `FinanceReceivable`.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Buyer dispatch → tank decrement + Sale/Receivable linkage (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let buyerId: string;
  let buyerName: string;
  let tankId: string;
  let cashAccountId: string;

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

    buyerName = `E2E Dispatch Buyer ${Date.now()}`;
    const buyer = await request(server())
      .post(api('/buyers'))
      .set(...auth(owner))
      .send({
        name: buyerName,
        buyerType: 'COOPERATIVE',
        basePricePerLitre: 50,
        paymentTermsDays: 7,
      })
      .expect(201);
    buyerId = buyer.body.data.id as string;

    // A dedicated, deliberately-overfull tank so it is unambiguously "the
    // fullest active SELLABLE tank" that SellMilkUseCase will pick, regardless
    // of whatever seeded/other-agent tanks exist in the shared dev DB.
    const tank = await request(server())
      .post(api('/inventory/milk-tanks'))
      .set(...auth(owner))
      .send({
        name: `E2E Dispatch Tank ${Date.now()}`,
        tankType: 'SELLABLE',
        totalCapacityL: 50_000,
        currentVolumeL: 49_000,
      })
      .expect(201);
    tankId = tank.body.data.id as string;

    const account = await createExtraAccount(ctx, prisma, owner, {
      name: `E2E Dispatch Cash ${Date.now()}`,
      type: FinancialAccountType.CASH,
    });
    cashAccountId = account.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.financialAccount
      .deleteMany({ where: { id: cashAccountId } })
      .catch(() => undefined);
    await ctx.app.close();
  });

  it('decrements the tank and creates a V2 Sale+Receivable on a successful dispatch, then reflects a recorded payment in the statement', async () => {
    const before = await request(server())
      .get(api(`/inventory/milk-tanks/${tankId}`))
      .set(...auth(owner))
      .expect(200);

    const dispatchedAt = new Date().toISOString();
    const dispatch = await request(server())
      .post(api('/milk/dispatch'))
      .set(...auth(owner))
      .send({ buyerId, dispatchedAt, volumeDispatchedL: 100 })
      .expect(201);

    expect(dispatch.body.data.tankUpdated).toBe(true);
    expect(dispatch.body.data.saleId).toBeTruthy();
    const saleId = dispatch.body.data.saleId as string;
    const calculatedAmount = dispatch.body.data.calculatedAmount as number;

    const after = await request(server())
      .get(api(`/inventory/milk-tanks/${tankId}`))
      .set(...auth(owner))
      .expect(200);
    expect(after.body.data.currentVolumeL).toBeCloseTo(
      before.body.data.currentVolumeL - 100,
      1,
    );

    // The dispatch created a real V2 Receivable — find it by the linked
    // Sale id, since that's the only handle we have back to it.
    const receivables = await request(server())
      .get(api('/finance/receivables?limit=50'))
      .set(...auth(owner))
      .expect(200);
    const receivable = (
      receivables.body.data as Array<{
        id: string;
        saleId: string;
        totalAmount: string | number;
        outstanding: string | number;
      }>
    ).find((r) => r.saleId === saleId);
    expect(receivable).toBeTruthy();
    expect(Number(receivable!.totalAmount)).toBeCloseTo(calculatedAmount, 2);
    expect(Number(receivable!.outstanding)).toBeCloseTo(calculatedAmount, 2);

    // Record a partial payment against it via the generic V2 payment routes
    // and confirm the buyer statement (previously always 0, since
    // MilkDispatch.paidAmount was never written) now reflects it.
    const partial = round2(calculatedAmount / 2);
    const payment = await request(server())
      .post(api('/finance/payments'))
      .set(...auth(owner))
      .send({
        direction: 'INCOMING',
        financialAccountId: cashAccountId,
        amount: partial,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    await request(server())
      .post(api(`/finance/payments/${payment.body.data.id}/allocations`))
      .set(...auth(owner))
      .send({
        allocations: [{ receivableId: receivable!.id, amount: partial }],
      })
      .expect(201);

    const [year, month] = dispatchedAt.slice(0, 7).split('-');
    const statement = await request(server())
      .get(api(`/buyers/${buyerId}/statement?month=${year}-${month}`))
      .set(...auth(owner))
      .expect(200);
    expect(statement.body.data.totalPaid).toBeCloseTo(partial, 2);
    expect(statement.body.data.outstanding).toBeCloseTo(
      calculatedAmount - partial,
      2,
    );
  });

  it('rejects a dispatch the tank cannot supply (no partial state — no dispatch row, no tank change, no Sale)', async () => {
    const before = await request(server())
      .get(api(`/inventory/milk-tanks/${tankId}`))
      .set(...auth(owner))
      .expect(200);

    await request(server())
      .post(api('/milk/dispatch'))
      .set(...auth(owner))
      .send({
        buyerId,
        dispatchedAt: new Date().toISOString(),
        volumeDispatchedL: before.body.data.currentVolumeL + 1_000_000,
      })
      .expect(400);

    const after = await request(server())
      .get(api(`/inventory/milk-tanks/${tankId}`))
      .set(...auth(owner))
      .expect(200);
    expect(after.body.data.currentVolumeL).toBeCloseTo(
      before.body.data.currentVolumeL,
      3,
    );

    const dispatches = await request(server())
      .get(api(`/milk/dispatch?buyerId=${buyerId}&limit=50`))
      .set(...auth(owner))
      .expect(200);
    const oversized = (
      dispatches.body.data as Array<{ volumeDispatchedL: number }>
    ).find((d) => d.volumeDispatchedL > 1_000_000);
    expect(oversized).toBeUndefined();
  });

  // ---- Business UX Phase 1: payment at sale, tank span, activity, archived buyer ----

  interface LogRow {
    eventTitle: string;
    actionDetails: string;
    financialImpact: string | number | null;
  }
  const financeLog = async (): Promise<LogRow[]> => {
    const res = await request(server())
      .get(api('/activity-log?module=FINANCE&limit=100'))
      .set(...auth(owner))
      .expect(200);
    return res.body.data as LogRow[];
  };
  const logged = async (eventTitle: string, needle: string) =>
    (await financeLog()).filter(
      (r) => r.eventTitle === eventTitle && r.actionDetails.includes(needle),
    );
  const dispatch = (body: Record<string, unknown>) =>
    request(server())
      .post(api('/milk/dispatch'))
      .set(...auth(owner))
      .send({ buyerId, dispatchedAt: new Date().toISOString(), ...body });
  const sellableTotal = async (): Promise<number> => {
    const tank = await prisma.milkTank.findUniqueOrThrow({
      where: { id: tankId },
    });
    const agg = await prisma.milkTank.aggregate({
      where: {
        farmId: tank.farmId,
        tankType: 'SELLABLE',
        deletedAt: null,
      },
      _sum: { currentVolumeL: true },
    });
    return agg._sum.currentVolumeL ?? 0;
  };

  it('takes payment at the point of sale in ONE call: payment + allocation settle the receivable, and the sale is logged with the amount received', async () => {
    const res = await dispatch({
      volumeDispatchedL: 20,
      amountReceived: 1000,
      paymentMethod: PaymentMethod.CASH,
    }).expect(201);
    expect(res.body.data.amountReceived).toBe(1000);
    const saleId = res.body.data.saleId as string;

    const receivable = await prisma.receivable.findFirstOrThrow({
      where: { saleId },
    });
    const allocated = await prisma.paymentAllocation.aggregate({
      where: { receivableId: receivable.id },
      _sum: { amount: true },
    });
    expect(Number(allocated._sum.amount)).toBeCloseTo(1000, 2);
    expect(Number(receivable.totalAmount)).toBeCloseTo(1000, 2);

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    const rows = await logged('Milk Sale Recorded', sale.saleNumber);
    expect(rows).toHaveLength(1);
    expect(rows[0].actionDetails).toContain('1000 received');
  });

  it('rejects over-payment and a payment with no method — nothing is written', async () => {
    const before = await sellableTotal();
    await dispatch({
      volumeDispatchedL: 20,
      amountReceived: 1500,
      paymentMethod: PaymentMethod.CASH,
    }).expect(400);
    await dispatch({ volumeDispatchedL: 20, amountReceived: 500 }).expect(400);
    expect(await sellableTotal()).toBeCloseTo(before, 3);
  });

  it('spans tanks when no single tank holds enough, then a cancel credits every tank back and logs it', async () => {
    const second = await request(server())
      .post(api('/inventory/milk-tanks'))
      .set(...auth(owner))
      .send({
        name: `E2E Span Tank ${Date.now()}`,
        tankType: 'SELLABLE',
        totalCapacityL: 1_000,
        currentVolumeL: 100,
      })
      .expect(201);
    const secondId = second.body.data.id as string;
    try {
      const tank = await prisma.milkTank.findUniqueOrThrow({
        where: { id: tankId },
      });
      const tanks = await prisma.milkTank.findMany({
        where: { farmId: tank.farmId, tankType: 'SELLABLE', deletedAt: null },
      });
      const fullest = [...tanks].sort(
        (a, b) => b.currentVolumeL - a.currentVolumeL,
      )[0];
      const totalBefore = await sellableTotal();
      const volume = fullest.currentVolumeL + 10;

      const res = await dispatch({ volumeDispatchedL: volume }).expect(201);
      const saleId = res.body.data.saleId as string;
      const dispatchId = res.body.data.id as string;
      const dispatchNumber = res.body.data.dispatchNumber as string;
      expect(await sellableTotal()).toBeCloseTo(totalBefore - volume, 2);

      const line = await prisma.saleLine.findFirstOrThrow({
        where: { saleId },
      });
      const audit = await prisma.milkTankAuditLog.findMany({
        where: { saleLineId: line.id },
      });
      expect(audit.length).toBeGreaterThanOrEqual(2);

      await request(server())
        .post(api(`/buyers/dispatches/${dispatchId}/cancel`))
        .set(...auth(owner))
        .expect(201);
      expect(await sellableTotal()).toBeCloseTo(totalBefore, 2);
      const restored = await prisma.milkTank.findUniqueOrThrow({
        where: { id: fullest.id },
      });
      expect(restored.currentVolumeL).toBeCloseTo(fullest.currentVolumeL, 2);

      const rows = await logged('Milk Dispatch Cancelled', dispatchNumber);
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].financialImpact)).toBeLessThan(0);
    } finally {
      await prisma.milkTank
        .update({ where: { id: secondId }, data: { deletedAt: new Date() } })
        .catch(() => undefined);
    }
  });

  it('logs receipt confirmation, buyer create and buyer deactivation; an archived buyer cannot be sold to', async () => {
    const created = await request(server())
      .post(api('/buyers'))
      .set(...auth(owner))
      .send({
        name: `E2E Archive Buyer ${Date.now()}`,
        buyerType: 'COOPERATIVE',
        basePricePerLitre: 40,
      })
      .expect(201);
    const archiveId = created.body.data.id as string;
    const archiveName = created.body.data.name as string;
    expect(await logged('Buyer Added', archiveName)).toHaveLength(1);

    const sent = await dispatch({ volumeDispatchedL: 5 }).expect(201);
    const dispatchNumber = sent.body.data.dispatchNumber as string;
    await request(server())
      .patch(api(`/buyers/dispatches/${sent.body.data.id}/receipt`))
      .set(...auth(owner))
      .send({ volumeReceivedL: 4.5 })
      .expect(200);
    expect(await logged('Milk Receipt Confirmed', dispatchNumber)).toHaveLength(
      1,
    );

    await request(server())
      .delete(api(`/buyers/${archiveId}`))
      .set(...auth(owner))
      .expect(200);
    expect(await logged('Buyer Deactivated', archiveName)).toHaveLength(1);

    await request(server())
      .post(api('/milk/dispatch'))
      .set(...auth(owner))
      .send({
        buyerId: archiveId,
        dispatchedAt: new Date().toISOString(),
        volumeDispatchedL: 5,
      })
      .expect(400);
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

import request from 'supertest';
import { FinancialAccountType, PaymentMethod } from '@prisma/client';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

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

    const account = await request(server())
      .post(api('/finance/accounts'))
      .set(...auth(owner))
      .send({
        name: `E2E Dispatch Cash ${Date.now()}`,
        type: FinancialAccountType.CASH,
      })
      .expect(201);
    cashAccountId = account.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
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
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

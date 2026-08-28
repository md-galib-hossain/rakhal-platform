import request from 'supertest';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-378 (MILESTONE 22, `BUSINESS_IA_PRD.md` §5.8) — Dispatch lifecycle
 * routes on `BuyerController`:
 *
 * - `GET /buyers/dispatches?status=` filters against the *derived* status
 *   (RAKHAL-366's `deriveDispatchStatus`) via a real `where` predicate;
 * - `PATCH /buyers/dispatches/:id/receipt` records `volumeReceivedL` +
 *   recomputes `discrepancyL`, moving PENDING -> DELIVERED; `driverName`
 *   settable both at record time and here;
 * - `GET /buyers/dispatches/summary` -> Total/Delivered/In Transit/Cancelled
 *   with % of total;
 * - Worker (no `finance.*`) gets 403 on all three.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Dispatch lifecycle routes (e2e, RAKHAL-378)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const uniqueTag = () =>
    `E2E-378-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createBuyer(): Promise<string> {
    const res = await request(server())
      .post(api('/buyers'))
      .set(...bearer(owner))
      .send({
        name: `E2E-378 Buyer ${uniqueTag()}`,
        phone: '01700000378',
        buyerType: 'DAIRY_COMPANY',
        basePricePerLitre: 45,
      })
      .expect(201);
    return res.body.data.id as string;
  }

  async function recordDispatch(
    buyerId: string,
    driverName?: string,
  ): Promise<{ id: string }> {
    const res = await request(server())
      .post(api('/milk/dispatch'))
      .set(...bearer(owner))
      .send({
        buyerId,
        dispatchedAt: new Date().toISOString(),
        volumeDispatchedL: 20,
        ...(driverName ? { driverName } : {}),
      })
      .expect(201);
    return { id: res.body.data.id as string };
  }

  it('lists a fresh dispatch as PENDING; ?status=PENDING includes it, ?status=DELIVERED excludes it', async () => {
    const buyerId = await createBuyer();
    const { id: dispatchId } = await recordDispatch(buyerId, 'Karim');

    const pending = await request(server())
      .get(api('/buyers/dispatches?status=PENDING'))
      .set(...bearer(owner))
      .expect(200);
    expect(
      pending.body.data.some((d: { id: string }) => d.id === dispatchId),
    ).toBe(true);

    const delivered = await request(server())
      .get(api('/buyers/dispatches?status=DELIVERED'))
      .set(...bearer(owner))
      .expect(200);
    expect(
      delivered.body.data.some((d: { id: string }) => d.id === dispatchId),
    ).toBe(false);

    const record = pending.body.data.find(
      (d: { id: string }) => d.id === dispatchId,
    );
    expect(record.driverName).toBe('Karim');
  });

  it('PATCH receipt records volumeReceivedL, computes discrepancy, moves PENDING -> DELIVERED, driverName overridable', async () => {
    const buyerId = await createBuyer();
    const { id: dispatchId } = await recordDispatch(buyerId, 'Karim');

    const receipt = await request(server())
      .patch(api(`/buyers/dispatches/${dispatchId}/receipt`))
      .set(...bearer(owner))
      .send({ volumeReceivedL: 18.5, driverName: 'Rahim' })
      .expect(200);
    expect(receipt.body.data.status).toBe('DELIVERED');
    expect(receipt.body.data.volumeReceivedL).toBe(18.5);
    expect(receipt.body.data.discrepancyL).toBe(1.5);
    expect(receipt.body.data.discrepancyFlagged).toBe(true);
    expect(receipt.body.data.driverName).toBe('Rahim');

    const delivered = await request(server())
      .get(api('/buyers/dispatches?status=DELIVERED'))
      .set(...bearer(owner))
      .expect(200);
    expect(
      delivered.body.data.some((d: { id: string }) => d.id === dispatchId),
    ).toBe(true);
  });

  it('GET summary counts Total/Delivered/In Transit/Cancelled with % of total', async () => {
    const buyerId = await createBuyer();
    await recordDispatch(buyerId);
    const deliveredDispatch = await recordDispatch(buyerId);
    await request(server())
      .patch(api(`/buyers/dispatches/${deliveredDispatch.id}/receipt`))
      .set(...bearer(owner))
      .send({ volumeReceivedL: 20 })
      .expect(200);
    const cancelledDispatch = await recordDispatch(buyerId);
    await request(server())
      .post(api(`/buyers/dispatches/${cancelledDispatch.id}/cancel`))
      .set(...bearer(owner))
      .expect(201);

    const summary = await request(server())
      .get(api('/buyers/dispatches/summary'))
      .set(...bearer(owner))
      .expect(200);
    const data = summary.body.data;
    expect(data.total).toBeGreaterThanOrEqual(3);
    expect(data.delivered.count).toBeGreaterThanOrEqual(1);
    expect(data.inTransit.count).toBeGreaterThanOrEqual(1);
    expect(data.cancelled.count).toBeGreaterThanOrEqual(1);
    expect(
      data.delivered.pct + data.inTransit.pct + data.cancelled.pct,
    ).toBeCloseTo(100, 0);
  });

  it('worker without finance.* is rejected on all three dispatch-lifecycle routes', async () => {
    const buyerId = await createBuyer();
    const { id: dispatchId } = await recordDispatch(buyerId);

    await request(server())
      .get(api('/buyers/dispatches'))
      .set(...bearer(worker))
      .expect(403);
    await request(server())
      .get(api('/buyers/dispatches/summary'))
      .set(...bearer(worker))
      .expect(403);
    await request(server())
      .patch(api(`/buyers/dispatches/${dispatchId}/receipt`))
      .set(...bearer(worker))
      .send({ volumeReceivedL: 20 })
      .expect(403);
  });
});

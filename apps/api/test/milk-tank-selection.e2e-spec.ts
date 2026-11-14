import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Milk page follow-up (no ticket #, 2026-07-19): the Tank column used to be a static
 * SELLABLE/WITHHOLDING-derived label with no real per-cow tank choice — `submit()` always
 * routed volume into "whichever active tank of that type was created first". Workers/owners
 * can now name a specific `MilkTank` per cow (header default or a row override), and
 * `submit()` groups pending entries by that resolved tank instead of lumping everything into
 * one type-wide total. Requires the dev stack up + `pnpm seed`.
 */
describe('Milk log → per-cow tank selection (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let cattleId: string;
  let secondTankId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const testDate = new Date(
    Date.now() +
      (2000 + Math.floor(Math.random() * 1000)) * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const logTable = await request(server())
      .get(api(`/milk/log?date=${testDate}`))
      .set(...auth(owner))
      .expect(200);
    const eligible = (
      logTable.body.data.entries as Array<{
        cattleId: string;
        withholding: boolean;
      }>
    ).find((e) => !e.withholding);
    if (!eligible) {
      throw new Error(
        'No non-withheld milking cow found in demo data — did you run `pnpm seed`?',
      );
    }
    cattleId = eligible.cattleId;

    const created = await request(server())
      .post(api('/inventory/milk-tanks'))
      .set(...auth(owner))
      .send({
        name: `E2E-TANK-SELECTION-${Date.now()}`,
        tankType: 'SELLABLE',
        totalCapacityL: 5000,
      })
      .expect(201);
    secondTankId = created.body.data.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('rejects a tankId that does not match the cow’s required tank type', async () => {
    const withholdingTank = await request(server())
      .get(api('/inventory/milk-tanks?tankType=WITHHOLDING'))
      .set(...auth(owner))
      .expect(200);
    const wTanks = withholdingTank.body.data as Array<{ id: string }>;
    if (wTanks.length === 0) return;

    await request(server())
      .post(api('/milk/log'))
      .set(...auth(owner))
      .send({
        date: testDate,
        session: 'MORNING',
        entries: [{ cattleId, yieldL: 3, tankId: wTanks[0].id }],
      })
      .expect(400);
  });

  it('rejects a tankId that does not exist / belong to this farm', async () => {
    await request(server())
      .post(api('/milk/log'))
      .set(...auth(owner))
      .send({
        date: testDate,
        session: 'MORNING',
        entries: [{ cattleId, yieldL: 3, tankId: 'nonexistent-tank-id' }],
      })
      .expect(400);
  });

  it('routes submitted volume into the specific tank named on the entry', async () => {
    const session = 'EVENING';
    const yieldL = 4;

    await request(server())
      .post(api('/milk/log'))
      .set(...auth(owner))
      .send({
        date: testDate,
        session,
        entries: [{ cattleId, yieldL, tankId: secondTankId }],
      })
      .expect(201);

    const before = await request(server())
      .get(api(`/inventory/milk-tanks/${secondTankId}`))
      .set(...auth(owner))
      .expect(200);

    await request(server())
      .post(api('/milk/submit'))
      .set(...auth(owner))
      .send({ date: testDate, session })
      .expect(201);

    const after = await request(server())
      .get(api(`/inventory/milk-tanks/${secondTankId}`))
      .set(...auth(owner))
      .expect(200);
    expect(after.body.data.currentVolumeL).toBeCloseTo(
      before.body.data.currentVolumeL + yieldL,
      1,
    );

    const logTable = await request(server())
      .get(api(`/milk/log?date=${testDate}`))
      .set(...auth(owner))
      .expect(200);
    const row = (
      logTable.body.data.entries as Array<{
        cattleId: string;
        log: { tankId: string | null };
      }>
    ).find((e) => e.cattleId === cattleId);
    expect(row?.log.tankId).toBe(secondTankId);
  });
});

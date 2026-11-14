import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Cattle → Milk → Inventory gap-closure (no ticket #, 2026-07-18): `MilkService
 * .submit()` used to swallow `MilkTankService.adjustVolume`'s capacity guard
 * (try/catch around `collectInto`, just `log.warn` + return `false`) — the
 * milk log entries stayed `submitted=true` and the API returned success even
 * though the tank never actually received the volume, silently drifting the
 * tank's `currentVolumeL` away from what was actually logged. `submit()` now
 * runs the entry-finalization + tank-collection in one Prisma transaction, so
 * a capacity rejection rolls back the whole submit and surfaces as a real 400.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Milk log → submit → tank collection is atomic (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let cattleId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  // Far-future, randomized date so this suite never collides with seeded data
  // or another concurrent agent's e2e run against the same shared dev DB.
  const testDate = new Date(
    Date.now() + (400 + Math.floor(Math.random() * 1000)) * 24 * 60 * 60 * 1000,
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
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function sellableTank() {
    const list = await request(server())
      .get(api('/inventory/milk-tanks?tankType=SELLABLE'))
      .set(...auth(owner))
      .expect(200);
    const tanks = list.body.data as Array<{
      id: string;
      totalCapacityL: number;
      currentVolumeL: number;
    }>;
    if (tanks.length === 0) {
      throw new Error(
        'No active SELLABLE milk tank — did you run `pnpm seed`?',
      );
    }
    // findAll orders desc by createdAt; collectInto picks the oldest (asc first) —
    // i.e. the last element here.
    return tanks[tanks.length - 1];
  }

  it('rolls back the whole submit when the tank rejects the volume (over capacity), then succeeds once capacity is restored', async () => {
    const session = 'MORNING';
    const yieldL = 5;

    await request(server())
      .post(api('/milk/log'))
      .set(...auth(owner))
      .send({ date: testDate, session, entries: [{ cattleId, yieldL }] })
      .expect(201);

    const tank = await sellableTank();
    const originalCapacity = tank.totalCapacityL;

    // Shrink capacity so this session's collection would overflow it.
    await request(server())
      .patch(api(`/inventory/milk-tanks/${tank.id}`))
      .set(...auth(owner))
      .send({ totalCapacityL: tank.currentVolumeL + yieldL / 2 })
      .expect(200);

    try {
      await request(server())
        .post(api('/milk/submit'))
        .set(...auth(owner))
        .send({ date: testDate, session })
        .expect(400);

      const tankAfterFailure = await request(server())
        .get(api(`/inventory/milk-tanks/${tank.id}`))
        .set(...auth(owner))
        .expect(200);
      expect(tankAfterFailure.body.data.currentVolumeL).toBeCloseTo(
        tank.currentVolumeL,
        3,
      );
    } finally {
      // Restore capacity regardless of assertion outcome — this is shared
      // dev-DB state other agents/tests may also rely on.
      await request(server())
        .patch(api(`/inventory/milk-tanks/${tank.id}`))
        .set(...auth(owner))
        .send({ totalCapacityL: originalCapacity })
        .expect(200);
    }

    // Retrying now succeeds — this is the atomicity proof: if the failed
    // attempt had incorrectly marked the entries `submitted=true`, this
    // second submit would 400 with "No new milk log entries to submit".
    const submitted = await request(server())
      .post(api('/milk/submit'))
      .set(...auth(owner))
      .send({ date: testDate, session })
      .expect(201);
    expect(submitted.body.data.totalCowsLogged).toBe(1);

    const tankAfterSuccess = await request(server())
      .get(api(`/inventory/milk-tanks/${tank.id}`))
      .set(...auth(owner))
      .expect(200);
    expect(tankAfterSuccess.body.data.currentVolumeL).toBeCloseTo(
      tank.currentVolumeL + yieldL,
      1,
    );
  });
});

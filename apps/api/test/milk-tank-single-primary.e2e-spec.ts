import request from 'supertest';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * 2026-09-24 (user report: "why we can make primary multiple milk tanks"): a farm has exactly ONE
 * primary milk tank — it was one per `tankType`, so a farm with a Sellable and a Withholding tank
 * could show two "Primary" badges. Setting a primary now clears every other one farm-wide (either
 * type), and archiving the primary clears its flag so it can't hold the slot invisibly.
 *
 * Restores the demo farm's original primary tank afterwards (shared dev DB). Requires the dev stack
 * up + `pnpm seed`.
 */
describe('Milk tanks → exactly one primary per farm (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let originalPrimaryId: string | undefined;
  const createdIds: string[] = [];

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const listTanks = async () =>
    (
      await request(server())
        .get(api('/inventory/milk-tanks'))
        .set(...auth(owner))
        .expect(200)
    ).body.data as Array<{ id: string; isPrimary: boolean; tankType: string }>;

  const createTank = async (tankType: 'SELLABLE' | 'WITHHOLDING') => {
    const res = await request(server())
      .post(api('/inventory/milk-tanks'))
      .set(...auth(owner))
      .send({
        name: `E2E-SINGLE-PRIMARY-${tankType}-${Date.now()}-${Math.random()}`,
        tankType,
        totalCapacityL: 1000,
      })
      .expect(201);
    const id = res.body.data.id as string;
    createdIds.push(id);
    return id;
  };

  const setPrimary = (id: string) =>
    request(server())
      .post(api(`/inventory/milk-tanks/${id}/set-primary`))
      .set(...auth(owner))
      .expect(201);

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    originalPrimaryId = (await listTanks()).find((t) => t.isPrimary)?.id;
  }, 30_000);

  afterAll(async () => {
    for (const id of createdIds) {
      await prisma.milkTank
        .update({
          where: { id },
          data: { deletedAt: new Date(), isPrimary: false },
        })
        .catch(() => undefined);
    }
    if (originalPrimaryId) {
      await setPrimary(originalPrimaryId).catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('making a tank of the other type primary clears the previous primary — never two at once', async () => {
    const sellable = await createTank('SELLABLE');
    const withholding = await createTank('WITHHOLDING');

    await setPrimary(sellable);
    let primaries = (await listTanks()).filter((t) => t.isPrimary);
    expect(primaries.map((t) => t.id)).toEqual([sellable]);

    // The other TYPE takes the slot — under the old per-type rule both would have stayed primary.
    await setPrimary(withholding);
    primaries = (await listTanks()).filter((t) => t.isPrimary);
    expect(primaries.map((t) => t.id)).toEqual([withholding]);
  });

  it('archiving the primary tank clears its primary flag', async () => {
    const tank = await createTank('SELLABLE');
    await setPrimary(tank);

    await request(server())
      .delete(api(`/inventory/milk-tanks/${tank}`))
      .set(...auth(owner))
      .expect(200);

    const row = await prisma.milkTank.findUniqueOrThrow({
      where: { id: tank },
    });
    expect(row.deletedAt).not.toBeNull();
    expect(row.isPrimary).toBe(false);
    expect((await listTanks()).filter((t) => t.isPrimary)).toHaveLength(0);
  });
});

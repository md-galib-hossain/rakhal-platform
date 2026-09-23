import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Inventory tabs → Activity Log (PRD §19). Every user-driven inventory change writes an
 * `INVENTORY`-module entry naming the item and the acting user (`InventoryActivityService`).
 * Entries are found by a per-run unique item name so the shared, hash-chained dev-DB log can't
 * cause false matches.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Inventory → Activity Log (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const run = Date.now();

  interface LogRow {
    eventTitle: string;
    actionDetails: string;
    module: string;
    actorId: string | null;
    actorType: string;
  }

  async function inventoryLog(): Promise<LogRow[]> {
    const res = await request(server())
      .get(api('/activity-log?module=INVENTORY&limit=100'))
      .set(...auth(owner))
      .expect(200);
    return res.body.data as LogRow[];
  }

  /** The entry with this exact title whose details mention `name`. */
  async function expectEntry(
    eventTitle: string,
    name: string,
    detailsContain?: string,
  ): Promise<LogRow> {
    const row = (await inventoryLog()).find(
      (r) => r.eventTitle === eventTitle && r.actionDetails.includes(name),
    );
    expect(row).toBeDefined();
    expect(row!.module).toBe('INVENTORY');
    expect(row!.actorType).toBe('user');
    expect(row!.actorId).toEqual(expect.any(String));
    if (detailsContain) expect(row!.actionDetails).toContain(detailsContain);
    return row!;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('logs milk tank create, update, manual volume adjust and archive', async () => {
    const name = `E2E-LOG-TANK-${run}`;
    const created = await request(server())
      .post(api('/inventory/milk-tanks'))
      .set(...auth(owner))
      .send({ name, tankType: 'SELLABLE', totalCapacityL: 1000 })
      .expect(201);
    const id = created.body.data.id as string;
    await expectEntry('Milk Tank Created', name, 'capacity 1000L');

    await request(server())
      .patch(api(`/inventory/milk-tanks/${id}`))
      .set(...auth(owner))
      .send({ totalCapacityL: 1200 })
      .expect(200);
    await expectEntry('Milk Tank Updated', name);

    await request(server())
      .post(api(`/inventory/milk-tanks/${id}/adjust-volume`))
      .set(...auth(owner))
      .send({
        delta: 40,
        activityType: 'ADJUSTMENT',
        notes: 'e2e physical count',
      })
      .expect(201);
    await expectEntry(
      'Milk Tank Volume Adjusted',
      name,
      '+40L (ADJUSTMENT) — 0L to 40L',
    );

    await request(server())
      .delete(api(`/inventory/milk-tanks/${id}`))
      .set(...auth(owner))
      .expect(200);
    await expectEntry('Milk Tank Archived', name);
  });

  it('does not log a failed manual adjust (rejected by capacity)', async () => {
    const name = `E2E-LOG-TANK-REJECT-${run}`;
    const created = await request(server())
      .post(api('/inventory/milk-tanks'))
      .set(...auth(owner))
      .send({ name, tankType: 'SELLABLE', totalCapacityL: 100 })
      .expect(201);

    await request(server())
      .post(api(`/inventory/milk-tanks/${created.body.data.id}/adjust-volume`))
      .set(...auth(owner))
      .send({ delta: 500, activityType: 'ADJUSTMENT' })
      .expect(400);

    const adjusted = (await inventoryLog()).find(
      (r) =>
        r.eventTitle === 'Milk Tank Volume Adjusted' &&
        r.actionDetails.includes(name),
    );
    expect(adjusted).toBeUndefined();
  });

  it('logs equipment create, update and archive', async () => {
    const name = `E2E-LOG-EQUIP-${run}`;
    const created = await request(server())
      .post(api('/inventory/equipment'))
      .set(...auth(owner))
      .send({
        name,
        type: 'TOOL',
        currentStock: 3,
        costPerUnit: 100,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    const id = created.body.data.id as string;
    await expectEntry('Equipment Added', name);

    await request(server())
      .patch(api(`/inventory/equipment/${id}`))
      .set(...auth(owner))
      .send({ notes: 'e2e' })
      .expect(200);
    await expectEntry('Equipment Updated', name);

    await request(server())
      .patch(api(`/inventory/equipment/${id}/archive`))
      .set(...auth(owner))
      .expect(200);
    await expectEntry('Equipment Archived', name);
  });

  it('logs medicine create and manual stock adjust', async () => {
    const name = `E2E-LOG-MED-${run}`;
    const created = await request(server())
      .post(api('/inventory/medicines'))
      .set(...auth(owner))
      .send({
        name,
        type: 'LIQUID',
        category: 'ANTIBIOTIC',
        unitId: 'unit_ml',
        currentStock: 10,
        costPerUnit: 5,
        purchaseDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      })
      .expect(201);
    await expectEntry('Medicine Added', name);

    await request(server())
      .post(api(`/inventory/medicines/${created.body.data.id}/adjust-stock`))
      .set(...auth(owner))
      .send({ adjustment: -2, reason: 'ADJUSTMENT' })
      .expect(201);
    await expectEntry('Medicine Stock Adjusted', name, '-2');
  });

  it('logs feed item create and archive', async () => {
    const ingredient = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E-LOG-FEED-ING-${run}`,
        pricePerKg: 8,
        dmPct: 90,
      })
      .expect(201);
    const name = `E2E-LOG-FEED-${run}`;
    const created = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name,
        feedClass: 'CONCENTRATE',
        ingredientId: ingredient.body.data.id,
        unitId: 'unit_kg',
        currentStock: 50,
        costPerUnit: 8,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    await expectEntry('Feed Item Added', name);

    await request(server())
      .patch(api(`/inventory/feed-items/${created.body.data.id}/archive`))
      .set(...auth(owner))
      .expect(200);
    await expectEntry('Feed Item Archived', name);
  });

  it('logs semen tank and batch create', async () => {
    const tankName = `E2E-LOG-SEMEN-TANK-${run}`;
    const tank = await request(server())
      .post(api('/inventory/semen/tanks'))
      .set(...auth(owner))
      .send({ name: tankName, strawCapacity: 200, currentTempC: -196 })
      .expect(201);
    await expectEntry('Semen Tank Added', tankName, '200 straws');

    const batchName = `E2E-LOG-SEMEN-BATCH-${run}`;
    await request(server())
      .post(api('/inventory/semen/batches'))
      .set(...auth(owner))
      .send({
        name: batchName,
        strawQuantity: 10,
        costPerUnit: 450,
        tankId: tank.body.data.id,
      })
      .expect(201);
    await expectEntry('Semen Batch Added', batchName, '10 straws');
  });

  it('logs custom unit create and archive', async () => {
    const name = `E2E-LOG-UNIT-${run}`;
    const created = await request(server())
      .post(api('/inventory/units'))
      .set(...auth(owner))
      .send({ name, symbol: `u${run}`.slice(0, 12), dimension: 'COUNT' })
      .expect(201);
    await expectEntry('Custom Unit Added', name, 'COUNT');

    await request(server())
      .patch(api(`/inventory/units/${created.body.data.id}/archive`))
      .set(...auth(owner))
      .expect(200);
    await expectEntry('Custom Unit Archived', name);
  });

  it('logs semen straw use when an AI event draws from a farm-inventory batch', async () => {
    const prisma = ctx.app.get(PrismaService);
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    const account = await prisma.financialAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, deletedAt: null },
      select: { id: true },
    });
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-LOG-COW-${run}`,
        gender: 'FEMALE',
        createdBy: ownerUser.id,
      },
    });
    const batchName = `E2E-LOG-STRAW-BATCH-${run}`;
    const batch = await prisma.semenBatch.create({
      data: {
        farmId: owner.farmId,
        name: batchName,
        strawQuantity: 10,
        costPerUnit: 500,
        createdBy: ownerUser.id,
      },
    });

    await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'FARM_INVENTORY',
        semenBatchId: batch.id,
        paymentMethod: 'CASH',
        financialAccountId: account.id,
      })
      .expect(201);

    const row = await expectEntry(
      'Semen Straw Used',
      batchName,
      '1 straw used',
    );
    expect(row.actionDetails).toContain('10 to 9 left');
    expect(row.actorId).toBe(ownerUser.id);
  });
});

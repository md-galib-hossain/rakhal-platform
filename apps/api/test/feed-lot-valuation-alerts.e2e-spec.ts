import request from 'supertest';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-448 (MILESTONE 26) — finance valuation and the dashboard stock alert read feed lots: inventory
 * value is each lot's stock at its own cost (not the item total at the newest lot's price), and a feed
 * alert sums the lots and estimates days remaining from the last 30 days of feeding movements. Requires
 * the dev stack up + `pnpm seed` + the RAKHAL-442/444/446 migrations.
 */
describe('Feed lots in finance + dashboard (e2e, RAKHAL-448)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let prisma: PrismaService;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    prisma = ctx.app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const inventoryValue = async () => {
    const res = await request(server())
      .get(api('/finance/assets'))
      .set(...bearer(owner))
      .expect(200);
    return (
      res.body.data as { allocation: { category: string; value: number }[] }
    ).allocation.find((a) => a.category === 'inventory')!.value;
  };

  async function createTwoLotItem(lowStockThreshold?: number) {
    const created = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...bearer(owner))
      .send({
        name: `E2E-448 Hay ${Date.now()}-${Math.random()}`,
        feedClass: 'FORAGE',
        unitId: 'unit_kg',
        currentStock: 10,
        costPerUnit: 5,
        purchaseDate: '2026-01-10T00:00:00.000Z',
        nutrition: { dmPct: 88, cpPct: 9, meMjPerKgDm: 8.5 },
        ...(lowStockThreshold ? { lowStockThreshold } : {}),
      })
      .expect(201);
    const id = (created.body.data as { id: string }).id;
    await request(server())
      .post(api(`/inventory/feed-items/${id}/batches`))
      .set(...bearer(owner))
      .send({
        currentStock: 20,
        costPerUnit: 8,
        purchaseDate: '2026-02-10T00:00:00.000Z',
        nutrition: { dmPct: 90, cpPct: 15, meMjPerKgDm: 10 },
      })
      .expect(201);
    return id;
  }

  it('values inventory per lot: 10 kg @ ৳5 + 20 kg @ ৳8 = ৳210, not 30 kg @ ৳8 = ৳240', async () => {
    const before = await inventoryValue();
    await createTwoLotItem();
    const after = await inventoryValue();
    expect(Math.round((after - before) * 100) / 100).toBe(210);
  });

  it('a low-stock alert sums the lots and estimates feed days remaining from recent feeding', async () => {
    const id = await createTwoLotItem(40);
    // 30 kg on hand vs threshold 40 → alerted. No feeding yet → no estimate.
    let res = await request(server())
      .get(api('/dashboard/feed-stock-alerts'))
      .set(...bearer(owner))
      .expect(200);
    type Alert = {
      itemId: string;
      itemType: string;
      currentStock: number;
      daysRemainingEstimate: number | null;
    };
    let alert = (res.body.data.alerts as Alert[]).find((a) => a.itemId === id)!;
    expect(alert.itemType).toBe('feed_item');
    expect(alert.currentStock).toBe(30);
    expect(alert.daysRemainingEstimate).toBeNull();

    // Feed 15 kg through a real recipe distribution: 15 kg / 30 days = 0.5 kg/day → 15 kg left = 30 days.
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...bearer(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E-448 Recipe ${Date.now()}`,
        items: [{ feedItemId: id, amountKg: 15 }],
      })
      .expect(201);
    await request(server())
      .post(api('/feed/distributions'))
      .set(...bearer(owner))
      .send({ concentrationId: (conc.body.data as { id: string }).id })
      .expect(201);

    res = await request(server())
      .get(api('/dashboard/feed-stock-alerts'))
      .set(...bearer(owner))
      .expect(200);
    alert = (res.body.data.alerts as Alert[]).find((a) => a.itemId === id)!;
    expect(alert.currentStock).toBe(15);
    expect(alert.daysRemainingEstimate).toBe(30);

    const movements = await prisma.feedItemStockMovement.count({
      where: { feedItemId: id, reason: 'DISTRIBUTION' },
    });
    expect(movements).toBeGreaterThan(0);
  });
});

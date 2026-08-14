import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-326 — Inventory Unit catalog. Replaces the old free-text `unit` string on
 * Medicine/Equipment/FeedItem with a controlled system-seeded + farm-custom catalog
 * (`Unit` model, `GET`/`POST /inventory/units`). Covers: the new catalog routes, that
 * Medicine/FeedItem creation now requires a real `unitId` FK (Equipment stays optional,
 * mirroring its old optional `unit` column), and that the API response nests the
 * resolved `unit` relation (`{ id, name, symbol }`) instead of a raw string.
 *
 * Requires the dev stack up + `pnpm seed` (system units seeded via `seedUnits()`).
 */
describe('Unit catalog (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('GET /inventory/units', () => {
    it('returns the seeded system units, merged across dimensions', async () => {
      const res = await request(server())
        .get(api('/inventory/units'))
        .set(...auth(owner))
        .expect(200);
      const units = res.body.data as Array<{
        id: string;
        symbol: string;
        dimension: string;
        isSystemDefault: boolean;
      }>;
      expect(units.length).toBeGreaterThanOrEqual(12);
      expect(units.some((u) => u.id === 'unit_kg')).toBe(true);
      expect(units.some((u) => u.id === 'unit_bag')).toBe(true);
      expect(units.every((u) => u.isSystemDefault)).toBe(true);
    });

    it('filters by dimension', async () => {
      const res = await request(server())
        .get(api('/inventory/units?dimension=WEIGHT'))
        .set(...auth(owner))
        .expect(200);
      const units = res.body.data as Array<{ dimension: string }>;
      expect(units.length).toBeGreaterThan(0);
      expect(units.every((u) => u.dimension === 'WEIGHT')).toBe(true);
    });

    it('200s a worker reading units (inventory.read is worker-ok)', async () => {
      await request(server())
        .get(api('/inventory/units'))
        .set(...auth(worker))
        .expect(200);
    });
  });

  describe('POST /inventory/units', () => {
    it('creates a farm-custom unit, visible on a subsequent list call', async () => {
      const symbol = `crate-${Date.now()}`;
      const res = await request(server())
        .post(api('/inventory/units'))
        .set(...auth(owner))
        .send({ name: 'Crate', symbol, dimension: 'COUNT' })
        .expect(201);
      expect(res.body.data.isSystemDefault).toBe(false);
      const unitId = res.body.data.id as string;

      const list = await request(server())
        .get(api('/inventory/units'))
        .set(...auth(owner))
        .expect(200);
      const ids = (list.body.data as Array<{ id: string }>).map((u) => u.id);
      expect(ids).toContain(unitId);
    });

    it('403s a worker creating a unit (inventory.create is manager+)', async () => {
      await request(server())
        .post(api('/inventory/units'))
        .set(...auth(worker))
        .send({
          name: 'Worker Unit',
          symbol: `wu-${Date.now()}`,
          dimension: 'COUNT',
        })
        .expect(403);
    });
  });

  describe('Medicine now requires a real unitId', () => {
    it('400s a create with no unitId', async () => {
      await request(server())
        .post(api('/inventory/medicines'))
        .set(...auth(owner))
        .send({
          name: `E2E No-Unit Med ${Date.now()}`,
          type: 'LIQUID',
          category: 'ANTIBIOTIC',
          currentStock: 10,
          costPerUnit: 5,
          purchaseDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        })
        .expect(400);
    });

    it('creates with a valid unitId and returns the nested unit relation', async () => {
      const res = await request(server())
        .post(api('/inventory/medicines'))
        .set(...auth(owner))
        .send({
          name: `E2E Unit Med ${Date.now()}`,
          type: 'LIQUID',
          category: 'ANTIBIOTIC',
          unitId: 'unit_ml',
          currentStock: 10,
          costPerUnit: 5,
          purchaseDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        })
        .expect(201);
      expect(res.body.data.unit).toMatchObject({ id: 'unit_ml', symbol: 'mL' });
      expect(res.body.data.unit).not.toBeNull();

      const patched = await request(server())
        .patch(api(`/inventory/medicines/${res.body.data.id}`))
        .set(...auth(owner))
        .send({ unitId: 'unit_g' })
        .expect(200);
      expect(patched.body.data.unit).toMatchObject({
        id: 'unit_g',
        symbol: 'g',
      });
    });
  });

  describe('FeedItem now requires a real unitId', () => {
    it('400s a create with no unitId', async () => {
      const ingredient = await request(server())
        .post(api('/feed/ingredients/custom'))
        .set(...auth(owner))
        .send({
          name: `E2E No-Unit Ingredient ${Date.now()}`,
          pricePerKg: 5,
        })
        .expect(201);

      await request(server())
        .post(api('/inventory/feed-items'))
        .set(...auth(owner))
        .send({
          name: `E2E No-Unit Feed ${Date.now()}`,
          feedClass: 'CONCENTRATE',
          ingredientId: ingredient.body.data.id,
          currentStock: 10,
          costPerUnit: 5,
          purchaseDate: new Date().toISOString(),
        })
        .expect(400);
    });

    it('creates with a valid unitId and returns the nested unit relation', async () => {
      const ingredient = await request(server())
        .post(api('/feed/ingredients/custom'))
        .set(...auth(owner))
        .send({
          name: `E2E Unit Feed Ingredient ${Date.now()}`,
          pricePerKg: 5,
        })
        .expect(201);

      const res = await request(server())
        .post(api('/inventory/feed-items'))
        .set(...auth(owner))
        .send({
          name: `E2E Unit Feed ${Date.now()}`,
          feedClass: 'CONCENTRATE',
          ingredientId: ingredient.body.data.id,
          unitId: 'unit_bag',
          kgPerUnit: 25,
          currentStock: 10,
          costPerUnit: 5,
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);
      expect(res.body.data.unit).toMatchObject({
        id: 'unit_bag',
        symbol: 'bag',
      });
    });
  });

  describe('Equipment unitId stays optional', () => {
    it('creates with no unitId at all (mirrors the old optional unit column)', async () => {
      const res = await request(server())
        .post(api('/inventory/equipment'))
        .set(...auth(owner))
        .send({
          name: `E2E No-Unit Equipment ${Date.now()}`,
          type: 'TOOL',
          currentStock: 1,
          costPerUnit: 100,
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);
      expect(res.body.data.unit).toBeNull();
    });

    it('creates with a valid unitId and returns the nested unit relation', async () => {
      const res = await request(server())
        .post(api('/inventory/equipment'))
        .set(...auth(owner))
        .send({
          name: `E2E Unit Equipment ${Date.now()}`,
          type: 'TOOL',
          unitId: 'unit_pcs',
          currentStock: 1,
          costPerUnit: 100,
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);
      expect(res.body.data.unit).toMatchObject({
        id: 'unit_pcs',
        symbol: 'pcs',
      });
    });
  });
});

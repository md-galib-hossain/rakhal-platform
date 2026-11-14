import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * `POST /inventory/equipment/bulk-delete` — the backend half of the shared bulk-select/bulk-delete
 * "dock" pilot (2026-07-21, no ticket #). Same contract as `medicine-bulk-delete.e2e-spec.ts`.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Equipment bulk-delete (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  async function createEquipment(name: string) {
    const res = await request(server())
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
    return res.body.data.id as string;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('deletes every requested id belonging to the farm and returns the count', async () => {
    const idA = await createEquipment(`E2E Bulk Equipment A ${Date.now()}`);
    const idB = await createEquipment(`E2E Bulk Equipment B ${Date.now()}`);

    const res = await request(server())
      .post(api('/inventory/equipment/bulk-delete'))
      .set(...auth(owner))
      .send({ ids: [idA, idB] })
      .expect(201);
    expect(res.body.data.deleted).toBe(2);

    const list = await request(server())
      .get(api('/inventory/equipment'))
      .set(...auth(owner))
      .expect(200);
    const ids = (list.body.data as Array<{ id: string }>).map((e) => e.id);
    expect(ids).not.toContain(idA);
    expect(ids).not.toContain(idB);
  });

  it('silently ignores an unknown id mixed into an otherwise-valid batch', async () => {
    const idA = await createEquipment(`E2E Bulk Equipment Mixed ${Date.now()}`);

    const res = await request(server())
      .post(api('/inventory/equipment/bulk-delete'))
      .set(...auth(owner))
      .send({ ids: [idA, 'not-a-real-id'] })
      .expect(201);
    expect(res.body.data.deleted).toBe(1);
  });

  it('403s a worker (inventory.delete is manager+)', async () => {
    const idA = await createEquipment(
      `E2E Bulk Equipment Worker ${Date.now()}`,
    );

    await request(server())
      .post(api('/inventory/equipment/bulk-delete'))
      .set(...auth(worker))
      .send({ ids: [idA] })
      .expect(403);
  });
});

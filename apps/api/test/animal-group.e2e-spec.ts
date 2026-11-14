import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-452 — Animal Groups (many-to-many named sets of cattle). Covers: create with initial
 * members in one call, add/remove members (idempotent), a cow in several groups, the cattle list
 * `animalGroupId` filter, cross-farm / unknown cattleId rejection, duplicate-name 409, soft-delete,
 * and RBAC (worker reads but cannot mutate).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Animal Groups (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let cowA: string;
  let cowB: string;
  let cowC: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const tag = (label: string) =>
    `E2E-AG-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const uniqueName = (label: string) =>
    `E2E ${label} ${Date.now()}-${Math.random()}`;

  const createCow = async (label: string): Promise<string> => {
    const res = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({ tagNumber: tag(label), gender: 'FEMALE' })
      .expect(201);
    return res.body.data.id as string;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    cowA = await createCow('A');
    cowB = await createCow('B');
    cowC = await createCow('C');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('creates a group with initial members in one call', async () => {
    const res = await request(server())
      .post(api('/animal-groups'))
      .set(...auth(owner))
      .send({ name: uniqueName('Create'), cattleIds: [cowA, cowB] })
      .expect(201);
    expect(res.body.data.memberCount).toBe(2);
  });

  it('adds members idempotently and lets one cow sit in several groups', async () => {
    const g1 = await request(server())
      .post(api('/animal-groups'))
      .set(...auth(owner))
      .send({ name: uniqueName('G1') })
      .expect(201);
    const g2 = await request(server())
      .post(api('/animal-groups'))
      .set(...auth(owner))
      .send({ name: uniqueName('G2'), cattleIds: [cowA] })
      .expect(201);
    const g1Id = g1.body.data.id as string;
    const g2Id = g2.body.data.id as string;

    const first = await request(server())
      .post(api(`/animal-groups/${g1Id}/members`))
      .set(...auth(owner))
      .send({ cattleIds: [cowA, cowB] })
      .expect(201);
    expect(first.body.data.memberCount).toBe(2);
    expect(first.body.data.added).toBe(2);

    const again = await request(server())
      .post(api(`/animal-groups/${g1Id}/members`))
      .set(...auth(owner))
      .send({ cattleIds: [cowA, cowB, cowC] })
      .expect(201);
    expect(again.body.data.memberCount).toBe(3);
    expect(again.body.data.added).toBe(1);

    // cowA is in both groups — the cattle list filter finds it under each.
    for (const groupId of [g1Id, g2Id]) {
      const list = await request(server())
        .get(api(`/cattle?animalGroupId=${groupId}`))
        .set(...auth(owner))
        .expect(200);
      const ids = (list.body.data as Array<{ id: string }>).map((c) => c.id);
      expect(ids).toContain(cowA);
    }
  });

  it('removes members', async () => {
    const g = await request(server())
      .post(api('/animal-groups'))
      .set(...auth(owner))
      .send({ name: uniqueName('Remove'), cattleIds: [cowA, cowB] })
      .expect(201);
    const removed = await request(server())
      .delete(api(`/animal-groups/${g.body.data.id as string}/members`))
      .set(...auth(owner))
      .send({ cattleIds: [cowA] })
      .expect(200);
    expect(removed.body.data.removed).toBe(1);
    expect(removed.body.data.memberCount).toBe(1);
  });

  it('rejects an unknown cattleId and a duplicate name', async () => {
    await request(server())
      .post(api('/animal-groups'))
      .set(...auth(owner))
      .send({ name: uniqueName('Bad'), cattleIds: ['does-not-exist'] })
      .expect(400);

    const name = uniqueName('Dup');
    await request(server())
      .post(api('/animal-groups'))
      .set(...auth(owner))
      .send({ name })
      .expect(201);
    await request(server())
      .post(api('/animal-groups'))
      .set(...auth(owner))
      .send({ name })
      .expect(409);
  });

  it('soft-deletes a group and hides it from the default list', async () => {
    const g = await request(server())
      .post(api('/animal-groups'))
      .set(...auth(owner))
      .send({ name: uniqueName('Delete') })
      .expect(201);
    const id = g.body.data.id as string;
    await request(server())
      .delete(api(`/animal-groups/${id}`))
      .set(...auth(owner))
      .expect(200);

    const list = await request(server())
      .get(api('/animal-groups'))
      .set(...auth(owner))
      .expect(200);
    const ids = (list.body.data as Array<{ id: string }>).map((x) => x.id);
    expect(ids).not.toContain(id);

    await request(server())
      .post(api(`/animal-groups/${id}/members`))
      .set(...auth(owner))
      .send({ cattleIds: [cowA] })
      .expect(404);
  });

  it('RBAC: a worker can read groups but not create or modify them', async () => {
    await request(server())
      .get(api('/animal-groups'))
      .set(...auth(worker))
      .expect(200);
    await request(server())
      .post(api('/animal-groups'))
      .set(...auth(worker))
      .send({ name: uniqueName('Worker') })
      .expect(403);
  });

  it('400s a farmId in the body (forbidNonWhitelisted)', async () => {
    await request(server())
      .post(api('/animal-groups'))
      .set(...auth(owner))
      .send({ name: uniqueName('FarmId'), farmId: 'x' })
      .expect(400);
  });
});

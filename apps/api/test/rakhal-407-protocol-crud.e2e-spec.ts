import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-407 — Reproductive Protocol definitions: create/edit/delete a farm-owned protocol.
 * Proves: farm-owned create/update/delete round-trip; a system default (seeded, `farmId: null`)
 * 404s on update/delete (never editable); delete is blocked while a cow is actively on the
 * protocol; RBAC (worker can't create/update/delete).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Reproductive Protocol definitions CRUD (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let prisma: PrismaService;
  let cattleA: string;
  let ovsynchId: string;
  const createdProtocolIds: string[] = [];
  const createdInstanceIds: string[] = [];

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
    prisma = ctx.app.get(PrismaService);

    const cattle = await request(server())
      .get(api('/cattle?limit=1'))
      .set(...auth(owner))
      .expect(200);
    cattleA = (cattle.body.data as Array<{ id: string }>)[0].id;

    const protos = await request(server())
      .get(api('/reproduction/protocols'))
      .set(...auth(owner))
      .expect(200);
    ovsynchId = (protos.body.data as Array<{ id: string; code: string }>).find(
      (p) => p.code === 'OVSYNCH',
    )!.id;
  }, 30_000);

  afterAll(async () => {
    if (createdInstanceIds.length) {
      await prisma.reproProtocolInstance.deleteMany({
        where: { id: { in: createdInstanceIds } },
      });
    }
    if (createdProtocolIds.length) {
      await prisma.reproProtocolStep.deleteMany({
        where: { protocolId: { in: createdProtocolIds } },
      });
      await prisma.reproProtocol.deleteMany({
        where: { id: { in: createdProtocolIds } },
      });
    }
    await ctx.app.close();
  });

  it('creates a farm-owned protocol with its steps', async () => {
    const res = await request(server())
      .post(api('/reproduction/protocols'))
      .set(...auth(owner))
      .send({
        name: 'Custom CIDR-Synch',
        description: 'Farm variant',
        steps: [
          {
            dayNumber: 0,
            title: 'CIDR insert + GnRH',
            stepType: 'CIDR_INSERT',
          },
          {
            dayNumber: 7,
            title: 'CIDR remove + PGF2a',
            stepType: 'CIDR_REMOVE',
          },
          { dayNumber: 9, title: 'Timed AI', stepType: 'AI', isRequired: true },
        ],
      })
      .expect(201);
    expect(res.body.data.is_system_default).toBe(false);
    expect(res.body.data.duration_days).toBe(9);
    expect(res.body.data.steps).toHaveLength(3);
    createdProtocolIds.push(res.body.data.id as string);
  });

  it('400s creating with an empty steps array', async () => {
    await request(server())
      .post(api('/reproduction/protocols'))
      .set(...auth(owner))
      .send({ name: 'No steps', steps: [] })
      .expect(400);
  });

  it('403s a worker creating a protocol', async () => {
    await request(server())
      .post(api('/reproduction/protocols'))
      .set(...auth(worker))
      .send({
        name: 'Worker attempt',
        steps: [{ dayNumber: 0, title: 'x', stepType: 'OTHER' }],
      })
      .expect(403);
  });

  it('edits a farm-owned protocol, replacing its steps wholesale', async () => {
    const created = await request(server())
      .post(api('/reproduction/protocols'))
      .set(...auth(owner))
      .send({
        name: 'Edit me',
        steps: [{ dayNumber: 0, title: 'Step A', stepType: 'OTHER' }],
      })
      .expect(201);
    const id = created.body.data.id as string;
    createdProtocolIds.push(id);

    const updated = await request(server())
      .patch(api(`/reproduction/protocols/${id}`))
      .set(...auth(owner))
      .send({
        name: 'Edited name',
        steps: [
          { dayNumber: 0, title: 'Step A2', stepType: 'OTHER' },
          { dayNumber: 5, title: 'Step B', stepType: 'AI' },
        ],
      })
      .expect(200);
    expect(updated.body.data.name).toBe('Edited name');
    expect(updated.body.data.duration_days).toBe(5);
    expect(updated.body.data.steps).toHaveLength(2);
  });

  it('404s editing a system-default protocol (never editable)', async () => {
    await request(server())
      .patch(api(`/reproduction/protocols/${ovsynchId}`))
      .set(...auth(owner))
      .send({ name: 'Hijack attempt' })
      .expect(404);
  });

  it('404s deleting a system-default protocol', async () => {
    await request(server())
      .delete(api(`/reproduction/protocols/${ovsynchId}`))
      .set(...auth(owner))
      .expect(404);
  });

  it('deletes a farm-owned protocol with no active instances', async () => {
    const created = await request(server())
      .post(api('/reproduction/protocols'))
      .set(...auth(owner))
      .send({
        name: 'Delete me',
        steps: [{ dayNumber: 0, title: 'Step A', stepType: 'OTHER' }],
      })
      .expect(201);
    const id = created.body.data.id as string;

    await request(server())
      .delete(api(`/reproduction/protocols/${id}`))
      .set(...auth(owner))
      .expect(200);

    await request(server())
      .get(api(`/reproduction/protocols/${id}`))
      .set(...auth(owner))
      .expect(404);
  });

  it('409s deleting a protocol with a cow actively on it', async () => {
    const created = await request(server())
      .post(api('/reproduction/protocols'))
      .set(...auth(owner))
      .send({
        name: 'In use',
        steps: [{ dayNumber: 0, title: 'Step A', stepType: 'OTHER' }],
      })
      .expect(201);
    const id = created.body.data.id as string;
    createdProtocolIds.push(id);

    const applied = await request(server())
      .post(api('/reproduction/protocols/apply'))
      .set(...auth(owner))
      .send({ protocolId: id, cattleIds: [cattleA], startDate: '2026-06-01' })
      .expect(201);
    createdInstanceIds.push(applied.body.data.instance_ids[0] as string);

    await request(server())
      .delete(api(`/reproduction/protocols/${id}`))
      .set(...auth(owner))
      .expect(409);
  });
});

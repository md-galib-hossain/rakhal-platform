import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Reproductive (Synchronization) Protocols (RAKHAL-214, PRD §9.8/§9.9) e2e.
 * Proves: seeded protocols list with metrics; apply → per-cow instance + Task-Hub
 * tasks; the **two status tracks** (AI completion drives protocol status; the PD
 * result drives the pregnancy outcome) and the conception-rate metric; validation
 * + RBAC.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Reproductive Protocols (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;
  let prisma: PrismaService;
  let cattleA: string;
  let cattleB: string;
  let ovsynchId: string;
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
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    prisma = ctx.app.get(PrismaService);

    const cattle = await request(server())
      .get(api('/cattle?limit=5'))
      .set(...auth(owner))
      .expect(200);
    const ids = (cattle.body.data as Array<{ id: string }>).map((c) => c.id);
    cattleA = ids[0];
    cattleB = ids[1];

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
    await ctx.app.close();
  });

  it('lists 3 seeded protocols, each with card metrics', async () => {
    const res = await request(server())
      .get(api('/reproduction/protocols'))
      .set(...auth(owner))
      .expect(200);
    const list = res.body.data as Array<{
      code: string;
      is_system_default: boolean;
      metrics: { applied: number; conception_rate: number | null };
    }>;
    expect(list.length).toBeGreaterThanOrEqual(3);
    const ov = list.find((p) => p.code === 'OVSYNCH');
    expect(ov?.is_system_default).toBe(true);
    expect(ov?.metrics).toHaveProperty('conception_rate');
  });

  it('exposes the protocol step sequence', async () => {
    const res = await request(server())
      .get(api(`/reproduction/protocols/${ovsynchId}`))
      .set(...auth(owner))
      .expect(200);
    const steps = res.body.data.steps as Array<{ step_type: string }>;
    expect(steps.some((s) => s.step_type === 'AI')).toBe(true);
    expect(steps.some((s) => s.step_type === 'PREGNANCY_CHECK')).toBe(true);
  });

  it('applies a protocol → instance + Task-Hub tasks, then AI + outcome drive the two tracks', async () => {
    const applied = await request(server())
      .post(api('/reproduction/protocols/apply'))
      .set(...auth(owner))
      .send({
        protocolId: ovsynchId,
        cattleIds: [cattleA],
        startDate: '2026-06-01',
      })
      .expect(201);
    expect(applied.body.data.applied).toBe(1);
    expect(applied.body.data.tasks_created).toBeGreaterThanOrEqual(5);
    const instanceId = applied.body.data.instance_ids[0] as string;
    createdInstanceIds.push(instanceId);

    // Task-Hub got the BREEDING tasks for this cow.
    const taskCount = await prisma.task.count({
      where: {
        farmId: owner.farmId,
        category: 'BREEDING',
        relatedCattleId: cattleA,
      },
    });
    expect(taskCount).toBeGreaterThanOrEqual(5);

    // Fresh instance: protocol status IN_PROGRESS, no pregnancy outcome yet.
    let inst = await request(server())
      .get(api(`/reproduction/protocols/instances/${instanceId}`))
      .set(...auth(owner))
      .expect(200);
    expect(inst.body.data.status).toBe('IN_PROGRESS');
    expect(inst.body.data.pregnancy_outcome).toBeNull();

    // Record AI → protocol Completed + AI milestone + Waiting for PD.
    inst = await request(server())
      .post(api(`/reproduction/protocols/instances/${instanceId}/ai`))
      .set(...auth(owner))
      .send({ inseminator: 'Tech 1' })
      .expect(201);
    expect(inst.body.data.status).toBe('COMPLETED');
    expect(inst.body.data.ai_completed_at).not.toBeNull();
    expect(inst.body.data.pregnancy_outcome).toBe('WAITING_PD');

    // Record the PD result → pregnancy outcome (separate track).
    inst = await request(server())
      .post(api(`/reproduction/protocols/instances/${instanceId}/outcome`))
      .set(...auth(owner))
      .send({ outcome: 'PREGNANT' })
      .expect(201);
    expect(inst.body.data.pregnancy_outcome).toBe('PREGNANT');

    // Conception rate now computable for Ovsynch (pregnant ÷ completed).
    const protos = await request(server())
      .get(api('/reproduction/protocols'))
      .set(...auth(owner))
      .expect(200);
    const ov = (protos.body.data as Array<{ code: string; metrics: any }>).find(
      (p) => p.code === 'OVSYNCH',
    );
    expect(ov.metrics.completed).toBeGreaterThanOrEqual(1);
    expect(ov.metrics.pregnant).toBeGreaterThanOrEqual(1);
    expect(typeof ov.metrics.conception_rate).toBe('number');
  });

  it('serves herd reproductive KPIs', async () => {
    const res = await request(server())
      .get(api('/reproduction/protocols/kpis'))
      .set(...auth(owner))
      .expect(200);
    expect(res.body.data).toHaveProperty('conception_rate');
    expect(res.body.data.total_applied).toBeGreaterThanOrEqual(1);
  });

  describe('validation + RBAC', () => {
    it('404s an unknown protocol', async () => {
      await request(server())
        .post(api('/reproduction/protocols/apply'))
        .set(...auth(owner))
        .send({ protocolId: 'nope', cattleIds: [cattleA] })
        .expect(404);
    });

    it('400s cattle not in the farm', async () => {
      await request(server())
        .post(api('/reproduction/protocols/apply'))
        .set(...auth(owner))
        .send({ protocolId: ovsynchId, cattleIds: ['not-a-cow'] })
        .expect(400);
    });

    it('400s recording outcome before AI', async () => {
      const applied = await request(server())
        .post(api('/reproduction/protocols/apply'))
        .set(...auth(owner))
        .send({ protocolId: ovsynchId, cattleIds: [cattleB] })
        .expect(201);
      const id = applied.body.data.instance_ids[0] as string;
      createdInstanceIds.push(id);
      await request(server())
        .post(api(`/reproduction/protocols/instances/${id}/outcome`))
        .set(...auth(owner))
        .send({ outcome: 'PREGNANT' })
        .expect(400);
    });

    it('lets a manager apply but forbids a worker (read + apply)', async () => {
      await request(server())
        .get(api('/reproduction/protocols'))
        .set(...auth(worker))
        .expect(403);
      await request(server())
        .post(api('/reproduction/protocols/apply'))
        .set(...auth(worker))
        .send({ protocolId: ovsynchId, cattleIds: [cattleA] })
        .expect(403);
      const mgr = await request(server())
        .post(api('/reproduction/protocols/apply'))
        .set(...auth(manager))
        .send({ protocolId: ovsynchId, cattleIds: [cattleA] })
        .expect(201);
      createdInstanceIds.push(mgr.body.data.instance_ids[0]);
    });
  });
});

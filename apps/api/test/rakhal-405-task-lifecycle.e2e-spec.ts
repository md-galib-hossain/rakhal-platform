import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-405 — Task lifecycle hardening: scheduledAt, CANCELLED status,
 * completion/cancellation metadata. Covers: create with scheduledAt,
 * POST /tasks/:id/cancel (+ its guards), completionNote round-trip on
 * POST /tasks/:id/complete, and multi-cow task targeting (TaskCattle,
 * user request, no ticket #).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Task lifecycle hardening (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const createTask = async (extra: Record<string, unknown> = {}) => {
    const res = await request(server())
      .post(api('/tasks'))
      .set(...auth(owner))
      .send({
        name: 'RAKHAL-405 test task',
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        ...extra,
      })
      .expect(201);
    return res.body.data as { id: string };
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('creates a task with scheduledAt distinct from dueAt', async () => {
    const scheduledAt = new Date(Date.now() + 3_600_000).toISOString();
    const dueAt = new Date(Date.now() + 7_200_000).toISOString();
    const res = await request(server())
      .post(api('/tasks'))
      .set(...auth(owner))
      .send({ name: 'Scheduled task', scheduledAt, dueAt })
      .expect(201);
    const task = res.body.data as { scheduledAt: string; dueAt: string };
    expect(new Date(task.scheduledAt).toISOString()).toBe(scheduledAt);
    expect(new Date(task.dueAt).toISOString()).toBe(dueAt);
  });

  it('cancels a pending task and stamps cancelledAt/cancelledById', async () => {
    const task = await createTask();
    const res = await request(server())
      .post(api(`/tasks/${task.id}/cancel`))
      .set(...auth(owner))
      .send({ notes: 'No longer needed' })
      .expect(201);
    const cancelled = res.body.data as {
      status: string;
      cancelledAt: string | null;
      cancelledById: string | null;
      completionNote: string | null;
      displayStatus: string;
    };
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.cancelledById).not.toBeNull();
    expect(cancelled.completionNote).toBe('No longer needed');
    expect(cancelled.displayStatus).toBe('cancelled');
  });

  it('rejects cancelling an already-completed task', async () => {
    const task = await createTask();
    await request(server())
      .post(api(`/tasks/${task.id}/complete`))
      .set(...auth(owner))
      .send({})
      .expect(201);

    await request(server())
      .post(api(`/tasks/${task.id}/cancel`))
      .set(...auth(owner))
      .send({})
      .expect(400);
  });

  it('rejects cancelling an already-cancelled task', async () => {
    const task = await createTask();
    await request(server())
      .post(api(`/tasks/${task.id}/cancel`))
      .set(...auth(owner))
      .send({})
      .expect(201);

    await request(server())
      .post(api(`/tasks/${task.id}/cancel`))
      .set(...auth(owner))
      .send({})
      .expect(400);
  });

  it('round-trips completionNote through POST /tasks/:id/complete', async () => {
    const task = await createTask();
    const res = await request(server())
      .post(api(`/tasks/${task.id}/complete`))
      .set(...auth(owner))
      .send({ notes: 'Done, checked the animal myself' })
      .expect(201);
    const completed = res.body.data as { completionNote: string | null };
    expect(completed.completionNote).toBe('Done, checked the animal myself');
  });

  it('excludes a cancelled task from the overdue count', async () => {
    const overdueDue = new Date(Date.now() - 3_600_000).toISOString();
    const task = await createTask({ dueAt: overdueDue });

    const before = await request(server())
      .get(api('/tasks?filter=overdue'))
      .set(...auth(owner))
      .expect(200);
    const beforeIds = (before.body.data as Array<{ id: string }>).map(
      (t) => t.id,
    );
    expect(beforeIds).toContain(task.id);

    await request(server())
      .post(api(`/tasks/${task.id}/cancel`))
      .set(...auth(owner))
      .send({})
      .expect(201);

    const after = await request(server())
      .get(api('/tasks?filter=overdue'))
      .set(...auth(owner))
      .expect(200);
    const afterIds = (after.body.data as Array<{ id: string }>).map(
      (t) => t.id,
    );
    expect(afterIds).not.toContain(task.id);
  });

  describe('multi-cow targeting (TaskCattle)', () => {
    const createCattle = async () => {
      const res = await request(server())
        .post(api('/cattle'))
        .set(...auth(owner))
        .send({
          tagNumber: `RAKHAL-405-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          gender: 'FEMALE',
        })
        .expect(201);
      return res.body.data.id as string;
    };

    it('creates a task targeting multiple cows and returns cattleIds', async () => {
      const cowA = await createCattle();
      const cowB = await createCattle();

      const res = await request(server())
        .post(api('/tasks'))
        .set(...auth(owner))
        .send({
          name: 'Vaccinate pregnant cows',
          dueAt: new Date(Date.now() + 86_400_000).toISOString(),
          cattleIds: [cowA, cowB],
        })
        .expect(201);

      const task = res.body.data as {
        cattleIds: string[];
        relatedCattleId: string | null;
      };
      expect(task.cattleIds.sort()).toEqual([cowA, cowB].sort());
      expect(task.relatedCattleId).toBeNull();
    });

    it('rejects both relatedCattleId and cattleIds set together', async () => {
      const cowA = await createCattle();
      await request(server())
        .post(api('/tasks'))
        .set(...auth(owner))
        .send({
          name: 'Bad combo',
          dueAt: new Date(Date.now() + 86_400_000).toISOString(),
          relatedCattleId: cowA,
          cattleIds: [cowA],
        })
        .expect(400);
    });

    it('rejects a cattleId that does not belong to this farm', async () => {
      await request(server())
        .post(api('/tasks'))
        .set(...auth(owner))
        .send({
          name: 'Bad cow id',
          dueAt: new Date(Date.now() + 86_400_000).toISOString(),
          cattleIds: ['not-a-real-cattle-id'],
        })
        .expect(400);
    });

    it('GET /tasks?cattleId= finds a task via TaskCattle, not just relatedCattleId', async () => {
      const cowA = await createCattle();
      const cowB = await createCattle();
      const created = await request(server())
        .post(api('/tasks'))
        .set(...auth(owner))
        .send({
          name: 'Multi-cow findable task',
          dueAt: new Date(Date.now() + 86_400_000).toISOString(),
          cattleIds: [cowA, cowB],
        })
        .expect(201);
      const taskId = created.body.data.id as string;

      const res = await request(server())
        .get(api(`/tasks?cattleId=${cowB}`))
        .set(...auth(owner))
        .expect(200);
      const ids = (res.body.data as Array<{ id: string }>).map((t) => t.id);
      expect(ids).toContain(taskId);
    });
  });
});

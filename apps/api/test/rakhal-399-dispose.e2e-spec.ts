import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-399 — One consolidated exit path. Proves `recordDisposition()` is
 * now the only writer of a non-ACTIVE `herdStatus` across every entry point:
 * the new `POST /cattle/:id/dispose` route, the legacy `DELETE /cattle/:id`
 * reason path, bulk `mark_sold`, and Health's mortality flow (which
 * previously never created a `CattleDisposition` row at all). Also covers
 * the post-disposition Task/AnimalHold cleanup and the new
 * `cattle.dispose` permission's RBAC gate. Requires the dev stack up +
 * `pnpm seed`.
 */
describe('Cattle — consolidated disposition (e2e, RAKHAL-399)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;

  const server = () => ctx.app.getHttpServer();
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const tag = () =>
    `E2E-399-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createCattle(as: AuthedUser = owner): Promise<string> {
    const res = await request(server())
      .post(api('/cattle'))
      .set(...bearer(as))
      .send({ tagNumber: tag(), gender: 'FEMALE' })
      .expect(201);
    return res.body.data.id as string;
  }

  it('POST /cattle/:id/dispose (CULL) creates a CattleDisposition row, flips herdStatus, and closes open tasks/holds', async () => {
    const cattleId = await createCattle();

    const task = await request(server())
      .post(api('/tasks'))
      .set(...bearer(owner))
      .send({
        name: 'Pregnancy check',
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        relatedCattleId: cattleId,
      })
      .expect(201);
    const taskId = task.body.data.id as string;

    await request(server())
      .post(api(`/cattle/${cattleId}/holds`))
      .set(...bearer(owner))
      .send({ type: 'QUARANTINE', reason: 'E2E hold' })
      .expect(201);

    await request(server())
      .post(api(`/cattle/${cattleId}/dispose`))
      .set(...bearer(manager))
      .send({ type: 'CULL', date: new Date().toISOString() })
      .expect(201);

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).toBe('CULLED');
    expect(cattle.productionStatus).toBeNull();
    expect(cattle.dispositionId).not.toBeNull();

    const disposition = await prisma.cattleDisposition.findFirstOrThrow({
      where: { cattleId, type: 'CULL' },
    });
    expect(disposition.id).toBe(cattle.dispositionId);

    const closedTask = await prisma.task.findUniqueOrThrow({
      where: { id: taskId },
    });
    expect(closedTask.status).toBe('COMPLETED');

    const holds = await prisma.animalHold.findMany({ where: { cattleId } });
    expect(holds.length).toBeGreaterThan(0);
    for (const hold of holds) expect(hold.endedAt).not.toBeNull();
  });

  it('worker cannot dispose an animal (cattle.dispose is manager+)', async () => {
    const cattleId = await createCattle();

    await request(server())
      .post(api(`/cattle/${cattleId}/dispose`))
      .set(...bearer(worker))
      .send({ type: 'CULL', date: new Date().toISOString() })
      .expect(403);

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).toBe('ACTIVE');
  });

  it('legacy DELETE /cattle/:id with reason=deceased still delegates to recordDisposition', async () => {
    const cattleId = await createCattle();

    await request(server())
      .delete(api(`/cattle/${cattleId}`))
      .set(...bearer(manager))
      .send({ reason: 'deceased' })
      .expect(200);

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).toBe('DECEASED');
    expect(cattle.deletedAt).toBeNull(); // real herd exit, not a soft delete

    const dispositionCount = await prisma.cattleDisposition.count({
      where: { cattleId, type: 'DEATH' },
    });
    expect(dispositionCount).toBe(1);
  });

  it('bulk mark_sold produces a CattleDisposition(SALE) row for every disposed animal', async () => {
    const cattleIds = [await createCattle(), await createCattle()];

    const res = await request(server())
      .post(api('/cattle/bulk'))
      .set(...bearer(manager))
      .send({ cattleIds, action: 'mark_sold' })
      .expect(201);
    expect(res.body.data.updated).toBe(2);

    for (const cattleId of cattleIds) {
      const cattle = await prisma.cattle.findUniqueOrThrow({
        where: { id: cattleId },
      });
      expect(cattle.herdStatus).toBe('SOLD');
      const dispositionCount = await prisma.cattleDisposition.count({
        where: { cattleId, type: 'SALE' },
      });
      expect(dispositionCount).toBe(1);
    }
  });

  it('Health mortality flow creates a CattleDisposition(DEATH) row (previously never did) and sets herdStatus DECEASED', async () => {
    const cattleId = await createCattle();

    const caseRes = await request(server())
      .post(api('/health/cases'))
      .set(...bearer(owner))
      .send({
        cattleId,
        diagnosis: 'E2E mortality case',
        diagnosisType: 'DISEASE',
        priority: 'HIGH',
      })
      .expect(201);
    const caseId = caseRes.body.data.id as string;

    await request(server())
      .post(api(`/health/cases/${caseId}/mortality`))
      .set(...bearer(owner))
      .send({
        deathDate: new Date().toISOString(),
        primaryCauseOfDeath: 'E2E cause',
      })
      .expect(201);

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).toBe('DECEASED');

    const disposition = await prisma.cattleDisposition.findFirstOrThrow({
      where: { cattleId, type: 'DEATH' },
    });
    expect(disposition.reason).toBe('E2E cause');

    const mortalityRecord = await prisma.mortalityRecord.findFirstOrThrow({
      where: { cattleId },
    });
    expect(mortalityRecord.primaryCauseOfDeath).toBe('E2E cause');
  });

  it('POST /sales/animal/:cattleId (real HTTP route, RAKHAL-345/399) sells an animal atomically', async () => {
    const cattleId = await createCattle();

    const res = await request(server())
      .post(api(`/sales/animal/${cattleId}`))
      .set(...bearer(owner))
      .send({ salePrice: 42000, saleDate: new Date().toISOString() })
      .expect(201);

    expect(res.body.data.totalAmount).toBe('42000');

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).toBe('SOLD');

    const disposition = await prisma.cattleDisposition.findUniqueOrThrow({
      where: { id: res.body.data.dispositionId as string },
    });
    expect(disposition.type).toBe('SALE');
  });
});

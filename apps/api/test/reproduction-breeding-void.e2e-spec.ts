import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Void a breeding / AI event (no ticket #, 2026-10-11) - `POST /reproduction/breeding-events/:id/void`.
 * Covers the money reversal, the straw restore, the heat it closed reopening, the pregnancy-check task
 * being cancelled, the row disappearing from every list / KPI while staying readable by id, the
 * "only while PENDING_CHECK and childless" rule, the edit lock, double-void, RBAC and re-recording.
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Reproduction - void a breeding / AI event (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerUserId: string;
  let cashAccountId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
    const cash = await prisma.financialAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, type: 'CASH', deletedAt: null },
      select: { id: true },
    });
    cashAccountId = cash.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createCow(prefix: string) {
    return prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-VOID-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
      },
    });
  }

  async function createBatch(prefix: string, costPerUnit = 450) {
    return prisma.semenBatch.create({
      data: {
        farmId: owner.farmId,
        name: `E2E-VOID-BATCH-${prefix}-${Date.now()}`,
        strawQuantity: 10,
        costPerUnit,
        createdBy: ownerUserId,
      },
    });
  }

  /** Inventory-straw AI (cost 450 posted to Finance, 1 straw taken). */
  async function recordAi(cattleId: string, semenBatchId: string) {
    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'FARM_INVENTORY',
        semenBatchId,
        paymentMethod: 'CASH',
        financialAccountId: cashAccountId,
      })
      .expect(201);
    return res.body.data as { id: string; financeTransactionId: string };
  }

  const voidIt = (id: string, body: object = { reason: 'Wrong cow' }) =>
    request(server())
      .post(api(`/reproduction/breeding-events/${id}/void`))
      .set(...auth(owner))
      .send(body);

  it('reverses the cost, restores the straw, cancels the check task, keeps the row as VOIDED', async () => {
    const cow = await createCow('FULL');
    const batch = await createBatch('FULL');
    const ai = await recordAi(cow.id, batch.id);

    expect(
      (await prisma.semenBatch.findUniqueOrThrow({ where: { id: batch.id } }))
        .strawQuantity,
    ).toBe(9);

    const res = await voidIt(ai.id, {
      reason: '  Recorded on the wrong cow ',
    }).expect(200);
    expect(res.body.data.status).toBe('VOIDED');
    expect(res.body.data.voidedAt).toBeTruthy();
    expect(res.body.data.voidedById).toBe(ownerUserId);
    expect(res.body.data.voidReason).toBe('Recorded on the wrong cow');

    // straw back
    expect(
      (await prisma.semenBatch.findUniqueOrThrow({ where: { id: batch.id } }))
        .strawQuantity,
    ).toBe(10);

    // money: the expense is voided and its journal posting has a reversal
    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: ai.financeTransactionId },
    });
    expect(expense.voidedAt).not.toBeNull();
    const journal = await prisma.journalTransaction.findFirstOrThrow({
      where: {
        farmId: owner.farmId,
        sourceType: 'EXPENSE',
        sourceId: ai.financeTransactionId,
      },
    });
    expect(
      await prisma.journalTransaction.findFirst({
        where: { farmId: owner.farmId, reversalOfId: journal.id },
      }),
    ).not.toBeNull();
    const finance = await request(server())
      .get(api(`/cattle/${cow.id}/finance`))
      .set(...auth(owner))
      .expect(200);
    expect(finance.body.data.expense_breakdown.breeding ?? 0).toBe(0);

    // the pregnancy-check task is cancelled
    const task = await prisma.task.findFirstOrThrow({
      where: {
        farmId: owner.farmId,
        sourceEventType: 'BREEDING_EVENT',
        sourceEventId: ai.id,
      },
    });
    expect(task.status).toBe('CANCELLED');
  });

  it('disappears from the breeding list, the events feed and the cow profile count, but is readable by id', async () => {
    const cow = await createCow('HIDDEN');
    const batch = await createBatch('HIDDEN');
    const ai = await recordAi(cow.id, batch.id);
    await voidIt(ai.id).expect(200);

    const list = await request(server())
      .get(api(`/reproduction/breeding-events?cattleId=${cow.id}`))
      .set(...auth(owner))
      .expect(200);
    expect(list.body.data.map((e: { id: string }) => e.id)).not.toContain(
      ai.id,
    );

    const feed = await request(server())
      .get(api(`/reproduction/events?cattleId=${cow.id}&eventType=breeding`))
      .set(...auth(owner))
      .expect(200);
    expect(feed.body.data.map((e: { id: string }) => e.id)).not.toContain(
      ai.id,
    );

    const profile = await prisma.reproductionProfile.findUnique({
      where: { cattleId: cow.id },
    });
    expect(profile?.totalBreedings ?? 0).toBe(0);

    const byId = await request(server())
      .get(api(`/reproduction/breeding-events/${ai.id}`))
      .set(...auth(owner))
      .expect(200);
    expect(byId.body.data.status).toBe('VOIDED');
  });

  it('reopens the heat the AI had closed', async () => {
    const cow = await createCow('HEAT');
    const batch = await createBatch('HEAT');
    const heat = await request(server())
      .post(api('/reproduction/heat-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        heatDateTime: new Date(Date.now() - 3_600_000).toISOString(),
        detectionMethod: 'VISUAL',
      })
      .expect(201);
    const ai = await recordAi(cow.id, batch.id);
    const closed = await prisma.heatEvent.findUniqueOrThrow({
      where: { id: heat.body.data.id },
    });
    expect(closed.resolvedByBreedingEventId).toBe(ai.id);

    await voidIt(ai.id).expect(200);

    const reopened = await prisma.heatEvent.findUniqueOrThrow({
      where: { id: heat.body.data.id },
    });
    expect(reopened.resolvedAt).toBeNull();
    expect(reopened.resolvedByBreedingEventId).toBeNull();
    expect(reopened.resolutionReason).toBeNull();
  });

  it('a second void and an edit of a voided breeding are both rejected', async () => {
    const cow = await createCow('TWICE');
    const batch = await createBatch('TWICE');
    const ai = await recordAi(cow.id, batch.id);
    await voidIt(ai.id).expect(200);

    await voidIt(ai.id).expect(400);
    await request(server())
      .patch(api(`/reproduction/breeding-events/${ai.id}`))
      .set(...auth(owner))
      .send({ notes: 'still editing' })
      .expect(400);
    // straw was only restored once
    expect(
      (await prisma.semenBatch.findUniqueOrThrow({ where: { id: batch.id } }))
        .strawQuantity,
    ).toBe(10);
  });

  it('is refused once the breeding has a follow-up, and writes nothing', async () => {
    const cow = await createCow('FOLLOWUP');
    const batch = await createBatch('FOLLOWUP');
    const ai = await recordAi(cow.id, batch.id);
    await prisma.breedingEvent.update({
      where: { id: ai.id },
      data: { status: 'FAILED' },
    });

    await voidIt(ai.id).expect(400);

    const after = await prisma.breedingEvent.findUniqueOrThrow({
      where: { id: ai.id },
    });
    expect(after.voidedAt).toBeNull();
    expect(
      (
        await prisma.expense.findUniqueOrThrow({
          where: { id: ai.financeTransactionId },
        })
      ).voidedAt,
    ).toBeNull();
    expect(
      (await prisma.semenBatch.findUniqueOrThrow({ where: { id: batch.id } }))
        .strawQuantity,
    ).toBe(9);
  });

  it('needs a reason, and a worker cannot void', async () => {
    const cow = await createCow('RBAC');
    const batch = await createBatch('RBAC');
    const ai = await recordAi(cow.id, batch.id);

    await voidIt(ai.id, {}).expect(400);
    await voidIt(ai.id, { reason: '   ' }).expect(400);
    await request(server())
      .post(api(`/reproduction/breeding-events/${ai.id}/void`))
      .set(...auth(worker))
      .send({ reason: 'nope' })
      .expect(403);

    expect(
      (await prisma.breedingEvent.findUniqueOrThrow({ where: { id: ai.id } }))
        .voidedAt,
    ).toBeNull();
  });

  it('a voided breeding does not block recording the right one on the same cow', async () => {
    const cow = await createCow('RERECORD');
    const batch = await createBatch('RERECORD');
    const first = await recordAi(cow.id, batch.id);
    await voidIt(first.id).expect(200);

    const again = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'FARM_INVENTORY',
        semenBatchId: batch.id,
        paymentMethod: 'CASH',
        financialAccountId: cashAccountId,
      })
      .expect(201);
    expect(again.body.data.breedingNumber).toBe(1);
    expect(again.body.data.status).toBe('PENDING_CHECK');
  });

  it('an unknown id returns 404', async () => {
    await voidIt('does-not-exist').expect(404);
  });
});

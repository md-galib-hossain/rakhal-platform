import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-330 — breeding-event cost -> Finance link + payment source.
 * Covers: mandatory cost validation (batch cost / manual serviceCost),
 * mandatory paymentMethod whenever a real cost is posted, the actual
 * FinanceTransaction created on the ledger, its cattle-scoped P&L bucket, and
 * void+repost on edit. Requires the dev stack up + `pnpm seed`.
 */
describe('Reproduction — AI/breeding cost -> Finance (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;

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
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createCow(prefix: string) {
    return prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-AICOST-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        purpose: 'MILK',
        createdBy: ownerUserId,
      },
    });
  }

  async function createSemenBatch(prefix: string, costPerUnit: number | null) {
    return prisma.semenBatch.create({
      data: {
        farmId: owner.farmId,
        name: `E2E-AICOST-BATCH-${prefix}-${Date.now()}`,
        strawQuantity: 10,
        costPerUnit: costPerUnit ?? undefined,
        createdBy: ownerUserId,
      },
    });
  }

  async function createServiceProvider(prefix: string) {
    return prisma.serviceProvider.create({
      data: {
        farmId: owner.farmId,
        name: `E2E AI Technician ${prefix} ${Date.now()}`,
        type: 'AI_TECHNICIAN',
      },
    });
  }

  it('FARM_INVENTORY AI posts a FinanceTransaction from the batch cost, visible on the cow finance tab', async () => {
    const cow = await createCow('INV-POST');
    const batch = await createSemenBatch('INV-POST', 450);

    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'FARM_INVENTORY',
        semenBatchId: batch.id,
        paymentMethod: 'CASH',
      })
      .expect(201);
    expect(res.body.data.financeTransactionId).toBeTruthy();
    expect(res.body.data.paymentMethod).toBe('CASH');

    const txn = await prisma.financeTransaction.findUniqueOrThrow({
      where: { id: res.body.data.financeTransactionId },
    });
    expect(txn.amount).toBe(450);
    expect(txn.category).toBe('OVERHEAD');
    expect(txn.subType).toBe('breeding_ai');
    expect(txn.cattleId).toBe(cow.id);
    expect(txn.paymentMethod).toBe('CASH');

    const finance = await request(server())
      .get(api(`/cattle/${cow.id}/finance`))
      .set(...auth(owner))
      .expect(200);
    expect(finance.body.data.expense_breakdown.breeding).toBeGreaterThanOrEqual(
      450,
    );
  });

  it('FARM_INVENTORY AI against a batch with no cost set is rejected, straw not decremented', async () => {
    const cow = await createCow('INV-NOCOST');
    const batch = await createSemenBatch('INV-NOCOST', null);

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
      })
      .expect(400);

    const batchAfter = await prisma.semenBatch.findUniqueOrThrow({
      where: { id: batch.id },
    });
    expect(batchAfter.strawQuantity).toBe(10);
  });

  it('TECHNICIAN_SUPPLIED AI without serviceCost is rejected', async () => {
    const cow = await createCow('TECH-NOCOST');
    const provider = await createServiceProvider('NOCOST');

    await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: provider.id,
        paymentMethod: 'CASH',
      })
      .expect(400);
  });

  it('a resolved cost with no paymentMethod is rejected', async () => {
    const cow = await createCow('NOPAY');
    const provider = await createServiceProvider('NOPAY');

    await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: provider.id,
        serviceCost: 700,
      })
      .expect(400);
  });

  it('TECHNICIAN_SUPPLIED AI with serviceCost + WALLET posts a transaction with that payment method', async () => {
    const cow = await createCow('TECH-WALLET');
    const provider = await createServiceProvider('WALLET');

    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: provider.id,
        serviceCost: 700,
        paymentMethod: 'WALLET',
      })
      .expect(201);

    const txn = await prisma.financeTransaction.findUniqueOrThrow({
      where: { id: res.body.data.financeTransactionId },
    });
    expect(txn.amount).toBe(700);
    expect(txn.paymentMethod).toBe('WALLET');
  });

  it('NATURAL breeding with no serviceCost succeeds and posts nothing to Finance', async () => {
    const cow = await createCow('NATURAL-FREE');

    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'NATURAL',
      })
      .expect(201);
    expect(res.body.data.financeTransactionId).toBeNull();
  });

  it('NATURAL breeding with a serviceCost still requires paymentMethod and posts a transaction', async () => {
    const cow = await createCow('NATURAL-PAID');

    await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'NATURAL',
        serviceCost: 300,
      })
      .expect(400);

    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'NATURAL',
        serviceCost: 300,
        paymentMethod: 'BANK_TRANSFER',
      })
      .expect(201);
    expect(res.body.data.financeTransactionId).toBeTruthy();

    const txn = await prisma.financeTransaction.findUniqueOrThrow({
      where: { id: res.body.data.financeTransactionId },
    });
    expect(txn.amount).toBe(300);
    expect(txn.subType).toBe('breeding_natural');
  });

  it('editing serviceCost voids the old transaction and posts a new one, without doubling the cow total', async () => {
    const cow = await createCow('EDIT-COST');
    const provider = await createServiceProvider('EDIT-COST');

    const created = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: provider.id,
        serviceCost: 600,
        paymentMethod: 'CASH',
      })
      .expect(201);
    const id = created.body.data.id;
    const firstTxnId = created.body.data.financeTransactionId;
    expect(firstTxnId).toBeTruthy();

    const edited = await request(server())
      .patch(api(`/reproduction/breeding-events/${id}`))
      .set(...auth(owner))
      .send({ serviceCost: 900 })
      .expect(200);
    const secondTxnId = edited.body.data.financeTransactionId;
    expect(secondTxnId).toBeTruthy();
    expect(secondTxnId).not.toBe(firstTxnId);

    const firstTxn = await prisma.financeTransaction.findUniqueOrThrow({
      where: { id: firstTxnId },
    });
    expect(firstTxn.isVoided).toBe(true);

    const secondTxn = await prisma.financeTransaction.findUniqueOrThrow({
      where: { id: secondTxnId },
    });
    expect(secondTxn.isVoided).toBe(false);
    expect(secondTxn.amount).toBe(900);

    const finance = await request(server())
      .get(api(`/cattle/${cow.id}/finance`))
      .set(...auth(owner))
      .expect(200);
    // Voided reversal (-600) + new (+900) nets to the original 600 cancelled
    // out, leaving only the 900 — never 600+900=1500 (that would mean the
    // old transaction was never actually voided).
    expect(finance.body.data.expense_breakdown.breeding).toBe(900);
  });
});

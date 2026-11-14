import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Record AI: explicit semenSource (FARM_INVENTORY/TECHNICIAN_SUPPLIED/
 * EXTERNAL) + ServiceProvider directory (no ticket #, 2026-08-15).
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Reproduction — AI semen source (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let financialAccountId: string;

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
    // RAKHAL-393 (closes RD-066): a breeding cost > 0 now needs a real
    // `financialAccountId`, not just `paymentMethod` — RD-097.
    const account = await prisma.financialAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, deletedAt: null },
      select: { id: true },
    });
    financialAccountId = account.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createCow(prefix: string) {
    return prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-SEMEN-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
      },
    });
  }

  async function createSemenBatch(
    prefix: string,
    strawQuantity = 10,
    semenType?: 'CONVENTIONAL' | 'SEX_SORTED',
    targetSex?: 'FEMALE' | 'MALE',
  ) {
    return prisma.semenBatch.create({
      data: {
        farmId: owner.farmId,
        name: `E2E-SEMEN-BATCH-${prefix}-${Date.now()}`,
        strawQuantity,
        semenType,
        targetSex,
        // RAKHAL-330: cost per straw is now mandatory for a batch to be
        // usable in an AI event — give every test batch a default.
        costPerUnit: 500,
        createdBy: ownerUserId,
      },
    });
  }

  async function createServiceProvider(prefix: string) {
    return prisma.serviceProvider.create({
      data: {
        farmId: owner.farmId,
        name: `E2E Technician ${prefix} ${Date.now()}`,
        type: 'AI_TECHNICIAN',
      },
    });
  }

  it('FARM_INVENTORY with a valid semenBatchId decrements the straw', async () => {
    const cow = await createCow('INV-OK');
    const batch = await createSemenBatch('INV-OK', 10);

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
        financialAccountId,
        financialAccountId,
      })
      .expect(201);
    expect(res.body.data.semenSource).toBe('FARM_INVENTORY');

    const batchAfter = await prisma.semenBatch.findUniqueOrThrow({
      where: { id: batch.id },
    });
    expect(batchAfter.strawQuantity).toBe(9);

    const movement = await prisma.semenStrawMovement.findFirst({
      where: { batchId: batch.id, reason: 'AI_USE' },
    });
    expect(movement).not.toBeNull();
  });

  it('FARM_INVENTORY without semenBatchId is rejected', async () => {
    const cow = await createCow('INV-NOBATCH');
    await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'FARM_INVENTORY',
      })
      .expect(400);
  });

  it('TECHNICIAN_SUPPLIED with a valid serviceProviderId records traceability and never touches inventory', async () => {
    const cow = await createCow('TECH-OK');
    const provider = await createServiceProvider('OK');

    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: provider.id,
        sireNameOrCode: 'ABS Supersire',
        sireBreed: 'Holstein',
        semenType: 'CONVENTIONAL',
        serviceCost: 1000,
        paymentMethod: 'CASH',
        financialAccountId,
      })
      .expect(201);
    expect(res.body.data.semenSource).toBe('TECHNICIAN_SUPPLIED');
    expect(res.body.data.serviceProviderId).toBe(provider.id);
    expect(res.body.data.sireNameOrCode).toBe('ABS Supersire');

    const movementCount = await prisma.semenStrawMovement.count({
      where: { sourceEventId: res.body.data.id },
    });
    expect(movementCount).toBe(0);
  });

  it('TECHNICIAN_SUPPLIED with semenBatchId also set is rejected (mutual exclusivity)', async () => {
    const cow = await createCow('TECH-BATCH');
    const provider = await createServiceProvider('BATCH');
    const batch = await createSemenBatch('TECH-BATCH', 10);

    await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: provider.id,
        semenBatchId: batch.id,
      })
      .expect(400);
  });

  it('TECHNICIAN_SUPPLIED without serviceProviderId is rejected', async () => {
    const cow = await createCow('TECH-NOPROV');
    await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
      })
      .expect(400);
  });

  it('TECHNICIAN_SUPPLIED with a cross-farm serviceProviderId is rejected', async () => {
    const cow = await createCow('TECH-XFARM');
    const farm2 = await ctx.app
      .get(FarmService)
      .create(ownerUserId, { name: `E2E Cross Farm ${Date.now()}` });
    const otherProvider = await prisma.serviceProvider.create({
      data: {
        farmId: farm2.id,
        name: `E2E Other-farm Technician ${Date.now()}`,
        type: 'AI_TECHNICIAN',
      },
    });

    await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: otherProvider.id,
      })
      .expect(400);
  });

  it('EXTERNAL with minimal fields (no provider, no batch) is accepted (progressive-optional)', async () => {
    const cow = await createCow('EXT-MIN');
    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'EXTERNAL',
        serviceCost: 800,
        paymentMethod: 'CASH',
        financialAccountId,
      })
      .expect(201);
    expect(res.body.data.semenSource).toBe('EXTERNAL');
  });

  it('backward-compat: an old-client AI payload with no semenSource infers correctly', async () => {
    const cowWithBatch = await createCow('COMPAT-BATCH');
    const batch = await createSemenBatch('COMPAT', 10);
    const withBatch = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cowWithBatch.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenBatchId: batch.id,
        paymentMethod: 'CASH',
        financialAccountId,
      })
      .expect(201);
    expect(withBatch.body.data.semenSource).toBe('FARM_INVENTORY');
    const batchAfter = await prisma.semenBatch.findUniqueOrThrow({
      where: { id: batch.id },
    });
    expect(batchAfter.strawQuantity).toBe(9);

    const cowNoBatch = await createCow('COMPAT-NOBATCH');
    const noBatch = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cowNoBatch.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        serviceCost: 800,
        paymentMethod: 'CASH',
        financialAccountId,
      })
      .expect(201);
    expect(noBatch.body.data.semenSource).toBe('EXTERNAL');
  });

  it('edit: flipping FARM_INVENTORY to TECHNICIAN_SUPPLIED restores the straw and clears semenBatchId', async () => {
    const cow = await createCow('EDIT-TO-TECH');
    const batch = await createSemenBatch('EDIT-TO-TECH', 10);
    const provider = await createServiceProvider('EDIT-TO-TECH');

    const created = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'FARM_INVENTORY',
        semenBatchId: batch.id,
        paymentMethod: 'CASH',
        financialAccountId,
      })
      .expect(201);
    const id = created.body.data.id;

    const batchAfterCreate = await prisma.semenBatch.findUniqueOrThrow({
      where: { id: batch.id },
    });
    expect(batchAfterCreate.strawQuantity).toBe(9);

    const edited = await request(server())
      .patch(api(`/reproduction/breeding-events/${id}`))
      .set(...auth(owner))
      .send({
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: provider.id,
        // RAKHAL-330: switching away from FARM_INVENTORY needs its own
        // serviceCost — the batch cost no longer applies.
        serviceCost: 900,
        financialAccountId,
      })
      .expect(200);
    expect(edited.body.data.semenBatchId).toBeNull();
    expect(edited.body.data.serviceProviderId).toBe(provider.id);

    const batchAfterEdit = await prisma.semenBatch.findUniqueOrThrow({
      where: { id: batch.id },
    });
    expect(batchAfterEdit.strawQuantity).toBe(10);
  });

  it('edit: flipping TECHNICIAN_SUPPLIED to FARM_INVENTORY with a new batch decrements it and clears the provider', async () => {
    const cow = await createCow('EDIT-TO-INV');
    const provider = await createServiceProvider('EDIT-TO-INV');
    const batch = await createSemenBatch('EDIT-TO-INV', 10);

    const created = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: provider.id,
        serviceCost: 900,
        paymentMethod: 'CASH',
        financialAccountId,
      })
      .expect(201);
    const id = created.body.data.id;

    const edited = await request(server())
      .patch(api(`/reproduction/breeding-events/${id}`))
      .set(...auth(owner))
      .send({
        semenSource: 'FARM_INVENTORY',
        semenBatchId: batch.id,
        financialAccountId,
      })
      .expect(200);
    expect(edited.body.data.serviceProviderId).toBeNull();
    expect(edited.body.data.semenBatchId).toBe(batch.id);

    const batchAfterEdit = await prisma.semenBatch.findUniqueOrThrow({
      where: { id: batch.id },
    });
    expect(batchAfterEdit.strawQuantity).toBe(9);
  });

  it('FARM_INVENTORY inherits semenType/targetSex from the selected SEX_SORTED batch', async () => {
    const cow = await createCow('SEXSORTED');
    const batch = await createSemenBatch(
      'SEXSORTED',
      10,
      'SEX_SORTED',
      'FEMALE',
    );

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
        financialAccountId,
      })
      .expect(201);
    expect(res.body.data.semenType).toBe('SEX_SORTED');
    expect(res.body.data.targetSex).toBe('FEMALE');
  });

  it('FARM_INVENTORY inherits semenType=CONVENTIONAL and null targetSex from a conventional batch', async () => {
    const cow = await createCow('CONVENTIONAL');
    const batch = await createSemenBatch('CONVENTIONAL', 10, 'CONVENTIONAL');

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
        financialAccountId,
      })
      .expect(201);
    expect(res.body.data.semenType).toBe('CONVENTIONAL');
    expect(res.body.data.targetSex).toBeNull();
  });

  it('edit: switching to a different SEX_SORTED batch re-inherits semenType/targetSex from the new batch', async () => {
    const cow = await createCow('EDIT-INHERIT');
    const batchA = await createSemenBatch('EDIT-INHERIT-A', 10, 'CONVENTIONAL');
    const batchB = await createSemenBatch(
      'EDIT-INHERIT-B',
      10,
      'SEX_SORTED',
      'MALE',
    );

    const created = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'FARM_INVENTORY',
        semenBatchId: batchA.id,
        paymentMethod: 'CASH',
        financialAccountId,
      })
      .expect(201);
    expect(created.body.data.semenType).toBe('CONVENTIONAL');

    const edited = await request(server())
      .patch(api(`/reproduction/breeding-events/${created.body.data.id}`))
      .set(...auth(owner))
      .send({ semenBatchId: batchB.id, financialAccountId })
      .expect(200);
    expect(edited.body.data.semenType).toBe('SEX_SORTED');
    expect(edited.body.data.targetSex).toBe('MALE');
  });
});

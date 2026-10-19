import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-305 — edit heat / breeding / pregnancy-diagnosis / abortion /
 * dry-off. One test per row of the design doc §3.2 recalculation table.
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Reproduction — edit (RAKHAL-305, e2e)', () => {
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
        tagNumber: `E2E-EDIT-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
      },
    });
  }

  async function createBull(prefix: string) {
    return prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-EDIT-BULL-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'MALE',
        createdBy: ownerUserId,
      },
    });
  }

  async function createSemenBatch(prefix: string, strawQuantity = 10) {
    return prisma.semenBatch.create({
      data: {
        farmId: owner.farmId,
        name: `E2E-EDIT-BATCH-${prefix}-${Date.now()}`,
        strawQuantity,
        // RAKHAL-330: cost per straw is now mandatory for a batch to be
        // usable in an AI event — give every test batch a default.
        costPerUnit: 500,
        createdBy: ownerUserId,
      },
    });
  }

  // §3.2 row 1: Breeding semenBatchId change — restore old, decrement new.
  it('editBreedingEvent moves straws when semenBatchId changes', async () => {
    const cow = await createCow('STRAW');
    const oldBatch = await createSemenBatch('OLD', 10);
    const newBatch = await createSemenBatch('NEW', 10);

    const created = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenBatchId: oldBatch.id,
        paymentMethod: 'CASH',
        financialAccountId,
      })
      .expect(201);
    const breedingEventId = created.body.data.id;

    const oldAfterCreate = await prisma.semenBatch.findUniqueOrThrow({
      where: { id: oldBatch.id },
    });
    expect(oldAfterCreate.strawQuantity).toBe(9);

    await request(server())
      .patch(api(`/reproduction/breeding-events/${breedingEventId}`))
      .set(...auth(owner))
      .send({ semenBatchId: newBatch.id, financialAccountId })
      .expect(200);

    const oldAfterEdit = await prisma.semenBatch.findUniqueOrThrow({
      where: { id: oldBatch.id },
    });
    const newAfterEdit = await prisma.semenBatch.findUniqueOrThrow({
      where: { id: newBatch.id },
    });
    expect(oldAfterEdit.strawQuantity).toBe(10);
    expect(newAfterEdit.strawQuantity).toBe(9);
  });

  // §3.2 row 2: Breeding breedingDate change — pregnancy-check task moves.
  it('editBreedingEvent reschedules the pregnancy-check task when breedingDate changes', async () => {
    const cow = await createCow('TASK-RESCHED');
    const created = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        breedingMethod: 'NATURAL',
      })
      .expect(201);
    const breedingEventId = created.body.data.id;

    const taskBefore = await prisma.task.findFirstOrThrow({
      where: {
        sourceEventType: 'BREEDING_EVENT',
        sourceEventId: breedingEventId,
      },
    });
    expect(taskBefore.dueAt.toISOString()).toBe('2026-02-05T00:00:00.000Z');

    const newBreedingDate = '2026-03-01T00:00:00.000Z';
    await request(server())
      .patch(api(`/reproduction/breeding-events/${breedingEventId}`))
      .set(...auth(owner))
      .send({ breedingDate: newBreedingDate })
      .expect(200);

    const taskAfter = await prisma.task.findFirstOrThrow({
      where: { id: taskBefore.id },
    });
    expect(taskAfter.dueAt.toISOString()).toBe('2026-04-05T00:00:00.000Z');
  });

  // §3.2 row 3: Breeding bullId change — calf fatherId updated.
  it('editBreedingEvent updates a born calf fatherId when bullId changes', async () => {
    const cow = await createCow('BULL-CHANGE');
    const oldBull = await createBull('OLD');
    const newBull = await createBull('NEW');

    const breeding = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date('2025-01-01T00:00:00.000Z').toISOString(),
        breedingMethod: 'NATURAL',
        bullId: oldBull.id,
      })
      .expect(201);
    const breedingEventId = breeding.body.data.id;

    await request(server())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingEventId,
        diagnosisDate: new Date('2025-02-01T00:00:00.000Z').toISOString(),
        result: 'PREGNANT',
        diagnosisMethod: 'PALPATION',
        expectedCalvingDate: new Date('2025-10-08T00:00:00.000Z').toISOString(),
      })
      .expect(201);
    const pregnancy = await prisma.pregnancy.findFirstOrThrow({
      where: { breedingEventId },
    });

    const calving = await request(server())
      .post(api('/reproduction/calving-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        pregnancyId: pregnancy.id,
        calvingDate: new Date('2025-10-10T00:00:00.000Z').toISOString(),
        calvingEase: 'NORMAL',
        calves: [
          {
            tagNumber: `E2E-CALF-${Date.now()}`,
            gender: 'FEMALE',
            status: 'ALIVE',
          },
        ],
      })
      .expect(201);

    const calfBirth = await prisma.calfBirth.findFirstOrThrow({
      where: { calvingEventId: calving.body.data.id },
    });
    expect(calfBirth.calfId).not.toBeNull();

    const calfBefore = await prisma.cattle.findUniqueOrThrow({
      where: { id: calfBirth.calfId! },
    });
    expect(calfBefore.fatherId).toBe(oldBull.id);

    await request(server())
      .patch(api(`/reproduction/breeding-events/${breedingEventId}`))
      .set(...auth(owner))
      .send({ bullId: newBull.id })
      .expect(200);

    const calfAfter = await prisma.cattle.findUniqueOrThrow({
      where: { id: calfBirth.calfId! },
    });
    expect(calfAfter.fatherId).toBe(newBull.id);
  });

  // §3.2 row 4: Diagnosis PREGNANT→NOT_PREGNANT — retires Pregnancy + reverses AQR.
  it('editPregnancyDiagnosis retires the Pregnancy and reverses AQR on PREGNANT→NOT_PREGNANT', async () => {
    const cow = await createCow('RETIRE');
    const scoreBefore = (
      await prisma.cattle.findUniqueOrThrow({ where: { id: cow.id } })
    ).aqrScore;

    const diagnosis = await request(server())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        diagnosisDate: new Date().toISOString(),
        result: 'PREGNANT',
        diagnosisMethod: 'PALPATION',
        expectedCalvingDate: new Date(
          Date.now() + 200 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .expect(201);
    const diagnosisId = diagnosis.body.data.id;

    const pregnancy = await prisma.pregnancy.findFirstOrThrow({
      where: { sourceDiagnosisId: diagnosisId },
    });
    expect(pregnancy.status).toBe('ACTIVE');

    const scoreAfterConfirm = (
      await prisma.cattle.findUniqueOrThrow({ where: { id: cow.id } })
    ).aqrScore;
    expect(scoreAfterConfirm).toBe((scoreBefore ?? 0) + 5);

    await request(server())
      .patch(api(`/reproduction/pregnancy-diagnoses/${diagnosisId}`))
      .set(...auth(owner))
      .send({ result: 'NOT_PREGNANT' })
      .expect(200);

    const pregnancyAfter = await prisma.pregnancy.findUniqueOrThrow({
      where: { id: pregnancy.id },
    });
    expect(pregnancyAfter.status).toBe('FAILED');

    const scoreAfterRetire = (
      await prisma.cattle.findUniqueOrThrow({ where: { id: cow.id } })
    ).aqrScore;
    expect(scoreAfterRetire).toBe(scoreBefore ?? 0);
  });

  // §3.2 row 5: Diagnosis expectedCalvingDate change — Pregnancy + Lactation.recommendedDryOffAt.
  it('editPregnancyDiagnosis recomputes Pregnancy.expectedCalvingDate on change', async () => {
    const cow = await createCow('EXP-CALVING');
    const diagnosis = await request(server())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        diagnosisDate: new Date().toISOString(),
        result: 'PREGNANT',
        diagnosisMethod: 'PALPATION',
        expectedCalvingDate: new Date(
          Date.now() + 200 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .expect(201);
    const diagnosisId = diagnosis.body.data.id;
    const pregnancy = await prisma.pregnancy.findFirstOrThrow({
      where: { sourceDiagnosisId: diagnosisId },
    });

    const newExpectedCalvingDate = new Date(
      Date.now() + 210 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await request(server())
      .patch(api(`/reproduction/pregnancy-diagnoses/${diagnosisId}`))
      .set(...auth(owner))
      .send({ expectedCalvingDate: newExpectedCalvingDate })
      .expect(200);

    const pregnancyAfter = await prisma.pregnancy.findUniqueOrThrow({
      where: { id: pregnancy.id },
    });
    expect(pregnancyAfter.expectedCalvingDate?.toISOString()).toBe(
      newExpectedCalvingDate,
    );
  });

  // §3.2 row 8: Dry-off dryOffDate change — Lactation.endDate/DryPeriod dates move together.
  it('editDryOff moves Lactation.endDate together with the new dryOffDate', async () => {
    const cow = await createCow('DRYOFF');
    await prisma.lactation.create({
      data: {
        cattleId: cow.id,
        lactationNumber: 1,
        startDate: new Date('2025-01-01T00:00:00.000Z'),
        status: 'ACTIVE',
      },
    });

    const oldDryOffDate = '2026-01-01T00:00:00.000Z';
    const dryOffRes = await request(server())
      .post(api(`/reproduction/cattle/${cow.id}/dry-off`))
      .set(...auth(owner))
      .send({ dryOffDate: oldDryOffDate })
      .expect(201);
    const dryPeriodId = dryOffRes.body.data.id;

    const newDryOffDate = '2026-01-05T00:00:00.000Z';
    await request(server())
      .patch(api(`/reproduction/dry-off/${dryPeriodId}`))
      .set(...auth(owner))
      .send({ dryOffDate: newDryOffDate })
      .expect(200);

    const dryPeriod = await prisma.dryPeriod.findUniqueOrThrow({
      where: { id: dryPeriodId },
    });
    expect(dryPeriod.startDate.toISOString()).toBe(newDryOffDate);

    const lactation = await prisma.lactation.findFirstOrThrow({
      where: { cattleId: cow.id, endReason: 'DRY_OFF' },
    });
    expect(lactation.endDate?.toISOString()).toBe(newDryOffDate);
  });

  // §3.2 row 9: Any cattleId change recomputes derived state for both cows.
  it('editHeatEvent refreshes derived state for both the old and new cow on cattleId change', async () => {
    const cowA = await createCow('MOVE-A');
    const cowB = await createCow('MOVE-B');

    const heat = await request(server())
      .post(api('/reproduction/heat-events'))
      .set(...auth(owner))
      .send({
        cattleId: cowA.id,
        heatDateTime: new Date().toISOString(),
        detectionMethod: 'VISUAL',
        standingHeat: true,
      })
      .expect(201);
    const heatEventId = heat.body.data.id;

    await request(server())
      .patch(api(`/reproduction/heat-events/${heatEventId}`))
      .set(...auth(owner))
      .send({ cattleId: cowB.id })
      .expect(200);

    const moved = await prisma.heatEvent.findUniqueOrThrow({
      where: { id: heatEventId },
    });
    expect(moved.cattleId).toBe(cowB.id);

    const profileA = await prisma.reproductionProfile.findUnique({
      where: { cattleId: cowA.id },
    });
    const profileB = await prisma.reproductionProfile.findUnique({
      where: { cattleId: cowB.id },
    });
    expect(profileA).not.toBeNull();
    expect(profileB).not.toBeNull();
  });

  it('cancels a mistaken heat (removed from the feed); a closed false-alarm heat still shows its resolution', async () => {
    const cow = await createCow('CANCEL');
    const mk = async () =>
      (
        await request(server())
          .post(api('/reproduction/heat-events'))
          .set(...auth(owner))
          .send({
            cattleId: cow.id,
            heatDateTime: new Date().toISOString(),
            detectionMethod: 'VISUAL',
          })
          .expect(201)
      ).body.data.id as string;

    // False alarm: the feed row now carries the resolution so the UI can show it as closed.
    const falseAlarmId = await mk();
    await request(server())
      .post(api(`/reproduction/heat-events/${falseAlarmId}/resolve`))
      .set(...auth(owner))
      .send({ reason: 'FALSE_ALARM' })
      .expect(201);
    const feed = await request(server())
      .get(api(`/reproduction/events?cattleId=${cow.id}&eventType=heat`))
      .set(...auth(owner))
      .expect(200);
    const row = (
      feed.body.data as Array<{ id: string; details: Record<string, unknown> }>
    ).find((e) => e.id === falseAlarmId);
    expect(row?.details.resolution).toBe('FALSE_ALARM');
    expect(row?.details.resolved_at).toBeTruthy();

    // Cancel removes the row (open or closed) and is audited.
    const cancelId = await mk();
    await request(server())
      .post(api(`/reproduction/heat-events/${cancelId}/cancel`))
      .set(...auth(owner))
      .send({ reason: 'wrong day' })
      .expect(200);
    expect(
      await prisma.heatEvent.findUnique({ where: { id: cancelId } }),
    ).toBeNull();
    await request(server())
      .post(api(`/reproduction/heat-events/${falseAlarmId}/cancel`))
      .set(...auth(owner))
      .send({})
      .expect(200);
    await request(server())
      .post(api(`/reproduction/heat-events/${falseAlarmId}/cancel`))
      .set(...auth(owner))
      .send({})
      .expect(404);
  });

  it('403s a Worker attempting an edit (manager+ only)', async () => {
    const worker = await loginAs(
      ctx,
      'worker@demo.rakhal.test',
      'WorkerPass123',
    );
    const cow = await createCow('RBAC');
    const heat = await request(server())
      .post(api('/reproduction/heat-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        heatDateTime: new Date().toISOString(),
        detectionMethod: 'VISUAL',
        standingHeat: true,
      })
      .expect(201);

    await request(server())
      .patch(api(`/reproduction/heat-events/${heat.body.data.id}`))
      .set(...auth(worker))
      .send({ notes: 'nope' })
      .expect(403);
  });
});

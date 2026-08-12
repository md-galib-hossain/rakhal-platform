import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-322/323/324/325 — reproduction hardening: duplicate-task
 * prevention, idempotency keys on event-creation routes, concurrency
 * revalidation inside transactions, and the explicit pregnancy-correction
 * workflow. Requires the dev stack up + `pnpm seed`.
 */
describe('Reproduction — hardening (e2e)', () => {
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
        tagNumber: `E2E-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        purpose: 'MILK',
        createdBy: ownerUserId,
      },
    });
  }

  async function createPendingBreeding(cattleId: string) {
    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'NATURAL',
      })
      .expect(201);
    return res.body.data.id as string;
  }

  it('RAKHAL-322: two rapid SUSPECTED diagnoses on the same breeding open only one active recheck task', async () => {
    const cow = await createCow('DUP-TASK');
    const breedingEventId = await createPendingBreeding(cow.id);

    const diagnosisBody = {
      cattleId: cow.id,
      breedingEventId,
      diagnosisDate: new Date().toISOString(),
      result: 'SUSPECTED',
      diagnosisMethod: 'PALPATION',
    };
    await request(server())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth(owner))
      .send(diagnosisBody)
      .expect(201);
    await request(server())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth(owner))
      .send(diagnosisBody)
      .expect(201);

    const recheckTasks = await prisma.task.findMany({
      where: {
        farmId: owner.farmId,
        sourceEventType: 'BREEDING_EVENT',
        sourceEventId: breedingEventId,
        status: { not: 'COMPLETED' },
        name: { startsWith: 'Pregnancy recheck — ' },
      },
    });
    expect(recheckTasks).toHaveLength(1);
  });

  it('RAKHAL-323: a repeated Idempotency-Key on createHeatEvent returns the original row, not a second one', async () => {
    const cow = await createCow('IDEMPOTENT');
    const key = `e2e-idem-${Date.now()}`;
    const body = {
      cattleId: cow.id,
      heatDateTime: new Date().toISOString(),
      detectionMethod: 'VISUAL',
      standingHeat: true,
    };

    const first = await request(server())
      .post(api('/reproduction/heat-events'))
      .set(...auth(owner))
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);
    const second = await request(server())
      .post(api('/reproduction/heat-events'))
      .set(...auth(owner))
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);

    expect(second.body.data.id).toBe(first.body.data.id);

    const heatEvents = await prisma.heatEvent.findMany({
      where: { cattleId: cow.id },
    });
    expect(heatEvents).toHaveLength(1);
  });

  it('RAKHAL-324: return-to-heat racing a PREGNANT diagnosis on the same breeding — exactly one wins, no inconsistent state', async () => {
    const cow = await createCow('RACE');
    const breedingEventId = await createPendingBreeding(cow.id);

    const [returnToHeatRes, diagnosisRes] = await Promise.all([
      request(server())
        .post(
          api(
            `/reproduction/breeding-events/${breedingEventId}/return-to-heat`,
          ),
        )
        .set(...auth(owner))
        .send({ heatDateTime: new Date().toISOString() }),
      request(server())
        .post(api('/reproduction/pregnancy-diagnoses'))
        .set(...auth(owner))
        .send({
          cattleId: cow.id,
          breedingEventId,
          diagnosisDate: new Date().toISOString(),
          result: 'PREGNANT',
          diagnosisMethod: 'PALPATION',
        }),
    ]);

    const outcomes = [returnToHeatRes.status, diagnosisRes.status].sort();
    // Both requests target the same PENDING_CHECK breeding — under the
    // row-lock guard, one succeeds (201) and the other observes the
    // now-resolved breeding and 400s. They must never both succeed.
    expect(outcomes).toEqual([201, 400].sort());

    const pregnancies = await prisma.pregnancy.count({
      where: { cattleId: cow.id, status: 'ACTIVE' },
    });
    const returnedHeats = await prisma.heatEvent.count({
      where: { returnedFromBreedingEventId: breedingEventId },
    });
    // Not both a live pregnancy AND a recorded return-to-heat for the same
    // breeding — that would be the inconsistent state the lock prevents.
    expect(pregnancies === 1 && returnedHeats === 1).toBe(false);
  });

  it('RAKHAL-325: correcting a pregnancy marks it CANCELLED_CORRECTION with an audit trail and excludes it from reproductionProfile.totalPregnancies', async () => {
    const cow = await createCow('CORRECTION');
    const breedingEventId = await createPendingBreeding(cow.id);

    const diagnosisRes = await request(server())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingEventId,
        diagnosisDate: new Date().toISOString(),
        result: 'PREGNANT',
        diagnosisMethod: 'PALPATION',
      })
      .expect(201);

    const pregnancy = await prisma.pregnancy.findFirstOrThrow({
      where: { sourceDiagnosisId: diagnosisRes.body.data.id },
    });

    const correctRes = await request(server())
      .post(api(`/reproduction/pregnancies/${pregnancy.id}/correct`))
      .set(...auth(owner))
      .send({ reason: 'Entered against the wrong cow by mistake' })
      .expect(201);

    expect(correctRes.body.data.status).toBe('CANCELLED_CORRECTION');
    expect(correctRes.body.data.correctionReason).toBe(
      'Entered against the wrong cow by mistake',
    );
    expect(correctRes.body.data.correctedAt).not.toBeNull();

    // Correcting again is rejected, not silently re-applied.
    await request(server())
      .post(api(`/reproduction/pregnancies/${pregnancy.id}/correct`))
      .set(...auth(owner))
      .send({ reason: 'again' })
      .expect(400);

    const profile = await prisma.reproductionProfile.findUnique({
      where: { cattleId: cow.id },
    });
    expect(profile?.totalPregnancies).toBe(0);
  });
});

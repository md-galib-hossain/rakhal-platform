import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-307 — Cattle intake: real current state. `POST /cattle` can now
 * declare "she is already pregnant" / "she is already milking" / "she has a
 * current health condition" at registration time, and every FEMALE gets a
 * `ReproductionProfile` on create. Requires the dev stack up + `pnpm seed`.
 */
describe('Cattle — intake real current state (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const tag = (prefix: string) =>
    `E2E-307-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('intakePregnancy creates a PURCHASE_INTAKE PregnancyDiagnosis + Pregnancy, and the cow shows in the 30-day calving forecast', async () => {
    const expectedCalvingDate = new Date(
      Date.now() + 10 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const res = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({
        tagNumber: tag('PREG'),
        gender: 'FEMALE',
        priorCalvings: 1,
        intakePregnancy: { expectedCalvingDate },
      })
      .expect(201);

    const cattleId = res.body.data.id;
    expect(res.body.data.reproductiveStatus).toBe('PREGNANT');

    // pregnancyStage/lactationStage are only enriched on findAll/findOne
    // (composeStatus()'s reproCtx is deliberately undefined on create/update).
    const detail = await request(server())
      .get(api(`/cattle/${cattleId}`))
      .set(...auth(owner))
      .expect(200);
    expect(detail.body.data.pregnancyStage).not.toBeNull();

    const diagnosis = await prisma.pregnancyDiagnosis.findFirstOrThrow({
      where: { cattleId },
    });
    expect(diagnosis.diagnosisMethod).toBe('PURCHASE_INTAKE');
    expect(diagnosis.result).toBe('PREGNANT');

    const pregnancy = await prisma.pregnancy.findFirstOrThrow({
      where: { cattleId },
    });
    expect(pregnancy.sourceDiagnosisId).toBe(diagnosis.id);
    expect(pregnancy.status).toBe('ACTIVE');

    // RD-055 regression guard: `priorCalvings` must survive the
    // `refreshDerivedState` recompute that runs at the end of `create()`,
    // not get reset to 0 by the real-CalvingEvent-count recompute.
    const profile = await prisma.reproductionProfile.findFirstOrThrow({
      where: { cattleId },
    });
    expect(profile.totalCalvings).toBe(1);

    const dash = await request(server())
      .get(api('/reproduction/dashboard'))
      .set(...auth(owner))
      .expect(200);
    expect(
      (
        dash.body.data.calving_forecast_30_days as {
          cattle_id: string;
        }[]
      ).some((c) => c.cattle_id === cattleId),
    ).toBe(true);
  });

  it('intakeLactation creates an isEstimated PURCHASED_LACTATING Lactation when productionStatus=MILKING', async () => {
    const res = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({
        tagNumber: tag('MILK'),
        gender: 'FEMALE',
        priorCalvings: 2,
        productionStatus: 'MILKING',
        intakeLactation: {
          estimatedDaysInMilk: 45,
          estimatedLactationNumber: 2,
        },
      })
      .expect(201);

    const cattleId = res.body.data.id;
    const lactation = await prisma.lactation.findFirstOrThrow({
      where: { cattleId },
    });
    expect(lactation.startReason).toBe('PURCHASED_LACTATING');
    expect(lactation.isEstimated).toBe(true);
    expect(lactation.estimatedDaysInMilk).toBe(45);
    expect(lactation.lactationNumber).toBe(2);

    const detail = await request(server())
      .get(api(`/cattle/${cattleId}`))
      .set(...auth(owner))
      .expect(200);
    expect(detail.body.data.lactationStage).not.toBeNull();
  });

  it('intakeHealthCondition creates an open HealthCase and the health chip reads SICK immediately', async () => {
    const res = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({
        tagNumber: tag('SICK'),
        gender: 'FEMALE',
        intakeHealthCondition: {
          diagnosis: 'Mild lameness observed at purchase',
          diagnosisType: 'INJURY',
          priority: 'MEDIUM',
        },
      })
      .expect(201);

    const cattleId = res.body.data.id;
    expect(res.body.data.healthStatus).toBe('SICK');

    const healthCase = await prisma.healthCase.findFirstOrThrow({
      where: { cattleId },
    });
    expect(healthCase.status).toBe('ACTIVE');
    expect(healthCase.diagnosis).toBe('Mild lameness observed at purchase');
  });

  it('every FEMALE gets a ReproductionProfile on create, even with no intake fields supplied', async () => {
    const res = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({
        tagNumber: tag('PLAIN-FEMALE'),
        gender: 'FEMALE',
      })
      .expect(201);

    const cattleId = res.body.data.id;
    const profile = await prisma.reproductionProfile.findUniqueOrThrow({
      where: { cattleId },
    });
    expect(profile).toBeDefined();
  });

  it('MILKING at intake 400s without priorCalvings and without lactationStartDate/intakeLactation', async () => {
    await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({
        tagNumber: tag('MILK-NO-HISTORY'),
        gender: 'FEMALE',
        productionStatus: 'MILKING',
        priorCalvings: 1,
      })
      .expect(400);
  });

  it('PATCH /cattle/:id with bcs writes a BodyConditionScore row and refreshes lastBcs', async () => {
    const created = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({ tagNumber: tag('BCS'), gender: 'FEMALE' })
      .expect(201);
    const cattleId = created.body.data.id;

    const res = await request(server())
      .patch(api(`/cattle/${cattleId}`))
      .set(...auth(owner))
      .send({ bcs: 3 })
      .expect(200);

    expect(res.body.data.lastBcs).toBe(3);
    const bcsRecord = await prisma.bodyConditionScore.findFirstOrThrow({
      where: { cattleId },
    });
    expect(bcsRecord.score).toBe(3);
  });

  it('PATCH /cattle/:id with lactationStartDate 400s when an ACTIVE lactation already exists', async () => {
    const created = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({
        tagNumber: tag('DUP-LACT'),
        gender: 'FEMALE',
        priorCalvings: 1,
        productionStatus: 'MILKING',
        intakeLactation: { estimatedDaysInMilk: 10 },
      })
      .expect(201);
    const cattleId = created.body.data.id;

    await request(server())
      .patch(api(`/cattle/${cattleId}`))
      .set(...auth(owner))
      .send({ lactationStartDate: new Date().toISOString() })
      .expect(400);
  });
});

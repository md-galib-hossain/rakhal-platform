import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-275 — HealthCase gains a structured, optional `condition` enum
 * (`HealthCondition`) alongside the existing free-text `diagnosis`. This spec
 * exercises the report-sickness create path and the case update path.
 *
 * NOTE: requires the `20260805120000_health_condition_enum` migration to be
 * applied (`prisma migrate deploy`) against the dev DB before it can run —
 * per this ticket's instructions, the migration was written but NOT applied
 * here (shared dev DB, one `migrate dev`/`deploy` at a time across agents).
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Health — structured HealthCondition (RAKHAL-275)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let cattleId: string;

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
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'DemoPass123');
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });

    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-RAKHAL275-${Date.now()}`,
        gender: 'FEMALE',
        createdBy: ownerUser.id,
      },
    });
    cattleId = cow.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('report-sickness accepts an optional structured condition', async () => {
    const res = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        diagnosis: 'Swollen udder, warm to touch',
        condition: 'MASTITIS',
        diagnosisType: 'DISEASE',
        priority: 'HIGH',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.condition).toBe('MASTITIS');
    expect(res.body.data.diagnosis).toBe('Swollen udder, warm to touch');
  });

  it('report-sickness still works with condition omitted (nullable/additive)', async () => {
    const res = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        diagnosis: 'Generalised lethargy, cause unclear',
        diagnosisType: 'DISEASE',
        priority: 'MEDIUM',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.condition).toBeNull();
  });

  it('rejects a report-sickness payload with an invalid condition value', async () => {
    const res = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        diagnosis: 'Bad payload test',
        condition: 'NOT_A_CONDITION',
        diagnosisType: 'DISEASE',
        priority: 'LOW',
      });

    expect(res.status).toBe(400);
  });

  it('PATCH /health/cases/:id updates the structured condition', async () => {
    const createRes = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        diagnosis: 'Off-feed, mild fever',
        diagnosisType: 'DISEASE',
        priority: 'MEDIUM',
      });
    expect(createRes.status).toBe(201);
    const caseId = createRes.body.data.id as string;
    expect(createRes.body.data.condition).toBeNull();

    const patchRes = await request(server())
      .patch(api(`/health/cases/${caseId}`))
      .set(...auth(owner))
      .send({ condition: 'FEVER' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.condition).toBe('FEVER');
  });

  it('worker (read-only RBAC) cannot update condition via PATCH', async () => {
    const createRes = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        diagnosis: 'RBAC probe case',
        diagnosisType: 'DISEASE',
        priority: 'LOW',
      });
    const caseId = createRes.body.data.id as string;

    const patchRes = await request(server())
      .patch(api(`/health/cases/${caseId}`))
      .set(...auth(worker))
      .send({ condition: 'INJURY' });

    expect(patchRes.status).toBe(403);
  });
});

/**
 * Bug fix (2026-08-22, user report): applying a preventive/vaccination
 * HealthCase to a healthy cow wrongly flipped her derived healthStatus to
 * SICK and fired a sickness AQR penalty/task/notification. Preventive
 * diagnosisTypes (VACCINATION/PREVENTIVE/DEWORMING/ROUTINE_CHECKUP/
 * BREEDING_RELATED) must not read as sickness; real DISEASE/INJURY cases
 * must still work exactly as before.
 */
describe('Health — preventive/vaccine care does not mark a healthy cow SICK', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let cattleId: string;

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
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });

    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-PREVENTIVE-${Date.now()}`,
        gender: 'FEMALE',
        createdBy: ownerUser.id,
      },
    });
    cattleId = cow.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('a VACCINATION case leaves the cow HEALTHY', async () => {
    const createRes = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        diagnosis: 'Annual FMD vaccine',
        diagnosisType: 'VACCINATION',
        priority: 'LOW',
      });
    expect(createRes.status).toBe(201);

    const detailRes = await request(server())
      .get(api(`/cattle/${cattleId}`))
      .set(...auth(owner));
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.healthStatus).toBe('HEALTHY');
  });

  it('a real DISEASE case still flips the cow to SICK', async () => {
    const createRes = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        diagnosis: 'Actual sickness after the vaccine case above',
        diagnosisType: 'DISEASE',
        priority: 'HIGH',
      });
    expect(createRes.status).toBe(201);

    const detailRes = await request(server())
      .get(api(`/cattle/${cattleId}`))
      .set(...auth(owner));
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.healthStatus).toBe('SICK');
  });
});

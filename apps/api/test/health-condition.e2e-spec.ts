import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-275 — HealthCase gains a structured, optional `condition` enum
 * (`HealthCondition`) alongside the free-text detail field (RAKHAL-418: was
 * the required `diagnosis`, now the optional `note`). This spec exercises
 * the report-sickness create path and the case update path.
 *
 * RAKHAL-418 extended this same file: `diagnosisType` (8 values) is gone,
 * replaced by `careType` (`CURATIVE` | `PREVENTIVE`); `note` is optional, so
 * a case can now be reported with only a structured `condition` and nothing
 * else; `GET /health/sick-bay?diagnosis=` filters both `note` and the
 * `condition` label.
 */
describe('Health — structured HealthCondition (RAKHAL-275) + one-field collapse (RAKHAL-418)', () => {
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
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
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
        note: 'Swollen udder, warm to touch',
        condition: 'MASTITIS',
        careType: 'CURATIVE',
        priority: 'HIGH',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.condition).toBe('MASTITIS');
    expect(res.body.data.note).toBe('Swollen udder, warm to touch');
  });

  it('report-sickness still works with condition omitted (nullable/additive)', async () => {
    const res = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        note: 'Generalised lethargy, cause unclear',
        careType: 'CURATIVE',
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
        note: 'Bad payload test',
        condition: 'NOT_A_CONDITION',
        careType: 'CURATIVE',
        priority: 'LOW',
      });

    expect(res.status).toBe(400);
  });

  // RAKHAL-418 AC: "Free-text diagnosis stops being required" — a case can
  // be reported with only the structured `condition`, no `note` at all.
  it('accepts a report-sickness payload with condition but no note', async () => {
    const res = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        condition: 'KETOSIS',
        careType: 'CURATIVE',
        priority: 'MEDIUM',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.condition).toBe('KETOSIS');
    expect(res.body.data.note).toBeNull();
  });

  it('rejects a report-sickness payload missing careType', async () => {
    const res = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        note: 'No careType supplied',
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
        note: 'Off-feed, mild fever',
        careType: 'CURATIVE',
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
        note: 'RBAC probe case',
        careType: 'CURATIVE',
        priority: 'LOW',
      });
    const caseId = createRes.body.data.id as string;

    const patchRes = await request(server())
      .patch(api(`/health/cases/${caseId}`))
      .set(...auth(worker))
      .send({ condition: 'INJURY' });

    expect(patchRes.status).toBe(403);
  });

  // RAKHAL-418 AC: "GET /health/sick-bay?diagnosis= keeps working — it
  // filters the note field and the condition label."
  it('sick-bay diagnosis filter matches note free text', async () => {
    await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        note: 'Rare unmistakable phrase xyzzy-note',
        careType: 'CURATIVE',
        priority: 'LOW',
      });

    const res = await request(server())
      .get(api('/health/sick-bay?diagnosis=xyzzy-note'))
      .set(...auth(owner));

    expect(res.status).toBe(200);
    expect(
      res.body.data.some((c: { note: string | null }) =>
        c.note?.includes('xyzzy-note'),
      ),
    ).toBe(true);
  });

  it('sick-bay diagnosis filter matches the condition label, not just note text', async () => {
    await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        condition: 'MILK_FEVER',
        careType: 'CURATIVE',
        priority: 'LOW',
      });

    // The readable label is "Milk Fever" — the query text is neither the
    // enum key nor the note (there is none), proving the match comes from
    // the condition label, not a coincidental note-text hit.
    const res = await request(server())
      .get(api('/health/sick-bay?diagnosis=milk fever'))
      .set(...auth(owner));

    expect(res.status).toBe(200);
    expect(
      res.body.data.some(
        (c: { condition: string | null }) => c.condition === 'MILK_FEVER',
      ),
    ).toBe(true);
  });
});

/**
 * Bug fix (2026-08-22, user report): applying a preventive/vaccination
 * HealthCase to a healthy cow wrongly flipped her derived healthStatus to
 * SICK and fired a sickness AQR penalty/task/notification. Preventive care
 * (RAKHAL-418: `careType: 'PREVENTIVE'`, was a preventive-flavoured
 * `diagnosisType`) must not read as sickness; real curative cases must still
 * work exactly as before.
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

  it('a PREVENTIVE case leaves the cow HEALTHY', async () => {
    const createRes = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        note: 'Annual FMD vaccine',
        careType: 'PREVENTIVE',
        priority: 'LOW',
      });
    expect(createRes.status).toBe(201);

    const detailRes = await request(server())
      .get(api(`/cattle/${cattleId}`))
      .set(...auth(owner));
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.healthStatus).toBe('HEALTHY');
  });

  it('a real CURATIVE case still flips the cow to SICK', async () => {
    const createRes = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        note: 'Actual sickness after the vaccine case above',
        careType: 'CURATIVE',
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

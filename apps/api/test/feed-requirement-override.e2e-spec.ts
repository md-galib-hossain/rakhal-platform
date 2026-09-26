import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * MILESTONE 28 (RAKHAL-462) — a cow's manual nutrition requirement: set / replace / turn off, history,
 * validation, RBAC, audit, and that every read path (grid, DMI, batch) follows it while it is on.
 * (docs/EPIC_MANUAL_REQUIREMENT.md §6, §10.)
 *
 * Requires the dev stack up + `pnpm seed`. The cow and its override rows are removed in afterAll.
 */
describe('Manual requirement override (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerUserId: string;
  let cattleId: string;
  const DAY_MS = 86_400_000;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const url = (id = cattleId) => api(`/feed/cattle/${id}/requirement-override`);
  const put = (body: Record<string, unknown>, u = owner, id = cattleId) =>
    request(server())
      .put(url(id))
      .set(...auth(u))
      .send(body);
  const isoDay = (offsetDays: number) =>
    new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);

  const gridRow = async (date: string) => {
    const r = await request(server())
      .get(api(`/feed/grid?date=${date}`))
      .set(...auth(owner))
      .expect(200);
    return (
      r.body.data.cows as Array<{
        cattle_id: string;
        requirement: {
          dm_kg: number;
          source: string;
          flags: string[];
          dynamic_requirements?: { dm_kg: number };
          manual?: { override_id: string };
        } | null;
      }>
    ).find((c) => c.cattle_id === cattleId);
  };

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
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-M28-${Date.now()}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
        lastWeightKg: 500,
        lastBcs: 3,
        productionStatus: 'MILKING',
      },
      select: { id: true },
    });
    cattleId = cow.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.cattleRequirementOverride.deleteMany({ where: { cattleId } });
    await prisma.cattle.deleteMany({ where: { id: cattleId } });
    await ctx.app.close();
  });

  it('starts calculated: no active row, no last row', async () => {
    const r = await request(server())
      .get(url())
      .set(...auth(owner))
      .expect(200);
    expect(r.body.data.active).toBeNull();
    expect(r.body.data.last).toBeNull();
    expect(r.body.data.resolved.source).toBe('DYNAMIC');
  });

  it('RBAC: a worker can read but not set or turn off', async () => {
    await request(server())
      .get(url())
      .set(...auth(worker))
      .expect(200);
    await put({ dmKg: 10, cpKg: 1.6, meMj: 120 }, worker).expect(403);
    await request(server())
      .delete(url())
      .set(...auth(worker))
      .expect(403);
  });

  it('rejects absurd values (400) and an unknown cow (404)', async () => {
    await put({ dmKg: 100, cpKg: 1.6, meMj: 120 }).expect(400);
    await put({ dmKg: 10, cpKg: 1.6, meMj: 1 }).expect(400);
    await put({ dmKg: 10, cpKg: 10, meMj: 120 }).expect(400);
    await put({ dmKg: 10, cpKg: 1.6, meMj: 120 }, owner, 'ghost-id').expect(
      404,
    );
    await request(server())
      .delete(url())
      .set(...auth(owner))
      .expect(404); // manual is not on yet
  });

  it('set → the grid, batch and DMI all use the manual DM; yesterday stays calculated', async () => {
    const calculatedToday = (await gridRow(isoDay(0)))?.requirement?.dm_kg;

    const res = await put({
      dmKg: 10,
      cpKg: 1.6,
      meMj: 120,
      note: 'e2e',
    }).expect(200);
    expect(res.body.data.active).toMatchObject({ dm_kg: 10, note: 'e2e' });
    expect(res.body.data.warnings).toEqual([]);
    expect(res.body.data.resolved).toMatchObject({
      source: 'MANUAL',
      flags: [],
      requirements: { dm_kg: 10, calcium_kg: null, breakdown: null },
    });

    const today = await gridRow(isoDay(0));
    expect(today?.requirement).toMatchObject({
      dm_kg: 10,
      source: 'MANUAL',
      flags: [],
    });
    expect(today?.requirement?.dynamic_requirements?.dm_kg).toBeCloseTo(
      calculatedToday as number,
      2,
    );

    const batch = await request(server())
      .get(api(`/feed/requirements?cattleIds=${cattleId}`))
      .set(...auth(owner))
      .expect(200);
    expect(batch.body.data.cows[0].requirements.dm_kg).toBe(10);

    const dmi = await request(server())
      .get(api(`/feed/cattle/${cattleId}/dmi`))
      .set(...auth(owner))
      .expect(200);
    expect(JSON.stringify(dmi.body.data)).toContain('"expected_dmi_kg":10');

    // The plan editor's preview reads the same source (RFE-130): manual + a Ca/P that is "not set", never green.
    const preview = await request(server())
      .post(api('/feed/plans/preview-fit'))
      .set(...auth(owner))
      .send({ lines: [], cattleId })
      .expect(201);
    expect(preview.body.data.source).toBe('MANUAL');
    expect(preview.body.data.manual.override_id).toBeTruthy();
    const ca = (
      preview.body.data.nutrients as Array<{
        key: string;
        requirement: number | null;
        severity: string;
      }>
    ).find((n) => n.key === 'calcium');
    expect(ca).toMatchObject({ requirement: null, severity: 'unknown' });

    // No backdating: a day before the override was set is still the calculated model.
    expect((await gridRow(isoDay(-1)))?.requirement?.source).toBe('DYNAMIC');
  });

  it('changing the values keeps history (old row REPLACED); soft warnings are returned but saved', async () => {
    const res = await put({ dmKg: 4, cpKg: 0.3, meMj: 60 }).expect(200);
    const codes = (res.body.data.warnings as Array<{ code: string }>).map(
      (w) => w.code,
    );
    expect(codes).toEqual(
      expect.arrayContaining(['dm_body_weight', 'cp_share', 'energy_density']),
    );
    await put({ dmKg: 11, cpKg: 1.8, meMj: 130 }).expect(200);

    const hist = await request(server())
      .get(api(`/feed/cattle/${cattleId}/requirement-overrides`))
      .set(...auth(owner))
      .expect(200);
    const rows = hist.body.data as Array<{
      dm_kg: number;
      end_reason: string | null;
      effective_to: string | null;
      dynamic_snapshot: { dm_kg: number };
    }>;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ dm_kg: 11, end_reason: null });
    expect(rows[1].end_reason).toBe('REPLACED');
    expect(rows[2].end_reason).toBe('REPLACED');
    expect(rows[0].dynamic_snapshot.dm_kg).toBeGreaterThan(0);
    // exactly one open row
    expect(rows.filter((r) => r.effective_to === null)).toHaveLength(1);
  });

  it('turn off → calculated again; history ends TURNED_OFF; turning on again adds a row; audit is written', async () => {
    const off = await request(server())
      .delete(url())
      .set(...auth(owner))
      .expect(200);
    expect(off.body.data.active).toBeNull();
    expect(off.body.data.resolved.source).toBe('DYNAMIC');
    expect((await gridRow(isoDay(0)))?.requirement?.source).toBe('DYNAMIC');

    const after = await request(server())
      .get(url())
      .set(...auth(owner))
      .expect(200);
    expect(after.body.data.active).toBeNull();
    expect(after.body.data.last).toMatchObject({
      dm_kg: 11,
      end_reason: 'TURNED_OFF',
    });
    await request(server())
      .delete(url())
      .set(...auth(owner))
      .expect(404);

    await put({ dmKg: 11, cpKg: 1.8, meMj: 130 }).expect(200);
    const hist = await request(server())
      .get(api(`/feed/cattle/${cattleId}/requirement-overrides?limit=2`))
      .set(...auth(owner))
      .expect(200);
    expect(hist.body.data).toHaveLength(2);
    expect(hist.body.meta.hasNextPage).toBe(true);

    const logs = await prisma.activityLog.count({
      where: { farmId: owner.farmId, relatedCattleId: cattleId },
    });
    expect(logs).toBeGreaterThanOrEqual(2);
  });
});

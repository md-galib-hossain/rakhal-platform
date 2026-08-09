import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-298 — Heat resolution: an AI closes the open heat it responds to,
 * and a heat can also be closed manually (FALSE_ALARM/SKIPPED_CYCLE) via
 * `POST /reproduction/heat-events/:id/resolve`. Requires the dev stack up +
 * `pnpm seed`.
 */
describe('Reproduction — heat resolution (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
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
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
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

  it('createBreedingEvent stamps the most recent open heat as INSEMINATED', async () => {
    const cow = await createCow('AI-STAMP');
    const now = Date.now();

    const heatRes = await request(server())
      .post(api('/reproduction/heat-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        heatDateTime: new Date(now).toISOString(),
        detectionMethod: 'VISUAL',
        standingHeat: true,
      })
      .expect(201);
    const heatEventId = heatRes.body.data.id;

    const breedingRes = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date(now + 3_600_000).toISOString(),
        breedingMethod: 'NATURAL',
      })
      .expect(201);
    const breedingEventId = breedingRes.body.data.id;

    const heat = await prisma.heatEvent.findUniqueOrThrow({
      where: { id: heatEventId },
    });
    expect(heat.resolvedAt).not.toBeNull();
    expect(heat.resolvedByBreedingEventId).toBe(breedingEventId);
    expect(heat.resolutionReason).toBe('INSEMINATED');
  });

  it('RAKHAL-320: resolves a same-calendar-day heat even when breedingDate is date-only (midnight)', async () => {
    const cow = await createCow('AI-SAME-DAY');

    // Heat observed mid-morning today.
    const today = new Date();
    today.setHours(10, 0, 0, 0);
    const heatRes = await request(server())
      .post(api('/reproduction/heat-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        heatDateTime: today.toISOString(),
        detectionMethod: 'VISUAL',
        standingHeat: true,
      })
      .expect(201);
    const heatEventId = heatRes.body.data.id;

    // AI recorded later the same day, but with a date-only breedingDate
    // (parses to midnight) — before RAKHAL-320 this failed the openHeat
    // `lte: breedingDate` comparison and left the heat unresolved.
    const dateOnly = today.toISOString().slice(0, 10);
    await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: dateOnly,
        breedingMethod: 'NATURAL',
      })
      .expect(201);

    const heat = await prisma.heatEvent.findUniqueOrThrow({
      where: { id: heatEventId },
    });
    expect(heat.resolvedAt).not.toBeNull();
    expect(heat.resolutionReason).toBe('INSEMINATED');
  });

  it('createBreedingEvent is a silent no-op when no open heat exists', async () => {
    const cow = await createCow('AI-NOOP');

    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'NATURAL',
      })
      .expect(201);

    expect(res.body.data.id).toBeDefined();
  });

  it('resolves an open heat manually as FALSE_ALARM (worker-permitted)', async () => {
    const cow = await createCow('FALSE-ALARM');
    const heatRes = await request(server())
      .post(api('/reproduction/heat-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        heatDateTime: new Date().toISOString(),
        detectionMethod: 'VISUAL',
        standingHeat: true,
      })
      .expect(201);
    const heatEventId = heatRes.body.data.id;

    const resolveRes = await request(server())
      .post(api(`/reproduction/heat-events/${heatEventId}/resolve`))
      .set(...auth(worker))
      .send({ reason: 'FALSE_ALARM', notes: 'Misread standing behavior' })
      .expect(201);

    expect(resolveRes.body.data.resolutionReason).toBe('FALSE_ALARM');
    expect(resolveRes.body.data.resolvedAt).not.toBeNull();
  });

  it('400s when resolving an already-resolved heat', async () => {
    const cow = await createCow('DOUBLE-RESOLVE');
    const heatRes = await request(server())
      .post(api('/reproduction/heat-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        heatDateTime: new Date().toISOString(),
        detectionMethod: 'VISUAL',
        standingHeat: true,
      })
      .expect(201);
    const heatEventId = heatRes.body.data.id;

    await request(server())
      .post(api(`/reproduction/heat-events/${heatEventId}/resolve`))
      .set(...auth(owner))
      .send({ reason: 'SKIPPED_CYCLE' })
      .expect(201);

    await request(server())
      .post(api(`/reproduction/heat-events/${heatEventId}/resolve`))
      .set(...auth(owner))
      .send({ reason: 'FALSE_ALARM' })
      .expect(400);
  });

  it('a resolved heat is excluded from the dashboard in_heat_now panel', async () => {
    const cow = await createCow('DASHBOARD-EXCLUDE');
    const heatRes = await request(server())
      .post(api('/reproduction/heat-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        heatDateTime: new Date().toISOString(),
        detectionMethod: 'VISUAL',
        standingHeat: true,
      })
      .expect(201);
    const heatEventId = heatRes.body.data.id;

    let dash = await request(server())
      .get(api('/reproduction/dashboard'))
      .set(...auth(owner))
      .expect(200);
    expect(
      dash.body.data.action_required.in_heat_now.some(
        (h: { cattle_id: string }) => h.cattle_id === cow.id,
      ),
    ).toBe(true);

    await request(server())
      .post(api(`/reproduction/heat-events/${heatEventId}/resolve`))
      .set(...auth(owner))
      .send({ reason: 'FALSE_ALARM' })
      .expect(201);

    dash = await request(server())
      .get(api('/reproduction/dashboard'))
      .set(...auth(owner))
      .expect(200);
    expect(
      dash.body.data.action_required.in_heat_now.some(
        (h: { cattle_id: string }) => h.cattle_id === cow.id,
      ),
    ).toBe(false);
  });
});

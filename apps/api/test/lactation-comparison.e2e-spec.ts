import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-287 — `GET /reproduction/lactations/compare` (current vs. previous
 * lactation for one cow, DIM-aligned) and `GET /reproduction/lactations/compare/groups`
 * (farm-level average yield/peak/persistency bucketed by parity/shed/feedGroup/dimRange).
 *
 * Creates its own isolated `Cattle`/`Lactation`/`MilkLogEntry` rows directly
 * via Prisma (unique tags, and a freshly-created `Shed` for the group-by
 * test so bucket counts are deterministic regardless of other e2e specs'
 * leftover data on this shared dev DB) — same isolation pattern
 * `reproduction-lifecycle.e2e-spec.ts` already uses.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Lactation comparison (e2e)', () => {
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

  async function createCow(
    prefix: string,
    extra: Record<string, unknown> = {},
  ) {
    return prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
        ...extra,
      },
    });
  }

  function daysAgo(n: number): Date {
    return new Date(Date.now() - n * 86_400_000);
  }

  it('compare?cattleId=&byLactationNumber=true returns current vs. lactationNumber-1, DIM-aligned', async () => {
    const cow = await createCow('CMP');

    const previousLactation = await prisma.lactation.create({
      data: {
        cattleId: cow.id,
        lactationNumber: 1,
        startDate: daysAgo(400),
        endDate: daysAgo(100),
        status: 'ENDED',
        startReason: 'CALVING',
        endReason: 'DRY_OFF',
        peakMilkYield: 18,
        peakMilkDate: daysAgo(390),
        peakDaysInMilk: 10,
      },
    });
    const currentLactation = await prisma.lactation.create({
      data: {
        cattleId: cow.id,
        lactationNumber: 2,
        startDate: daysAgo(5),
        status: 'ACTIVE',
        startReason: 'CALVING',
        peakMilkYield: 22,
        peakMilkDate: daysAgo(2),
        peakDaysInMilk: 3,
      },
    });
    await prisma.milkLogEntry.create({
      data: {
        farmId: owner.farmId,
        cattleId: cow.id,
        logDate: daysAgo(2),
        session: 'MORNING',
        yieldL: 22,
        disposition: 'SALEABLE',
        createdBy: ownerUserId,
      },
    });

    const res = await request(server())
      .get(
        api(
          `/reproduction/lactations/compare?cattleId=${cow.id}&byLactationNumber=true`,
        ),
      )
      .set(...auth(owner))
      .expect(200);

    expect(res.body.data.cattleId).toBe(cow.id);
    expect(res.body.data.byLactationNumber).toBe(true);
    expect(res.body.data.current.lactationId).toBe(currentLactation.id);
    expect(res.body.data.current.lactationNumber).toBe(2);
    expect(res.body.data.previous.lactationId).toBe(previousLactation.id);
    expect(res.body.data.previous.lactationNumber).toBe(1);
    expect(res.body.data.current.peak.yieldL).toBe(22);
    expect(res.body.data.previous.peak.yieldL).toBe(18);
    // DIM-alignment: both series are indexed from their own dim=0, regardless
    // of how far apart their real calendar start dates are.
    expect(res.body.data.alignedSeries[0].dim).toBe(0);
    expect(res.body.data.alignedSeries[0].currentYieldL).toBeGreaterThanOrEqual(
      0,
    );
  }, 30_000);

  it('compare?byLactationNumber=false picks the most recently ended lactation instead', async () => {
    const cow = await createCow('CMPFALSE');
    const olderEnded = await prisma.lactation.create({
      data: {
        cattleId: cow.id,
        lactationNumber: 1,
        startDate: daysAgo(500),
        endDate: daysAgo(300),
        status: 'ENDED',
        startReason: 'CALVING',
        endReason: 'DRY_OFF',
      },
    });
    const recentEnded = await prisma.lactation.create({
      data: {
        cattleId: cow.id,
        lactationNumber: 2,
        startDate: daysAgo(200),
        endDate: daysAgo(50),
        status: 'ENDED',
        startReason: 'CALVING',
        endReason: 'DRY_OFF',
      },
    });
    await prisma.lactation.create({
      data: {
        cattleId: cow.id,
        lactationNumber: 3,
        startDate: daysAgo(5),
        status: 'ACTIVE',
        startReason: 'CALVING',
      },
    });

    const res = await request(server())
      .get(
        api(
          `/reproduction/lactations/compare?cattleId=${cow.id}&byLactationNumber=false`,
        ),
      )
      .set(...auth(owner))
      .expect(200);

    expect(res.body.data.previous.lactationId).toBe(recentEnded.id);
    expect(res.body.data.previous.lactationId).not.toBe(olderEnded.id);
  }, 30_000);

  it('compare returns previous:null (not an error) when the cow has no prior lactation', async () => {
    const cow = await createCow('CMPNOPREV');
    await prisma.lactation.create({
      data: {
        cattleId: cow.id,
        lactationNumber: 1,
        startDate: daysAgo(5),
        status: 'ACTIVE',
        startReason: 'CALVING',
      },
    });

    const res = await request(server())
      .get(api(`/reproduction/lactations/compare?cattleId=${cow.id}`))
      .set(...auth(owner))
      .expect(200);

    expect(res.body.data.previous).toBeNull();
  }, 30_000);

  it('compare 404s when the cow has no active lactation', async () => {
    const cow = await createCow('CMPNOACTIVE');

    await request(server())
      .get(api(`/reproduction/lactations/compare?cattleId=${cow.id}`))
      .set(...auth(owner))
      .expect(404);
  }, 30_000);

  it('compare/groups?groupBy=shed buckets active lactations by shed, deterministically via a fresh shed', async () => {
    const shed = await prisma.shed.create({
      data: {
        farmId: owner.farmId,
        name: `E2E Shed ${Date.now()}`,
        code: `E2E-${Date.now()}`,
      },
    });
    const cowA = await createCow('GRPA', { shedId: shed.id });
    const cowB = await createCow('GRPB', { shedId: shed.id });
    await prisma.lactation.create({
      data: {
        cattleId: cowA.id,
        lactationNumber: 1,
        startDate: daysAgo(30),
        status: 'ACTIVE',
        startReason: 'CALVING',
        peakMilkYield: 20,
        peakDaysInMilk: 5,
      },
    });
    await prisma.lactation.create({
      data: {
        cattleId: cowB.id,
        lactationNumber: 1,
        startDate: daysAgo(30),
        status: 'ACTIVE',
        startReason: 'CALVING',
        peakMilkYield: 30,
        peakDaysInMilk: 5,
      },
    });

    const res = await request(server())
      .get(api('/reproduction/lactations/compare/groups?groupBy=shed'))
      .set(...auth(owner))
      .expect(200);

    const bucket = (res.body.data as Array<{ bucketKey: string }>).find(
      (b) => b.bucketKey === shed.id,
    );
    expect(bucket).toBeDefined();
    expect(bucket?.cowCount).toBe(2);
    expect(bucket?.avgPeakMilkYield).toBe(25);
  }, 30_000);

  it('compare/groups?groupBy=parity rejects an invalid groupBy value', async () => {
    await request(server())
      .get(api('/reproduction/lactations/compare/groups?groupBy=bogus'))
      .set(...auth(owner))
      .expect(400);
  }, 30_000);
});

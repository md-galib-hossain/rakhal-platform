import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-363 — `GET /reproduction/cows`: every cow currently OPEN /
 * BRED_AWAITING_CONFIRMATION / PREGNANT, replacing the dashboard's embedded,
 * uncapped, OPEN-only `open_cows[]` list. Walks one cow OPEN -> BRED -> PREGNANT
 * -> CALVED, asserting the row's fields at each stage, then confirms a calving
 * date earlier than the pregnancy's own `expectedCalvingDate` is accepted
 * (expected/actual calving dates are independent, per `createCalvingEventInner`).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Reproduction — GET /reproduction/cows (e2e)', () => {
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
        createdBy: ownerUserId,
      },
    });
  }

  async function listCows(status?: string) {
    const res = await request(server())
      .get(api('/reproduction/cows'))
      .query(status ? { status, limit: 100 } : { limit: 100 })
      .set(...auth(owner))
      .expect(200);
    return res.body.data as Array<{
      cattle_id: string;
      status: string | null;
      last_ai_date: string | null;
      pregnancy_checked: boolean;
      days_open: number | null;
      days_pregnant: number | null;
      expected_calving_date: string | null;
    }>;
  }

  it('worker lacks reproduction.read (only reproduction.heat is worker-granted) and is forbidden', async () => {
    await request(server())
      .get(api('/reproduction/cows'))
      .set(...auth(worker))
      .expect(403);
  });

  it('tracks a cow OPEN -> BRED_AWAITING_CONFIRMATION -> PREGNANT -> CALVED, and accepts an early calving date', async () => {
    const cow = await createCow('COWS');
    const now = Date.now();
    const daysMs = (n: number) => n * 86_400_000;

    // Force OPEN via the summary endpoint's own refresh (no history yet).
    await request(server())
      .get(api(`/cattle/${cow.id}/reproduction-summary`))
      .set(...auth(owner))
      .expect(200);

    let rows = await listCows('OPEN');
    let row = rows.find((r) => r.cattle_id === cow.id);
    expect(row).toBeDefined();
    expect(row!.status).toBe('OPEN');
    expect(row!.pregnancy_checked).toBe(false);
    expect(row!.expected_calving_date).toBeNull();

    // AI -> BRED_AWAITING_CONFIRMATION, not yet checked.
    const breedingRes = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date(now).toISOString(),
        breedingMethod: 'NATURAL',
        expectedPregnancyCheckDate: new Date(now + daysMs(35)).toISOString(),
      })
      .expect(201);
    const breedingEventId = breedingRes.body.data.id;

    rows = await listCows('BRED_AWAITING_CONFIRMATION');
    row = rows.find((r) => r.cattle_id === cow.id);
    expect(row).toBeDefined();
    expect(row!.pregnancy_checked).toBe(false);
    expect(row!.last_ai_date).not.toBeNull();

    // Confirmed pregnant -> PREGNANT, checked=true, expected_calving_date set,
    // days_pregnant present.
    const expectedCalvingDate = new Date(now + daysMs(270));
    await request(server())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingEventId,
        diagnosisDate: new Date(now).toISOString(),
        result: 'PREGNANT',
        diagnosisMethod: 'ULTRASOUND',
        expectedCalvingDate: expectedCalvingDate.toISOString(),
      })
      .expect(201);

    rows = await listCows('PREGNANT');
    row = rows.find((r) => r.cattle_id === cow.id);
    expect(row).toBeDefined();
    expect(row!.pregnancy_checked).toBe(true);
    expect(row!.days_pregnant).not.toBeNull();
    expect(
      new Date(row!.expected_calving_date!).toISOString().slice(0, 10),
    ).toBe(expectedCalvingDate.toISOString().slice(0, 10));

    const pregnancy = await prisma.pregnancy.findFirstOrThrow({
      where: { cattleId: cow.id, status: 'ACTIVE' },
    });

    // Calving BEFORE the expected calving date — must be accepted, not rejected.
    // Confirms expected/actual calving dates are independent (no blocking
    // validation ties CreateCalvingEventDto.calvingDate to Pregnancy.expectedCalvingDate).
    const earlyCalvingDate = new Date(now + daysMs(200));
    expect(earlyCalvingDate.getTime()).toBeLessThan(
      expectedCalvingDate.getTime(),
    );
    await request(server())
      .post(api('/reproduction/calving-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        pregnancyId: pregnancy.id,
        calvingDate: earlyCalvingDate.toISOString(),
        calvingEase: 'NORMAL',
      })
      .expect(201);

    const calved = await prisma.pregnancy.findUniqueOrThrow({
      where: { id: pregnancy.id },
    });
    expect(calved.status).toBe('CALVED');
    expect(calved.actualCalvingDate?.toISOString().slice(0, 10)).toBe(
      earlyCalvingDate.toISOString().slice(0, 10),
    );
    // expectedCalvingDate is untouched by the earlier actual calving.
    expect(calved.expectedCalvingDate?.toISOString().slice(0, 10)).toBe(
      expectedCalvingDate.toISOString().slice(0, 10),
    );

    // No longer PREGNANT -> not in any of the three list statuses.
    rows = await listCows();
    row = rows.find((r) => r.cattle_id === cow.id);
    expect(row).toBeUndefined();
  }, 30_000);
});

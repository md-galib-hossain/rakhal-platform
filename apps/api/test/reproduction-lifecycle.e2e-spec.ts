import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-271 (v2 correction) — `ReproductionState` (5-value core) +
 * `ReproductionAlert[]` (derived, not stored) split. v1 had 8 values baked
 * into one enum, including time-bound alerts (`IN_HEAT`/`PREGNANCY_CHECK_DUE`/
 * `EXPECTED_TO_CALVE`) as if they were core biological states — a pregnant
 * cow near calving is still PREGNANT, not a different state. This spec walks
 * one cow through a full breeding→heat→insemination→check→calving cycle,
 * asserting the derived CORE STATE stays coarse while the ALERTS array picks
 * up the time-bound detail, plus a second cow through pregnancy→abortion to
 * confirm the cow returns to a derived state instead of a dead-end value.
 *
 * Creates its own isolated Cattle rows via Prisma (unique tags) to avoid
 * colliding with shared seeded data across parallel e2e workers.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Reproduction — ReproductionState/Alert lifecycle (e2e)', () => {
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

  async function summary(
    cattleId: string,
  ): Promise<{ status: string; reproductionAlerts: string[] }> {
    const res = await request(server())
      .get(api(`/cattle/${cattleId}/reproduction-summary`))
      .set(...auth(owner))
      .expect(200);
    return {
      status: res.body.data.status,
      reproductionAlerts: res.body.data.reproductionAlerts,
    };
  }

  it('core state stays coarse (OPEN -> BRED_AWAITING_CONFIRMATION -> PREGNANT -> POSTPARTUM_WAITING) while alerts pick up the time-bound detail', async () => {
    const cow = await createCow('LIFECYCLE');
    const now = Date.now();
    const daysMs = (n: number) => n * 86_400_000;

    // No history yet, well past breeding age (no dateOfBirth) -> OPEN, no alerts.
    let s = await summary(cow.id);
    expect(s.status).toBe('OPEN');
    expect(s.reproductionAlerts).toEqual([]);

    // A recent heat event with nothing bred yet. v2: this does NOT change the
    // core state (v1's IN_HEAT is gone) — it only adds a HEAT_DETECTED alert.
    await request(server())
      .post(api('/reproduction/heat-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        heatDateTime: new Date(now).toISOString(),
        detectionMethod: 'VISUAL',
        standingHeat: true,
      })
      .expect(201);
    s = await summary(cow.id);
    expect(s.status).toBe('OPEN');
    expect(s.reproductionAlerts).toContain('HEAT_DETECTED');

    // AI service recorded, check date in the future -> BRED_AWAITING_CONFIRMATION
    // (renamed from v1's INSEMINATED), no PREGNANCY_CHECK_DUE alert yet.
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
    s = await summary(cow.id);
    expect(s.status).toBe('BRED_AWAITING_CONFIRMATION');
    expect(s.reproductionAlerts).not.toContain('PREGNANCY_CHECK_DUE');

    // Push the expected check date into the past. v2: the core state does NOT
    // change to a new value (v1's PREGNANCY_CHECK_DUE state is gone) — the cow
    // stays BRED_AWAITING_CONFIRMATION and gains the PREGNANCY_CHECK_DUE alert.
    // No API mutates a breeding event's check date after creation, so this is
    // set directly (mirrors how a "past due" state would arise naturally as
    // time passes on a real farm).
    await prisma.breedingEvent.update({
      where: { id: breedingEventId },
      data: { expectedPregnancyCheckDate: new Date(now - daysMs(2)) },
    });
    s = await summary(cow.id);
    expect(s.status).toBe('BRED_AWAITING_CONFIRMATION');
    expect(s.reproductionAlerts).toContain('PREGNANCY_CHECK_DUE');

    // Confirmed pregnant, expected calving date inside the farm's default
    // 21-day close-up window. v2: still plain PREGNANT (v1's EXPECTED_TO_CALVE
    // state is gone) — closeness to calving now only adds a CALVING_DUE alert.
    await request(server())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingEventId,
        diagnosisDate: new Date(now).toISOString(),
        result: 'PREGNANT',
        diagnosisMethod: 'ULTRASOUND',
        expectedCalvingDate: new Date(now + daysMs(10)).toISOString(),
      })
      .expect(201);
    s = await summary(cow.id);
    expect(s.status).toBe('PREGNANT');
    expect(s.reproductionAlerts).toContain('CALVING_DUE');

    const pregnancy = await prisma.pregnancy.findFirstOrThrow({
      where: { cattleId: cow.id, status: 'ACTIVE' },
    });

    // Calving: dam should flip to POSTPARTUM_WAITING (inside the default
    // 60-day VWP), Cattle.productionStatus -> MILKING. `Cattle.lactationStartDate`
    // is gone (RAKHAL-269/271 v2 correction) — lactation start now lives
    // solely on the `Lactation` row, stamped with startReason=CALVING +
    // sourceCalvingEventId.
    const calvingRes = await request(server())
      .post(api('/reproduction/calving-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        pregnancyId: pregnancy.id,
        calvingDate: new Date(now).toISOString(),
        calvingEase: 'NORMAL',
      })
      .expect(201);
    s = await summary(cow.id);
    expect(s.status).toBe('POSTPARTUM_WAITING');

    const cattleAfter = await prisma.cattle.findUniqueOrThrow({
      where: { id: cow.id },
    });
    expect(cattleAfter.productionStatus).toBe('MILKING');

    const lactation = await prisma.lactation.findFirstOrThrow({
      where: { cattleId: cow.id, status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
    });
    expect(lactation.startReason).toBe('CALVING');
    expect(lactation.sourceCalvingEventId).toBe(calvingRes.body.data.id);
    expect(new Date(lactation.startDate).toISOString().slice(0, 10)).toBe(
      new Date(now).toISOString().slice(0, 10),
    );
  }, 30_000);

  it('RAKHAL-320: a SUSPECTED diagnosis completes the pregnancy-check task, rolls the due date to the recheck window, and drops off the dashboard until then', async () => {
    const cow = await createCow('SUSPECTED');
    const now = Date.now();
    const daysMs = (n: number) => n * 86_400_000;

    const breedingRes = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date(now).toISOString(),
        breedingMethod: 'NATURAL',
      })
      .expect(201);
    const breedingEventId = breedingRes.body.data.id;

    // Push the check date into the past -> shows up on the "due" dashboard.
    await prisma.breedingEvent.update({
      where: { id: breedingEventId },
      data: { expectedPregnancyCheckDate: new Date(now - daysMs(2)) },
    });

    let dash = await request(server())
      .get(api('/reproduction/dashboard'))
      .set(...auth(owner))
      .expect(200);
    expect(
      dash.body.data.action_required.pregnancy_check_due.some(
        (b: { cattle_id: string }) => b.cattle_id === cow.id,
      ),
    ).toBe(true);

    await request(server())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingEventId,
        diagnosisDate: new Date(now).toISOString(),
        result: 'SUSPECTED',
        diagnosisMethod: 'PALPATION',
      })
      .expect(201);

    // Breeding stays PENDING_CHECK (still genuinely unresolved) — no
    // fabricated PREGNANT/NOT_PREGNANT outcome — but the stale due date is
    // gone from the "due now" dashboard panel.
    const breedingAfter = await prisma.breedingEvent.findUniqueOrThrow({
      where: { id: breedingEventId },
    });
    expect(breedingAfter.status).toBe('PENDING_CHECK');
    expect(breedingAfter.expectedPregnancyCheckDate!.getTime()).toBeGreaterThan(
      now,
    );

    dash = await request(server())
      .get(api('/reproduction/dashboard'))
      .set(...auth(owner))
      .expect(200);
    expect(
      dash.body.data.action_required.pregnancy_check_due.some(
        (b: { cattle_id: string }) => b.cattle_id === cow.id,
      ),
    ).toBe(false);

    const s = await summary(cow.id);
    expect(s.status).toBe('BRED_AWAITING_CONFIRMATION');
  }, 30_000);

  it('returns a cow to OPEN after an abortion instead of a dead-end status', async () => {
    const cow = await createCow('ABORT');
    const now = Date.now();

    const breedingRes = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date(now).toISOString(),
        breedingMethod: 'NATURAL',
      })
      .expect(201);

    const diagRes = await request(server())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingEventId: breedingRes.body.data.id,
        diagnosisDate: new Date(now).toISOString(),
        result: 'PREGNANT',
        diagnosisMethod: 'PALPATION',
      })
      .expect(201);
    expect((await summary(cow.id)).status).toBe('PREGNANT');

    const pregnancy = await prisma.pregnancy.findFirstOrThrow({
      where: { cattleId: cow.id, status: 'ACTIVE' },
    });
    expect(diagRes.body.data.result).toBe('PREGNANT');

    await request(server())
      .post(api('/reproduction/abortion-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        pregnancyId: pregnancy.id,
        abortionDate: new Date(now).toISOString(),
        suspectedCause: 'e2e test',
      })
      .expect(201);

    expect((await summary(cow.id)).status).toBe('OPEN');

    const profile = await prisma.reproductionProfile.findUniqueOrThrow({
      where: { cattleId: cow.id },
    });
    expect(profile.totalAbortions).toBe(1);
    expect(profile.currentPregnancyId).toBeNull();
  }, 30_000);
});

import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-290 — dry-off completeness + lifecycle auto-close +
 * withdrawal-enforcement hardening. Four regression scenarios, per the
 * ticket's own acceptance criteria:
 *
 * 1. A milk log entry created while an ACTIVE `SafetyWithdrawal` exists for
 *    the cow is forced `disposition: WITHHELD` (never `SALEABLE`) — verifies
 *    `MilkService.saveLog()`'s write path isn't bypassable.
 * 2. `recordDryOff()` leaves `Cattle.productionStatus=DRY`, DIM reads N/A
 *    (`dim: null`), and `Lactation.endReason=DRY_OFF`.
 * 3. `createCalvingEvent()` on a dam whose prior `Lactation` is still ACTIVE
 *    (a missed dry-off) auto-closes it with `endReason:
 *    MISSING_DRY_OFF_RECORD` and surfaces the closure on the response.
 * 4. Culling a cow (`DELETE /cattle/:id` with `reason: culled`) auto-closes
 *    her ACTIVE `Lactation` with `endReason: CULLED`.
 *
 * Creates its own isolated Cattle/Lactation/SafetyWithdrawal rows via Prisma
 * (unique tags) to avoid colliding with shared seeded data across parallel
 * e2e workers. Requires the dev stack up + `pnpm seed`.
 */
describe('Lactation lifecycle hardening — dry-off/calving/lifecycle-exit/withdrawal (RAKHAL-290, e2e)', () => {
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

  const uniqueTag = (prefix: string) =>
    `E2E-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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

  async function createMilkingCow(prefix: string) {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: uniqueTag(prefix),
        gender: 'FEMALE',
        productionStatus: 'MILKING',
        createdBy: ownerUserId,
      },
    });
    const lactation = await prisma.lactation.create({
      data: {
        cattleId: cow.id,
        lactationNumber: 1,
        startDate: new Date(Date.now() - 200 * 86_400_000),
        status: 'ACTIVE',
      },
    });
    return { cow, lactation };
  }

  it('1. a milk log entry during an active SafetyWithdrawal is forced WITHHELD (write path is not bypassable)', async () => {
    const { cow } = await createMilkingCow('WD');

    const healthCase = await prisma.healthCase.create({
      data: {
        farmId: owner.farmId,
        cattleId: cow.id,
        caseCode: `HC-${uniqueTag('WD')}`,
        diagnosis: 'Mastitis under antibiotic treatment',
        diagnosisType: 'DISEASE',
        priority: 'HIGH',
        reportedBy: ownerUserId,
      },
    });
    await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId: cow.id,
        healthCaseId: healthCase.id,
        milkWithdrawalUntil: new Date(Date.now() + 5 * 86_400_000),
        status: 'ACTIVE',
      },
    });

    // Far-future randomized date so this never collides with seeded/other
    // e2e-run data for this session on this cow.
    const logDate = new Date(
      Date.now() + (2000 + Math.floor(Math.random() * 1000)) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);

    await request(server())
      .post(api('/milk/log'))
      .set(...auth(owner))
      .send({
        date: logDate,
        session: 'MORNING',
        entries: [{ cattleId: cow.id, yieldL: 8 }],
      })
      .expect(201);

    const entry = await prisma.milkLogEntry.findUniqueOrThrow({
      where: {
        cattleId_logDate_session: {
          cattleId: cow.id,
          logDate: new Date(`${logDate}T00:00:00.000Z`),
          session: 'MORNING',
        },
      },
    });
    // Never SALEABLE while the withdrawal is active — hard-blocked, not just
    // discouraged: the DTO exposes no field a caller could use to override it.
    expect(entry.disposition).toBe('WITHHELD');
    expect(entry.tankType).toBe('WITHHOLDING');
  });

  it('2. recordDryOff leaves productionStatus=DRY, dim=null, and Lactation.endReason=DRY_OFF', async () => {
    const { cow, lactation } = await createMilkingCow('DRYOFF');

    await request(server())
      .post(api(`/reproduction/cattle/${cow.id}/dry-off`))
      .set(...auth(owner))
      .send({ notes: 'e2e RAKHAL-290 dry-off' })
      .expect(201);

    const lactationAfter = await prisma.lactation.findUniqueOrThrow({
      where: { id: lactation.id },
    });
    expect(lactationAfter.status).toBe('ENDED');
    expect(lactationAfter.endReason).toBe('DRY_OFF');

    const cattleAfter = await request(server())
      .get(api(`/cattle/${cow.id}`))
      .set(...auth(owner))
      .expect(200);
    expect(cattleAfter.body.data.productionStatus).toBe('DRY');
    // No stale DIM — the ended lactation no longer counts as "active" for
    // composeStatus()'s dim derivation.
    expect(cattleAfter.body.data.dim).toBeNull();
  });

  it('3. calving without a prior dry-off auto-closes the still-ACTIVE lactation with MISSING_DRY_OFF_RECORD, visible on the response', async () => {
    const { cow, lactation: missedLactation } =
      await createMilkingCow('NODRYOFF');
    const calvingDate = new Date(
      Date.now() + (3000 + Math.floor(Math.random() * 1000)) * 86_400_000,
    );

    const res = await request(server())
      .post(api('/reproduction/calving-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        calvingDate: calvingDate.toISOString(),
        calvingEase: 'NORMAL',
      })
      .expect(201);

    // Not a silent overwrite — the closure is on the response.
    expect(res.body.data.closedMissingDryOffLactation).toBeTruthy();
    expect(res.body.data.closedMissingDryOffLactation.id).toBe(
      missedLactation.id,
    );
    expect(res.body.data.closedMissingDryOffLactation.endReason).toBe(
      'MISSING_DRY_OFF_RECORD',
    );

    const priorLactationAfter = await prisma.lactation.findUniqueOrThrow({
      where: { id: missedLactation.id },
    });
    expect(priorLactationAfter.status).toBe('ENDED');
    expect(priorLactationAfter.endReason).toBe('MISSING_DRY_OFF_RECORD');
    expect(priorLactationAfter.endDate?.toISOString().slice(0, 10)).toBe(
      calvingDate.toISOString().slice(0, 10),
    );

    // The new lactation still opens normally.
    const newActiveLactation = await prisma.lactation.findFirst({
      where: { cattleId: cow.id, status: 'ACTIVE' },
    });
    expect(newActiveLactation).toBeTruthy();
    expect(newActiveLactation!.id).not.toBe(missedLactation.id);
  });

  it('4. culling a cow auto-closes her ACTIVE lactation with endReason=CULLED', async () => {
    const { cow, lactation } = await createMilkingCow('CULL');

    await request(server())
      .delete(api(`/cattle/${cow.id}`))
      .set(...auth(owner))
      .send({ reason: 'culled' })
      .expect(200);

    const lactationAfter = await prisma.lactation.findUniqueOrThrow({
      where: { id: lactation.id },
    });
    expect(lactationAfter.status).toBe('ENDED');
    expect(lactationAfter.endReason).toBe('CULLED');

    const cattleAfter = await prisma.cattle.findUniqueOrThrow({
      where: { id: cow.id },
    });
    expect(cattleAfter.herdStatus).toBe('CULLED');
    expect(cattleAfter.productionStatus).toBeNull();
    expect(cattleAfter.deletedAt).toBeNull();
  });
});

import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-420 (docs/PROJECT_PROGRESS.md): `GET /health/safety-withdrawals` is a projection ticket —
 * every field already exists in the database, this just surfaces it. Covers: each row gains
 * `medicineName` (resolved through the `TreatmentLog` snapshot, never a live `Medicine` join that
 * can come back null once archived), `caseCode`, and whole-day `milkDaysRemaining`/
 * `meatDaysRemaining` (negative clamped to 0); `?activeOnly=true` returns only rows still
 * withholding (`ACTIVE`/`READY_FOR_RELEASE`).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Health — safety withdrawal projection (e2e, RAKHAL-420)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let cattleId: string;
  let healthCaseId: string;
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
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = ownerUser.id;

    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-RAKHAL420-${Date.now()}`,
        gender: 'FEMALE',
        productionStatus: 'MILKING',
        createdBy: ownerUserId,
      },
    });
    cattleId = cow.id;

    const healthCase = await prisma.healthCase.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        caseCode: `HC-E2E-RAKHAL420-${Date.now()}`,
        note: 'Mastitis under antibiotic treatment',
        careType: 'CURATIVE',
        priority: 'HIGH',
        reportedBy: ownerUserId,
      },
    });
    healthCaseId = healthCase.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('projects medicineName (via the TreatmentLog snapshot, not a live join), caseCode, and a whole-day countdown', async () => {
    // medicineId intentionally null — proves medicineName comes from the TreatmentLog's own
    // snapshot column, never a live Medicine join (which would have nothing to join through).
    const treatmentLog = await prisma.treatmentLog.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        medicineId: null,
        medicineName: 'E2E Amoxicillin Snapshot',
        administeredAt: new Date(),
        administeredBy: ownerUserId,
      },
    });

    const threeDaysOut = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const withdrawal = await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        treatmentLogId: treatmentLog.id,
        milkWithdrawalUntil: threeDaysOut,
        status: 'ACTIVE',
      },
    });

    const res = await request(server())
      .get(api(`/health/safety-withdrawals?cattleId=${cattleId}`))
      .set(...auth(owner))
      .expect(200);
    const row = (
      res.body.data as Array<{
        id: string;
        medicineName: string | null;
        caseCode: string;
        milkDaysRemaining: number | null;
        meatDaysRemaining: number | null;
      }>
    ).find((r) => r.id === withdrawal.id);
    expect(row).toBeDefined();
    expect(row!.medicineName).toBe('E2E Amoxicillin Snapshot');
    const expectedCaseCode = (
      await prisma.healthCase.findUniqueOrThrow({
        where: { id: healthCaseId },
        select: { caseCode: true },
      })
    ).caseCode;
    expect(row!.caseCode).toBe(expectedCaseCode);
    expect(row!.milkDaysRemaining).toBe(3);
    // No meat withdrawal on this row at all.
    expect(row!.meatDaysRemaining).toBeNull();
  });

  it('clamps a past-due countdown to 0 rather than going negative', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const withdrawal = await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        milkWithdrawalUntil: yesterday,
        status: 'ACTIVE',
      },
    });

    const res = await request(server())
      .get(api(`/health/safety-withdrawals?cattleId=${cattleId}`))
      .set(...auth(owner))
      .expect(200);
    const row = (
      res.body.data as Array<{ id: string; milkDaysRemaining: number }>
    ).find((r) => r.id === withdrawal.id);
    expect(row?.milkDaysRemaining).toBe(0);
  });

  it('?activeOnly=true returns only rows still withholding (ACTIVE/READY_FOR_RELEASE)', async () => {
    const active = await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        milkWithdrawalUntil: new Date(Date.now() + 86_400_000),
        status: 'ACTIVE',
      },
    });
    const readyForRelease = await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        milkWithdrawalUntil: new Date(Date.now() - 86_400_000),
        status: 'READY_FOR_RELEASE',
      },
    });
    const released = await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        milkWithdrawalUntil: new Date(Date.now() - 2 * 86_400_000),
        status: 'RELEASED',
      },
    });

    const res = await request(server())
      .get(
        api(`/health/safety-withdrawals?cattleId=${cattleId}&activeOnly=true`),
      )
      .set(...auth(owner))
      .expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toContain(active.id);
    expect(ids).toContain(readyForRelease.id);
    expect(ids).not.toContain(released.id);
  });
});

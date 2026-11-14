import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RD-012(c) — quarantine (post-treatment milk/meat hold, user's own clarification) surfaces as
 * `isQuarantined`/`quarantineUntil` on `GET /cattle`/`GET /cattle/:id`, derived from an active
 * `SafetyWithdrawal` — a sibling field to `healthStatus`, deliberately NOT folded into it (ADR-020
 * already removed the same signal, under the name `WITHHOLDING`, from that exact union to avoid
 * duplicating `MilkService.getMilkEligibility()`'s ownership of it). The `?healthStatus=QUARANTINE`
 * list filter, previously dead (matched nothing), is wired to the same `where` as `WITHHOLDING`.
 *
 * Mirrors `safety-withdrawal-release.e2e-spec.ts`'s pattern: a `SafetyWithdrawal` row created
 * directly via Prisma (its own create routes are Healthcare's, out of this ticket's scope) rather
 * than driving the full treatment-log flow just to get one row.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Cattle — quarantine derived from SafetyWithdrawal (e2e, RD-012c)', () => {
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

  async function createCowWithHealthCase() {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-RD012C-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
      },
    });
    const healthCase = await prisma.healthCase.create({
      data: {
        farmId: owner.farmId,
        cattleId: cow.id,
        caseCode: `HC-E2E-RD012C-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        note: 'Mastitis under antibiotic treatment',
        careType: 'CURATIVE',
        priority: 'HIGH',
        reportedBy: ownerUserId,
      },
    });
    return { cattleId: cow.id, healthCaseId: healthCase.id };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = ownerUser.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('an active SafetyWithdrawal marks the cow quarantined, until the later of milk/meat dates', async () => {
    const { cattleId, healthCaseId } = await createCowWithHealthCase();
    const milkUntil = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // +2d
    const meatUntil = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // +5d, the later one
    await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        milkWithdrawalUntil: milkUntil,
        meatWithdrawalUntil: meatUntil,
        status: 'ACTIVE',
      },
    });

    const detailRes = await request(server())
      .get(api(`/cattle/${cattleId}`))
      .set(...auth(owner));
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.isQuarantined).toBe(true);
    expect(
      new Date(detailRes.body.data.quarantineUntil as string).getTime(),
    ).toBe(meatUntil.getTime());
  });

  it('a cow with no active withdrawal is not quarantined', async () => {
    const { cattleId } = await createCowWithHealthCase();

    const detailRes = await request(server())
      .get(api(`/cattle/${cattleId}`))
      .set(...auth(owner));
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.isQuarantined).toBe(false);
    expect(detailRes.body.data.quarantineUntil).toBeNull();
  });

  it('?healthStatus=QUARANTINE lists a quarantined cow and excludes a non-quarantined one', async () => {
    const quarantined = await createCowWithHealthCase();
    await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId: quarantined.cattleId,
        healthCaseId: quarantined.healthCaseId,
        milkWithdrawalUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    });
    const notQuarantined = await createCowWithHealthCase();

    const listRes = await request(server())
      .get(api('/cattle?healthStatus=QUARANTINE'))
      .set(...auth(owner));
    expect(listRes.status).toBe(200);
    const ids = (listRes.body.data as Array<{ id: string }>).map((c) => c.id);
    expect(ids).toContain(quarantined.cattleId);
    expect(ids).not.toContain(notQuarantined.cattleId);
  });

  it('a released withdrawal no longer quarantines the cow', async () => {
    const { cattleId, healthCaseId } = await createCowWithHealthCase();
    await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        milkWithdrawalUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: 'RELEASED',
      },
    });

    const detailRes = await request(server())
      .get(api(`/cattle/${cattleId}`))
      .set(...auth(owner));
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.isQuarantined).toBe(false);
  });
});

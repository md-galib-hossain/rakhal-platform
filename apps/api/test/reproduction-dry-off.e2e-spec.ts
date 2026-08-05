import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RD-038 — dry-off recording. `DryPeriod` had zero writers anywhere in the
 * codebase; `POST /reproduction/cattle/:id/dry-off` now creates one, ends the
 * cow's active `Lactation`, and flips `Cattle.productionStatus` to `DRY` —
 * mirroring `createCalvingEvent`'s existing `MILKING` lifecycle-transition
 * pattern.
 *
 * Creates its own isolated Cattle/Lactation rows via Prisma (unique tags) to
 * avoid colliding with shared seeded data across parallel e2e workers.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Reproduction — dry-off recording (e2e)', () => {
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

  async function createMilkingCow() {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-DRYOFF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        purpose: 'MILK',
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

  it('ends the active lactation, opens a DryPeriod, and flips productionStatus to DRY', async () => {
    const { cow, lactation } = await createMilkingCow();

    const res = await request(server())
      .post(api(`/reproduction/cattle/${cow.id}/dry-off`))
      .set(...auth(owner))
      .send({ notes: 'e2e dry-off' })
      .expect(201);

    expect(res.body.data.cattleId).toBe(cow.id);
    expect(res.body.data.actualEndDate).toBeNull();
    expect(res.body.data.expectedEndDate).toBeTruthy();

    const lactationAfter = await prisma.lactation.findUniqueOrThrow({
      where: { id: lactation.id },
    });
    expect(lactationAfter.status).toBe('ENDED');
    expect(lactationAfter.endDate).not.toBeNull();

    const cattleAfter = await prisma.cattle.findUniqueOrThrow({
      where: { id: cow.id },
    });
    expect(cattleAfter.productionStatus).toBe('DRY');
  });

  it('projects expectedEndDate using the farm dry-period-target setting (default 60 days)', async () => {
    const { cow } = await createMilkingCow();
    const dryOffDate = new Date('2026-01-01T00:00:00.000Z');

    const res = await request(server())
      .post(api(`/reproduction/cattle/${cow.id}/dry-off`))
      .set(...auth(owner))
      .send({ dryOffDate: dryOffDate.toISOString() })
      .expect(201);

    const expected = new Date(res.body.data.expectedEndDate);
    const diffDays = Math.round(
      (expected.getTime() - dryOffDate.getTime()) / 86_400_000,
    );
    expect(diffDays).toBe(60);
  });

  it('RAKHAL-274: persists the optional structured reason when supplied', async () => {
    const { cow } = await createMilkingCow();

    const res = await request(server())
      .post(api(`/reproduction/cattle/${cow.id}/dry-off`))
      .set(...auth(owner))
      .send({ notes: 'low yield', reason: 'LOW_PRODUCTION' })
      .expect(201);

    expect(res.body.data.reason).toBe('LOW_PRODUCTION');
  });

  it('RAKHAL-274: reason stays null when omitted', async () => {
    const { cow } = await createMilkingCow();

    const res = await request(server())
      .post(api(`/reproduction/cattle/${cow.id}/dry-off`))
      .set(...auth(owner))
      .send({ notes: 'no reason given' })
      .expect(201);

    expect(res.body.data.reason).toBeNull();
  });

  it('400s when the cow has no active lactation', async () => {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-DRYOFF-NOLAC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        purpose: 'MILK',
        createdBy: ownerUserId,
      },
    });

    await request(server())
      .post(api(`/reproduction/cattle/${cow.id}/dry-off`))
      .set(...auth(owner))
      .send({})
      .expect(400);
  });

  it('400s on a second dry-off while one is already open', async () => {
    const { cow } = await createMilkingCow();

    await request(server())
      .post(api(`/reproduction/cattle/${cow.id}/dry-off`))
      .set(...auth(owner))
      .send({})
      .expect(201);

    await request(server())
      .post(api(`/reproduction/cattle/${cow.id}/dry-off`))
      .set(...auth(owner))
      .send({})
      .expect(400);
  });
});

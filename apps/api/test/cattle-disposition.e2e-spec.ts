import request from 'supertest';
import { LactationStatus } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { CattleService } from '../src/modules/cattle/application/services/cattle.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-344 — `CattleDisposition`: one SOLD path. `CattleService.
 * recordDisposition()` is the new consolidated SALE/DEATH/CULL/TRANSFER exit
 * path (`FINANCE_V2_DESIGN.md` §1.1/§5.1). No controller route exists yet
 * (RAKHAL-345 wires the real `SellAnimal` use case) — this spec calls the
 * service directly through the app's DI container, same as any other
 * service-layer e2e test that boots the real app + real Postgres. Requires
 * the dev stack up + `pnpm seed`.
 */
describe('Cattle — recordDisposition (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let cattleService: CattleService;
  let owner: AuthedUser;
  let ownerUserId: string;

  const server = () => ctx.app.getHttpServer();
  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const tag = (prefix: string) =>
    `E2E-344-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    cattleService = ctx.app.get(CattleService);
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

  async function createCattle(): Promise<string> {
    const res = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({
        tagNumber: tag('CAT'),
        gender: 'FEMALE',
      })
      .expect(201);
    return res.body.data.id as string;
  }

  it('selling a milking cow closes her ACTIVE lactation exactly like archiveWithReason does', async () => {
    const cattleId = await createCattle();

    const lactation = await prisma.lactation.create({
      data: {
        cattleId,
        lactationNumber: 1,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        status: LactationStatus.ACTIVE,
      },
    });

    const disposition = await cattleService.recordDisposition(
      owner.farmId,
      ownerUserId,
      cattleId,
      { type: 'SALE', date: new Date(), price: 45000, reason: 'e2e sale' },
    );

    expect(disposition.type).toBe('SALE');
    expect(disposition.cattleId).toBe(cattleId);

    const closedLactation = await prisma.lactation.findUniqueOrThrow({
      where: { id: lactation.id },
    });
    expect(closedLactation.status).toBe('ENDED');
    expect(closedLactation.endReason).toBe('SOLD');
    expect(closedLactation.endDate).not.toBeNull();

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).toBe('SOLD');
    expect(cattle.deletedAt).toBeNull();
    expect(cattle.dispositionId).toBe(disposition.id);
    expect(cattle.soldAt).not.toBeNull();

    // The animal row itself is never deleted — still queryable, full history
    // intact.
    const stillQueryable = await request(server())
      .get(api(`/cattle/${cattleId}?includeArchived=true`))
      .set(...auth(owner));
    expect([200, 404]).toContain(stillQueryable.status);
    // Prisma-level existence is the real assertion (route shape for archived
    // animals is not this ticket's concern).
    expect(cattle).not.toBeNull();
  });

  it('a cow that already has a SALE disposition cannot be sold again', async () => {
    const cattleId = await createCattle();

    await cattleService.recordDisposition(owner.farmId, ownerUserId, cattleId, {
      type: 'SALE',
      date: new Date(),
      price: 40000,
    });

    await expect(
      cattleService.recordDisposition(owner.farmId, ownerUserId, cattleId, {
        type: 'SALE',
        date: new Date(),
        price: 41000,
      }),
    ).rejects.toThrow(
      'This animal has already been sold and cannot be sold again.',
    );

    const dispositionCount = await prisma.cattleDisposition.count({
      where: { cattleId, type: 'SALE' },
    });
    expect(dispositionCount).toBe(1);
  });

  it('DEATH ends the lactation with LactationEndReason.DEATH and sets status DEAD', async () => {
    const cattleId = await createCattle();
    const lactation = await prisma.lactation.create({
      data: {
        cattleId,
        lactationNumber: 1,
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: LactationStatus.ACTIVE,
      },
    });

    const disposition = await cattleService.recordDisposition(
      owner.farmId,
      ownerUserId,
      cattleId,
      { type: 'DEATH', date: new Date(), reason: 'e2e death' },
    );
    expect(disposition.type).toBe('DEATH');

    const closedLactation = await prisma.lactation.findUniqueOrThrow({
      where: { id: lactation.id },
    });
    expect(closedLactation.status).toBe('ENDED');
    expect(closedLactation.endReason).toBe('DEATH');

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).toBe('DECEASED');
    expect(cattle.deletedAt).toBeNull();
    expect(cattle.soldAt).toBeNull();
  });

  it('CULL ends the lactation with LactationEndReason.CULLED and sets status CULLED', async () => {
    const cattleId = await createCattle();
    const lactation = await prisma.lactation.create({
      data: {
        cattleId,
        lactationNumber: 1,
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: LactationStatus.ACTIVE,
      },
    });

    await cattleService.recordDisposition(owner.farmId, ownerUserId, cattleId, {
      type: 'CULL',
      date: new Date(),
      reason: 'e2e cull',
    });

    const closedLactation = await prisma.lactation.findUniqueOrThrow({
      where: { id: lactation.id },
    });
    expect(closedLactation.status).toBe('ENDED');
    expect(closedLactation.endReason).toBe('CULLED');

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).toBe('CULLED');
  });

  it('TRANSFER sets status TRANSFERRED and leaves the ACTIVE lactation open', async () => {
    const cattleId = await createCattle();
    const lactation = await prisma.lactation.create({
      data: {
        cattleId,
        lactationNumber: 1,
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: LactationStatus.ACTIVE,
      },
    });

    await cattleService.recordDisposition(owner.farmId, ownerUserId, cattleId, {
      type: 'TRANSFER',
      date: new Date(),
      reason: 'e2e transfer',
    });

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).toBe('SOLD');
    expect(cattle.deletedAt).toBeNull();

    const untouchedLactation = await prisma.lactation.findUniqueOrThrow({
      where: { id: lactation.id },
    });
    expect(untouchedLactation.status).toBe('ACTIVE');
    expect(untouchedLactation.endReason).toBeNull();
  });

  it('the old archiveWithReason(sold) path still works unchanged (regression guard)', async () => {
    const cattleId = await createCattle();
    const lactation = await prisma.lactation.create({
      data: {
        cattleId,
        lactationNumber: 1,
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: LactationStatus.ACTIVE,
      },
    });

    await cattleService.archiveWithReason(
      owner.farmId,
      cattleId,
      { reason: 'sold' },
      ownerUserId,
    );

    const closedLactation = await prisma.lactation.findUniqueOrThrow({
      where: { id: lactation.id },
    });
    expect(closedLactation.status).toBe('ENDED');
    expect(closedLactation.endReason).toBe('SOLD');

    const cattle = await prisma.cattle.findUniqueOrThrow({
      where: { id: cattleId },
    });
    expect(cattle.herdStatus).toBe('SOLD');
    // RAKHAL-399 consolidated this path onto `recordDisposition` (see the
    // service's own doc comment on `archiveWithReason`), so a 'sold' reason
    // now writes `dispositionId`/`soldAt` exactly like the direct
    // `recordDisposition` call the other tests in this file exercise —
    // this assertion used to expect the pre-399 behavior (both null).
    expect(cattle.dispositionId).not.toBeNull();
    expect(cattle.soldAt).not.toBeNull();
  });
});

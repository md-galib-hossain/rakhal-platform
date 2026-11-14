/* eslint-disable @typescript-eslint/no-unsafe-argument */
import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-482: the stored reproduction state follows the fold over event
 * headers, recomputed inside the write transaction. Requires dev stack + seed.
 */
describe('Reproduction fold through POST /cattle/:id/events (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let userId: string;
  const run = Date.now();
  const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const post = (cattleId: string, body: object) =>
    request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/cattle/${cattleId}/events`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(body);
  const cow = (key: string) =>
    prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-482-${key}-${run}`,
        gender: 'FEMALE',
        dateOfBirth: new Date(Date.now() - 1500 * 86400000),
        createdBy: userId,
      },
    });
  const profile = (id: string) =>
    prisma.reproductionProfile.findUniqueOrThrow({ where: { cattleId: id } });

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    userId = (
      await prisma.user.findFirstOrThrow({
        where: { email: 'owner@demo.rakhal.test' },
        select: { id: true },
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('pregnant with no AI: PREGNANT, conception UNKNOWN when nothing dates it', async () => {
    const c = await cow('NOAI');
    await post(c.id, {
      type: 'PREG_CHECK',
      eventAt: day(2),
      payload: {},
    }).expect(201);
    expect((await profile(c.id)).reproductiveStatus).toBe('PREGNANT');
    const p = await prisma.pregnancy.findFirstOrThrow({
      where: { cattleId: c.id },
    });
    expect(p.conceptionDate).toBeNull();
    expect(p.conceptionConfidence).toBe('UNKNOWN');
  });

  it('pregnant with a gestation day: conception ESTIMATED', async () => {
    const c = await cow('GD');
    await post(c.id, {
      type: 'PREG_CHECK',
      eventAt: day(2),
      payload: { gestationDay: 90 },
    }).expect(201);
    const p = await prisma.pregnancy.findFirstOrThrow({
      where: { cattleId: c.id },
    });
    expect(p.conceptionConfidence).toBe('ESTIMATED');
    expect(p.conceptionDate).not.toBeNull();
  });

  it('history last AI: bred and waiting for a check', async () => {
    const c = await cow('HAI');
    await post(c.id, {
      type: 'BREEDING',
      eventAt: day(40),
      payload: { breedingMethod: 'AI', serviceCost: 400 },
    }).expect(201);
    expect((await profile(c.id)).reproductiveStatus).toBe(
      'BRED_AWAITING_CONFIRMATION',
    );
  });

  it('walkthrough E: a calving entered late closes the pregnancy in date order', async () => {
    const c = await cow('LATE');
    await post(c.id, {
      type: 'BREEDING',
      eventAt: day(300),
      payload: { breedingMethod: 'NATURAL', sireNameOrCode: 'B' },
    }).expect(201);
    await post(c.id, {
      type: 'PREG_CHECK',
      eventAt: day(260),
      payload: {},
    }).expect(201);
    expect((await profile(c.id)).reproductiveStatus).toBe('PREGNANT');
    await post(c.id, {
      type: 'CALVING',
      eventAt: day(20),
      payload: {
        calvingEase: 'NORMAL',
        calves: [
          {
            gender: 'FEMALE',
            status: 'ALIVE',
            tagNumber: `E2E-482-CALF-${run}`,
          },
        ],
      },
    }).expect(201);
    const pr = await profile(c.id);
    expect(pr.reproductiveStatus).not.toBe('PREGNANT');
    expect(pr.lastCalvingDate!.getTime()).toBeLessThan(
      Date.now() - 19 * 86400000,
    );
  });
});

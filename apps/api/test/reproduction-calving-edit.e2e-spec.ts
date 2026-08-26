import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-306 — Edit calving: calvingDate cascade (Lactation.startDate, each
 * calf's dateOfBirth, Pregnancy.gestationDays, colostrum + calf-care tasks)
 * and calf list add/remove (archive-not-delete, AQR reversal, 409 on a calf
 * with her own records). Requires the dev stack up + `pnpm seed`.
 */
describe('Reproduction — edit calving (e2e)', () => {
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
  const tag = (prefix: string) =>
    `E2E-306-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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
        tagNumber: tag(prefix),
        gender: 'FEMALE',
        purpose: 'MILK',
        createdBy: ownerUserId,
      },
    });
  }

  it('calvingDate change cascades to Lactation.startDate, calf dateOfBirth, and shifts the colostrum task by the same delta', async () => {
    const cow = await createCow('DATE-CASCADE');
    const originalDate = new Date('2026-06-01T00:00:00.000Z');

    const calvingRes = await request(server())
      .post(api('/reproduction/calving-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        calvingDate: originalDate.toISOString(),
        calvingEase: 'NORMAL',
        calves: [
          { gender: 'FEMALE', tagNumber: tag('CALF1'), status: 'ALIVE' },
        ],
      })
      .expect(201);
    const calvingEventId = calvingRes.body.data.id;
    const calfId = calvingRes.body.data.calfBirths[0].calfId as string;

    const colostrumBefore = await prisma.task.findFirstOrThrow({
      where: {
        sourceEventType: 'CALVING_EVENT',
        sourceEventId: calvingEventId,
      },
      orderBy: { dueAt: 'asc' },
    });

    const newDate = new Date('2026-06-05T00:00:00.000Z');
    await request(server())
      .patch(api(`/reproduction/calving-events/${calvingEventId}`))
      .set(...auth(owner))
      .send({ calvingDate: newDate.toISOString() })
      .expect(200);

    const lactation = await prisma.lactation.findFirstOrThrow({
      where: { calvingEventId },
    });
    expect(lactation.startDate.toISOString()).toBe(newDate.toISOString());

    const calf = await prisma.cattle.findUniqueOrThrow({
      where: { id: calfId },
    });
    expect(calf.dateOfBirth?.toISOString()).toBe(newDate.toISOString());

    const colostrumAfter = await prisma.task.findUniqueOrThrow({
      where: { id: colostrumBefore.id },
    });
    const deltaMs = newDate.getTime() - originalDate.getTime();
    expect(colostrumAfter.dueAt.getTime()).toBe(
      colostrumBefore.dueAt.getTime() + deltaMs,
    );
  });

  it('adding a calf creates Cattle + CalfBirth and applies AQR +50', async () => {
    const cow = await createCow('ADD-CALF');
    const calvingRes = await request(server())
      .post(api('/reproduction/calving-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        calvingDate: new Date().toISOString(),
        calvingEase: 'NORMAL',
      })
      .expect(201);
    const calvingEventId = calvingRes.body.data.id;
    const newCalfTag = tag('NEWCALF');

    const res = await request(server())
      .patch(api(`/reproduction/calving-events/${calvingEventId}`))
      .set(...auth(owner))
      .send({
        addCalves: [{ gender: 'MALE', tagNumber: newCalfTag, status: 'ALIVE' }],
      })
      .expect(200);

    expect(res.body.data.calfCount).toBe(1);
    const calf = await prisma.cattle.findFirstOrThrow({
      where: { tagNumber: newCalfTag },
    });
    expect(calf.motherId).toBe(cow.id);
    expect(calf.aqrScore).toBe(50);
  });

  it('removing a calf archives its Cattle row (never deletes) and reverses AQR', async () => {
    const cow = await createCow('REMOVE-CALF');
    const calfTag = tag('REMOVED');
    const calvingRes = await request(server())
      .post(api('/reproduction/calving-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        calvingDate: new Date().toISOString(),
        calvingEase: 'NORMAL',
        calves: [{ gender: 'FEMALE', tagNumber: calfTag, status: 'ALIVE' }],
      })
      .expect(201);
    const calvingEventId = calvingRes.body.data.id;
    const calfBirthId = calvingRes.body.data.calfBirths[0].id as string;
    const calfId = calvingRes.body.data.calfBirths[0].calfId as string;

    const beforeRemove = await prisma.cattle.findUniqueOrThrow({
      where: { id: calfId },
    });
    expect(beforeRemove.aqrScore).toBe(50);

    const res = await request(server())
      .patch(api(`/reproduction/calving-events/${calvingEventId}`))
      .set(...auth(owner))
      .send({ removeCalfBirthIds: [calfBirthId] })
      .expect(200);

    expect(res.body.data.calfCount).toBe(0);
    const calf = await prisma.cattle.findUniqueOrThrow({
      where: { id: calfId },
    });
    expect(calf.deletedAt).not.toBeNull();
    expect(calf.herdStatus).toBe('ACTIVE');
    expect(calf.aqrScore).toBe(0);

    const stillExists = await prisma.calfBirth.findUnique({
      where: { id: calfBirthId },
    });
    expect(stillExists).toBeNull();
  });

  it('409s naming the tag number when removing a calf that has her own records', async () => {
    const cow = await createCow('DIRTY-CALF');
    const calfTag = tag('DIRTY');
    const calvingRes = await request(server())
      .post(api('/reproduction/calving-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        calvingDate: new Date().toISOString(),
        calvingEase: 'NORMAL',
        calves: [{ gender: 'FEMALE', tagNumber: calfTag, status: 'ALIVE' }],
      })
      .expect(201);
    const calvingEventId = calvingRes.body.data.id;
    const calfBirthId = calvingRes.body.data.calfBirths[0].id as string;
    const calfId = calvingRes.body.data.calfBirths[0].calfId as string;

    await prisma.weightRecord.create({
      data: { cattleId: calfId, weightKg: 35, recordedDate: new Date() },
    });

    const res = await request(server())
      .patch(api(`/reproduction/calving-events/${calvingEventId}`))
      .set(...auth(owner))
      .send({ removeCalfBirthIds: [calfBirthId] })
      .expect(409);

    expect(res.body.message).toContain(calfTag);

    const calf = await prisma.cattle.findUniqueOrThrow({
      where: { id: calfId },
    });
    expect(calf.deletedAt).toBeNull();
  });
});

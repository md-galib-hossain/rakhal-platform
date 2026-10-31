/* eslint-disable @typescript-eslint/no-unsafe-argument */
import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-488: edit and void any event. Requires dev stack + `pnpm seed`.
 */
describe('Edit and void events (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let userId: string;
  const run = Date.now();
  const api = (p: string) => `${ctx.prefix}${p}`;
  const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const post = (u: AuthedUser, cattleId: string, body: object) =>
    request(ctx.app.getHttpServer())
      .post(api(`/cattle/${cattleId}/events`))
      .set('Authorization', `Bearer ${u.token}`)
      .send(body);
  const voidIt = (u: AuthedUser, cattleId: string, eventId: string) =>
    request(ctx.app.getHttpServer())
      .post(api(`/cattle/${cattleId}/events/${eventId}/void`))
      .set('Authorization', `Bearer ${u.token}`)
      .send({ reason: 'wrong cow' });
  const cow = (key: string) =>
    prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-488-${key}-${run}`,
        gender: 'FEMALE',
        dateOfBirth: new Date(Date.now() - 1500 * 86400000),
        createdBy: userId,
      },
    });
  const heat = {
    type: 'HEAT',
    eventAt: day(0.2),
    payload: { detectionMethod: 'VISUAL' },
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
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

  it('voids a header-only-reversible event (heat) and hides it from the timeline', async () => {
    const c = await cow('HEAT');
    const rec = await post(owner, c.id, heat).expect(201);
    const id = rec.body.data.event.id as string;
    const res = await voidIt(owner, c.id, id).expect(201);
    expect(res.body.data.event.status).toBe('VOIDED');
    expect(res.body.data.event.voidReason).toBe('wrong cow');
    expect(res.body.data.detailReversed).toBe(false);
    const tl = await request(ctx.app.getHttpServer())
      .get(api(`/cattle/${c.id}/events`))
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(tl.body.data).toHaveLength(0);
    await voidIt(owner, c.id, id).expect(422); // already voided
  });

  it('voiding an AI reverses it (domain void), cancels its follow-up and re-derives state', async () => {
    const c = await cow('AI');
    const rec = await post(owner, c.id, {
      type: 'BREEDING',
      eventAt: day(0.2),
      payload: { breedingMethod: 'NATURAL', sireNameOrCode: 'B' },
    }).expect(201);
    const id = rec.body.data.event.id as string;
    expect(
      (
        await prisma.reproductionProfile.findUniqueOrThrow({
          where: { cattleId: c.id },
        })
      ).reproductiveStatus,
    ).toBe('BRED_AWAITING_CONFIRMATION');
    const res = await voidIt(owner, c.id, id).expect(201);
    expect(res.body.data.detailReversed).toBe(true);
    const b = await prisma.breedingEvent.findFirstOrThrow({
      where: { cattleId: c.id },
    });
    expect(b.voidedAt).not.toBeNull();
    const tasks = await prisma.task.findMany({
      where: { relatedCattleId: c.id, ruleKey: 'BREEDING_TO_PREG_CHECK' },
    });
    expect(tasks.every((t) => t.status === 'CANCELLED')).toBe(true);
    expect(
      (
        await prisma.reproductionProfile.findUniqueOrThrow({
          where: { cattleId: c.id },
        })
      ).reproductiveStatus,
    ).not.toBe('BRED_AWAITING_CONFIRMATION');
  });

  it('voiding a vaccination voids its treatment log', async () => {
    const c = await cow('VAC');
    const rec = await post(owner, c.id, {
      type: 'VACCINATION',
      eventAt: day(0.2),
      payload: {
        medicineName: 'FMD',
        outsideInventory: true,
        doseAmount: 2,
        doseUnit: 'mL',
        route: 'SC',
      },
    }).expect(201);
    const res = await voidIt(owner, c.id, rec.body.data.event.id).expect(201);
    expect(res.body.data.detailReversed).toBe(true);
    const log = await prisma.treatmentLog.findFirstOrThrow({
      where: { cattleId: c.id },
    });
    expect(log.voidedAt).not.toBeNull();
  });

  it("Q5: a worker may void their own event, but not after 24 h and not someone else's", async () => {
    const c = await cow('Q5');
    const own = await post(worker, c.id, heat).expect(201);
    const others = await post(owner, c.id, heat).expect(201);
    await voidIt(worker, c.id, others.body.data.event.id).expect(403);
    // age the worker's event past the window
    await prisma.animalEvent.update({
      where: { id: own.body.data.event.id },
      data: { createdAt: new Date(Date.now() - 25 * 3600_000) },
    });
    const late = await voidIt(worker, c.id, own.body.data.event.id).expect(403);
    expect(late.body.details.eventCode).toBe('EVENT_EDIT_WINDOW_CLOSED');
    // the owner (manager+) can void either at any time
    await voidIt(owner, c.id, own.body.data.event.id).expect(201);
    // a fresh worker event inside the window can be voided by its author
    const fresh = await post(worker, c.id, heat).expect(201);
    await voidIt(worker, c.id, fresh.body.data.event.id).expect(201);
  });

  it('editing the date moves the typed row, the header and the follow-up; writes an audit entry', async () => {
    const c = await cow('EDIT');
    const rec = await post(owner, c.id, {
      type: 'BREEDING',
      eventAt: day(2),
      payload: { breedingMethod: 'NATURAL', sireNameOrCode: 'B' },
    }).expect(201);
    const id = rec.body.data.event.id as string;
    const before = await prisma.task.findFirstOrThrow({
      where: {
        relatedCattleId: c.id,
        ruleKey: 'BREEDING_TO_PREG_CHECK',
        status: 'PENDING',
      },
    });
    const newAt = day(5);
    const res = await request(ctx.app.getHttpServer())
      .patch(api(`/cattle/${c.id}/events/${id}`))
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ eventAt: newAt, notes: 'moved' })
      .expect(200);
    expect(new Date(res.body.data.event.eventAt).toISOString()).toBe(newAt);
    expect(res.body.data.event.notes).toBe('moved');
    const b = await prisma.breedingEvent.findFirstOrThrow({
      where: { cattleId: c.id },
    });
    expect(b.breedingDate.toISOString()).toBe(newAt);
    const old = await prisma.task.findUniqueOrThrow({
      where: { id: before.id },
    });
    expect(old.status).toBe('CANCELLED');
    const open = await prisma.task.findFirstOrThrow({
      where: {
        relatedCattleId: c.id,
        ruleKey: 'BREEDING_TO_PREG_CHECK',
        status: 'PENDING',
      },
    });
    expect(open.dueAt.getTime()).toBeLessThan(before.dueAt.getTime());
    const log = await prisma.activityLog.findFirst({
      where: { relatedCattleId: c.id, eventTitle: 'Animal event edited' },
    });
    expect(log).not.toBeNull();
  });

  it('a void needs a reason; an unknown event is 404', async () => {
    const c = await cow('BAD');
    const rec = await post(owner, c.id, heat).expect(201);
    await request(ctx.app.getHttpServer())
      .post(api(`/cattle/${c.id}/events/${rec.body.data.event.id}/void`))
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(400);
    await voidIt(owner, c.id, 'does-not-exist').expect(404);
  });
});

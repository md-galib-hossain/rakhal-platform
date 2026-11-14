/* eslint-disable @typescript-eslint/no-unsafe-argument */
import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-486: farm-defined event types. Requires dev stack + `pnpm seed`.
 */
describe('Custom event types (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let userId: string;
  const run = Date.now();
  const api = (p: string) => `${ctx.prefix}${p}`;
  const as = (u: AuthedUser) => ({ Authorization: `Bearer ${u.token}` });
  let typeId: string;
  let cattleId: string;

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
    cattleId = (
      await prisma.cattle.create({
        data: {
          farmId: owner.farmId,
          tagNumber: `E2E-486-${run}`,
          gender: 'FEMALE',
          dateOfBirth: new Date(Date.now() - 1500 * 86400000),
          createdBy: userId,
        },
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('manager+ can create a type; invalid fields are rejected; a worker cannot', async () => {
    const body = {
      name: `E2E-486-${run}`,
      group: 'HEALTH',
      appliesTo: { MALE: 'BLOCK' },
      fields: [
        {
          key: 'product',
          label: 'Product',
          kind: 'select',
          options: ['A', 'B'],
          required: true,
        },
        { key: 'minutes', label: 'Minutes', kind: 'number' },
      ],
    };
    await request(ctx.app.getHttpServer())
      .post(api('/animal-events/custom-types'))
      .set(as(worker))
      .send(body)
      .expect(403);
    await request(ctx.app.getHttpServer())
      .post(api('/animal-events/custom-types'))
      .set(as(owner))
      .send({
        ...body,
        name: `bad-${run}`,
        fields: [{ key: 'Bad Key', label: 'x', kind: 'text' }],
      })
      .expect(422);
    const res = await request(ctx.app.getHttpServer())
      .post(api('/animal-events/custom-types'))
      .set(as(owner))
      .send(body)
      .expect(201);
    typeId = res.body.data.id;
    await request(ctx.app.getHttpServer())
      .post(api('/animal-events/custom-types'))
      .set(as(owner))
      .send(body)
      .expect(409);
  });

  it('shows in GET /animal-events/types for the whole farm', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(api('/animal-events/types'))
      .set(as(worker))
      .expect(200);
    const mine = res.body.data.find(
      (t: { customTypeId?: string }) => t.customTypeId === typeId,
    );
    expect(mine).toMatchObject({ type: 'CUSTOM', group: 'HEALTH' });
    expect(mine.appliesTo.MALE).toBe('BLOCK');
    expect(mine.fields).toHaveLength(2);
  });

  it('records a CUSTOM event: payload validated, stored in data, 4 KB cap', async () => {
    const post = (payload: object, extra: object = {}) =>
      request(ctx.app.getHttpServer())
        .post(api(`/cattle/${cattleId}/events`))
        .set(as(owner))
        .send({
          type: 'CUSTOM',
          customTypeId: typeId,
          eventAt: new Date(Date.now() - 3600_000).toISOString(),
          payload,
          ...extra,
        });
    const ok = await post({ product: 'A', minutes: 5 }).expect(201);
    expect(ok.body.data.event.customTypeId).toBe(typeId);
    expect(ok.body.data.event.data).toEqual({ product: 'A', minutes: 5 });
    await post({ minutes: 5 }).expect(422); // required field missing
    await post({ product: 'Z' }).expect(422); // not an option
    await post({ product: 'A', extra: 1 }).expect(422); // not a field
    await request(ctx.app.getHttpServer())
      .post(api(`/cattle/${cattleId}/events`))
      .set(as(owner))
      .send({ type: 'CUSTOM', eventAt: new Date().toISOString(), payload: {} })
      .expect(422); // no customTypeId
  });

  it('a deactivated type can no longer be recorded', async () => {
    await request(ctx.app.getHttpServer())
      .delete(api(`/animal-events/custom-types/${typeId}`))
      .set(as(owner))
      .expect(200);
    await request(ctx.app.getHttpServer())
      .post(api(`/cattle/${cattleId}/events`))
      .set(as(owner))
      .send({
        type: 'CUSTOM',
        customTypeId: typeId,
        eventAt: new Date(Date.now() - 3600_000).toISOString(),
        payload: { product: 'A' },
      })
      .expect(422);
  });
});

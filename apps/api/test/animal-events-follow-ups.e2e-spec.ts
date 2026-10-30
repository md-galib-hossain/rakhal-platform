/* eslint-disable @typescript-eslint/no-unsafe-argument */
import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { FollowUpService } from '../src/modules/animal-events/application/services/follow-up.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-484: follow-up rules engine. Requires dev stack + `pnpm seed`.
 */
describe('Follow-up rules (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let userId: string;
  const run = Date.now();
  const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const ahead = (n: number) =>
    new Date(Date.now() + n * 86400000).toISOString();
  const post = (cattleId: string, body: object, qs = '') =>
    request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/cattle/${cattleId}/events${qs}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(body);
  const cow = (key: string) =>
    prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-484-${key}-${run}`,
        gender: 'FEMALE',
        dateOfBirth: new Date(Date.now() - 1500 * 86400000),
        createdBy: userId,
      },
    });
  const tasks = (cattleId: string, ruleKey?: string) =>
    prisma.task.findMany({
      where: { relatedCattleId: cattleId, ...(ruleKey ? { ruleKey } : {}) },
    });
  const natural = {
    type: 'BREEDING',
    eventAt: day(0.1),
    payload: { breedingMethod: 'NATURAL', sireNameOrCode: 'B' },
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

  it('dry run returns the real rule output', async () => {
    const c = await cow('PREVIEW');
    const res = await post(c.id, natural, '?dryRun=true').expect(201);
    const item = res.body.data.followUpsPreview.find(
      (f: { ruleKey: string }) => f.ruleKey === 'BREEDING_TO_PREG_CHECK',
    );
    expect(item).toMatchObject({
      title: 'Pregnancy check',
      defaultOn: true,
      enabled: true,
      kind: 'TASK',
    });
    expect(new Date(item.dueDate).getTime()).toBeGreaterThan(Date.now());
    expect(await tasks(c.id)).toHaveLength(0);
  });

  it('AI makes one preg-check task (no legacy double), an early check completes it', async () => {
    const c = await cow('FLOW');
    const ai = await post(c.id, natural).expect(201);
    const t = await tasks(c.id, 'BREEDING_TO_PREG_CHECK');
    expect(t).toHaveLength(1);
    expect(t[0].followUpKey).toBe(
      `BREEDING_TO_PREG_CHECK:${ai.body.data.event.id}`,
    );
    expect(await tasks(c.id)).toHaveLength(1);
    await post(c.id, {
      type: 'PREG_CHECK',
      eventAt: day(0),
      payload: {},
    }).expect(201);
    const after = await tasks(c.id, 'BREEDING_TO_PREG_CHECK');
    expect(after[0].status).toBe('COMPLETED');
  });

  it('the client can switch one follow-up off', async () => {
    const c = await cow('OFF');
    await post(c.id, {
      ...natural,
      followUps: [{ ruleKey: 'BREEDING_TO_PREG_CHECK', enabled: false }],
    }).expect(201);
    expect(await tasks(c.id)).toHaveLength(0);
  });

  it('history and back-dated events never create a task already past due', async () => {
    const c = await cow('HIST');
    await post(c.id, { ...natural, eventAt: day(60) }).expect(201);
    expect(await tasks(c.id)).toHaveLength(0);
  });

  it('a positive check with an expected calving date creates dry-off and calving-watch', async () => {
    const c = await cow('POS');
    await post(c.id, {
      type: 'PREG_CHECK',
      eventAt: day(0.1),
      payload: { expectedCalvingDate: ahead(220) },
    }).expect(201);
    const keys = (await tasks(c.id)).map((t) => t.ruleKey).sort();
    expect(keys).toEqual([
      'PREG_POSITIVE_TO_CALVING_WATCH',
      'PREG_POSITIVE_TO_DRY_OFF',
    ]);
  });

  it('voiding the source event cancels its open follow-ups', async () => {
    const c = await cow('VOID');
    const ai = await post(c.id, natural).expect(201);
    const cancelled = await ctx.app
      .get(FollowUpService)
      .cancelForEvent(ai.body.data.event.id);
    expect(cancelled).toBe(1);
    expect((await tasks(c.id))[0].status).toBe('CANCELLED');
  });

  it('a partial unique index stops two open follow-ups with the same key (race)', async () => {
    const c = await cow('RACE');
    const key = `RACE:${run}`;
    const make = (n: number) =>
      prisma.task.create({
        data: {
          farmId: owner.farmId,
          reference: `E2E-RACE-${run}-${n}`,
          name: 'race',
          category: 'BREEDING',
          priority: 'MEDIUM',
          dueAt: new Date(Date.now() + 86400000),
          source: 'SYSTEM_AUTO',
          relatedCattleId: c.id,
          followUpKey: key,
          ruleKey: 'BREEDING_TO_PREG_CHECK',
          createdBy: userId,
        },
      });
    const results = await Promise.allSettled([make(1), make(2)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.task.count({ where: { followUpKey: key } })).toBe(1);
  });

  it('GET/PUT /settings/follow-up-rules: a farm can switch a rule off', async () => {
    const api = (p: string) => `${ctx.prefix}${p}`;
    const off = await request(ctx.app.getHttpServer())
      .put(api('/settings/follow-up-rules'))
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ rules: [{ ruleKey: 'BREEDING_TO_PREG_CHECK', enabled: false }] })
      .expect(200);
    const rule = off.body.data.find(
      (r: { ruleKey: string }) => r.ruleKey === 'BREEDING_TO_PREG_CHECK',
    );
    expect(rule.enabled).toBe(false);
    const c = await cow('FARMOFF');
    await post(c.id, natural).expect(201);
    expect(await tasks(c.id)).toHaveLength(0);
    await request(ctx.app.getHttpServer())
      .put(api('/settings/follow-up-rules'))
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ rules: [{ ruleKey: 'BREEDING_TO_PREG_CHECK', enabled: true }] })
      .expect(200);
    await request(ctx.app.getHttpServer())
      .put(api('/settings/follow-up-rules'))
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ rules: [{ ruleKey: 'BREEDING_TO_PREG_CHECK', enabled: false }] })
      .expect(403);
  });
});

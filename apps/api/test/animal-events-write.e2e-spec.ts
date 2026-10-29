/* eslint-disable @typescript-eslint/no-unsafe-argument */
import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-481: POST /cattle/:id/events (write API + dry run + findings).
 * Requires dev stack + `pnpm seed`.
 */
describe('POST /cattle/:id/events (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let userId: string;
  const run = Date.now();
  const api = (p: string) => `${ctx.prefix}${p}`;
  const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

  const post = (
    u: AuthedUser,
    cattleId: string,
    body: object,
    qs = '',
    headers: Record<string, string> = {},
  ) => {
    const r = request(ctx.app.getHttpServer())
      .post(api(`/cattle/${cattleId}/events${qs}`))
      .set('Authorization', `Bearer ${u.token}`);
    for (const [k, v] of Object.entries(headers)) r.set(k, v);
    return r.send(body);
  };

  async function cow(key: string, gender: 'FEMALE' | 'MALE' = 'FEMALE') {
    return prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-481-${key}-${run}`,
        gender,
        dateOfBirth: new Date(Date.now() - 1500 * 86400000),
        createdBy: userId,
      },
    });
  }

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

  it('preg check with no AI: 201 + PREG_CHECK_NO_BREEDING, conception is not the check date, one header', async () => {
    const c = await cow('PC');
    const checkAt = day(2);
    const res = await post(owner, c.id, {
      type: 'PREG_CHECK',
      eventAt: checkAt,
      payload: { gestationDay: 90 },
    }).expect(201);
    expect(
      res.body.data.findings.map((f: { code: string }) => f.code),
    ).toContain('PREG_CHECK_NO_BREEDING');
    expect(res.body.data.event.provenance).toBe('RECORDED');
    expect(res.body.data.event.findings[0].code).toBe('PREG_CHECK_NO_BREEDING');
    const p = await prisma.pregnancy.findFirstOrThrow({
      where: { cattleId: c.id },
    });
    expect(p.conceptionDate.getTime()).not.toBe(new Date(checkAt).getTime());
    expect(
      Math.round(
        (new Date(checkAt).getTime() - p.conceptionDate.getTime()) / 86400000,
      ),
    ).toBe(90);
    expect(
      await prisma.animalEvent.count({
        where: { cattleId: c.id, type: 'PREG_CHECK' },
      }),
    ).toBe(1);
  });

  it('heat and AI on a pregnant cow save with warnings', async () => {
    const c = await cow('PREG');
    await post(owner, c.id, {
      type: 'PREG_CHECK',
      eventAt: day(2),
      payload: { gestationDay: 60 },
    }).expect(201);
    const heat = await post(owner, c.id, {
      type: 'HEAT',
      eventAt: day(1),
      payload: { detectionMethod: 'VISUAL' },
    }).expect(201);
    expect(
      heat.body.data.findings.map((f: { code: string }) => f.code),
    ).toContain('HEAT_WHILE_PREGNANT');
    const ai = await post(owner, c.id, {
      type: 'BREEDING',
      eventAt: day(1),
      payload: { breedingMethod: 'NATURAL', sireNameOrCode: 'BULL-X' },
    }).expect(201);
    expect(
      ai.body.data.findings.map((f: { code: string }) => f.code),
    ).toContain('BREEDING_WHILE_PREGNANT');
  });

  it('dry off with no lactation saves with DRY_OFF_NO_LACTATION', async () => {
    const c = await cow('DRY');
    const res = await post(owner, c.id, {
      type: 'DRY_OFF',
      eventAt: day(1),
      payload: {},
    }).expect(201);
    expect(
      res.body.data.findings.map((f: { code: string }) => f.code),
    ).toContain('DRY_OFF_NO_LACTATION');
  });

  it('blocks only the impossible: calving on a male and a future date are 422', async () => {
    const bull = await cow('BULL', 'MALE');
    const r1 = await post(owner, bull.id, {
      type: 'CALVING',
      eventAt: day(1),
      payload: {},
    }).expect(422);
    expect(r1.body.details.eventCode).toBe('EVENT_WRONG_SEX');
    const c = await cow('FUT');
    const r2 = await post(owner, c.id, {
      type: 'WEIGHT',
      eventAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      payload: { weightKg: 300 },
    }).expect(422);
    expect(r2.body.details.eventCode).toBe('EVENT_DATE_IN_FUTURE');
  });

  it('dry run returns findings and writes nothing', async () => {
    const c = await cow('DRYRUN');
    const before = await prisma.animalEvent.count({
      where: { cattleId: c.id },
    });
    const res = await post(
      owner,
      c.id,
      { type: 'HEAT', eventAt: day(1), payload: { detectionMethod: 'VISUAL' } },
      '?dryRun=true',
    ).expect(201);
    expect(res.body.data.dryRun).toBe(true);
    expect(res.body.data.blocked).toBe(false);
    expect(Array.isArray(res.body.data.followUpsPreview)).toBe(true);
    expect(await prisma.animalEvent.count({ where: { cattleId: c.id } })).toBe(
      before,
    );
    expect(await prisma.heatEvent.count({ where: { cattleId: c.id } })).toBe(0);
  });

  it('Idempotency-Key replay returns the first response, one header', async () => {
    const c = await cow('IDEM');
    const body = {
      type: 'HEAT',
      eventAt: day(1),
      payload: { detectionMethod: 'VISUAL' },
    };
    const key = `e2e-481-${run}`;
    const a = await post(owner, c.id, body, '', {
      'Idempotency-Key': key,
    }).expect(201);
    const b = await post(owner, c.id, body, '', {
      'Idempotency-Key': key,
    }).expect(201);
    expect(b.body.data.event.id).toBe(a.body.data.event.id);
    expect(
      await prisma.animalEvent.count({
        where: { cattleId: c.id, type: 'HEAT' },
      }),
    ).toBe(1);
  });

  it('history entries (older than 7 days) default to HISTORICAL; AI cost is info only', async () => {
    const c = await cow('HIST');
    const res = await post(owner, c.id, {
      type: 'BREEDING',
      eventAt: day(40),
      payload: {
        breedingMethod: 'AI',
        serviceCost: 450,
        sireNameOrCode: 'S-1',
      },
    }).expect(201);
    expect(res.body.data.event.provenance).toBe('HISTORICAL');
    expect(res.body.data.event.data.historyCost).toBe(450);
    const b = await prisma.breedingEvent.findFirstOrThrow({
      where: { cattleId: c.id },
    });
    expect(Number(b.serviceCost ?? 0)).toBe(0);
    expect(b.financeTransactionId ?? null).toBeNull();
  });

  it('fattening and notes are header-only events', async () => {
    const c = await cow('FAT');
    await post(owner, c.id, {
      type: 'ENTER_FATTENING',
      eventAt: day(1),
    }).expect(201);
    await post(owner, c.id, {
      type: 'NOTE',
      eventAt: day(0.5),
      payload: { text: 'limping' },
    }).expect(201);
    expect(
      await prisma.animalEvent.count({
        where: { cattleId: c.id, type: 'ENTER_FATTENING' },
      }),
    ).toBe(1);
  });

  it('worker can record heat but not AI', async () => {
    const c = await cow('WRK');
    await post(worker, c.id, {
      type: 'HEAT',
      eventAt: day(0.2),
      payload: { detectionMethod: 'VISUAL' },
    }).expect(201);
    await post(worker, c.id, {
      type: 'BREEDING',
      eventAt: day(0.1),
      payload: { breedingMethod: 'NATURAL', sireNameOrCode: 'B' },
    }).expect(403);
  });
});

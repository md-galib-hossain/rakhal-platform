/* eslint-disable @typescript-eslint/no-unsafe-argument */
import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { EligibilityService } from '../src/modules/animal-events/application/services/eligibility.service';
import {
  AnimalFacts,
  CATEGORY_RULES,
  CATTLE_CATEGORIES,
} from '../src/modules/animal-events/domain/eligibility/categories';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-480: one table drives `matches()` and the Prisma `where`; they must
 * agree for every category on seeded animals. Also `GET /cattle?category=` and
 * `GET /cattle/:id/events/eligible`. Requires dev stack + `pnpm seed`.
 */
describe('Eligibility engine + categories (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let userId: string;
  const ids: Record<string, string> = {};
  const run = Date.now();
  const api = (p: string) => `${ctx.prefix}${p}`;
  const dayAgo = (d: number) => new Date(Date.now() - d * 86400000);

  async function animal(
    key: string,
    o: {
      gender?: 'MALE' | 'FEMALE' | 'CASTRATED_MALE';
      ageDays: number;
      calvings?: number | null;
      state?: 'OPEN' | 'PREGNANT' | 'POSTPARTUM_WAITING';
      production?: 'MILKING' | 'DRY';
      lactationDays?: number;
    },
  ) {
    const c = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-480-${key}-${run}`,
        gender: o.gender ?? 'FEMALE',
        dateOfBirth: dayAgo(o.ageDays),
        productionStatus: o.production ?? null,
        createdBy: userId,
      },
    });
    ids[key] = c.id;
    if (o.calvings !== null && o.calvings !== undefined) {
      await prisma.reproductionProfile.create({
        data: {
          cattleId: c.id,
          totalCalvings: o.calvings,
          reproductiveStatus: o.state ?? 'OPEN',
        },
      });
    }
    if (o.lactationDays !== undefined) {
      await prisma.lactation.create({
        data: {
          cattleId: c.id,
          lactationNumber: 1,
          startDate: dayAgo(o.lactationDays),
          status: 'ACTIVE',
        },
      });
    }
    return c;
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

    await animal('calf', { ageDays: 20 });
    await animal('weanedHeifer', { ageDays: 200 });
    await animal('heifer', { ageDays: 600, calvings: 0, state: 'OPEN' });
    await animal('pregDryCow', {
      ageDays: 1500,
      calvings: 2,
      state: 'PREGNANT',
      production: 'DRY',
    });
    await animal('freshCow', {
      ageDays: 1500,
      calvings: 1,
      state: 'POSTPARTUM_WAITING',
      production: 'MILKING',
      lactationDays: 5,
    });
    await animal('midCow', {
      ageDays: 1800,
      calvings: 3,
      state: 'OPEN',
      production: 'MILKING',
      lactationDays: 120,
    });
    await animal('bull', { gender: 'MALE', ageDays: 1000 });
    await animal('steer', { gender: 'CASTRATED_MALE', ageDays: 800 });
    await animal('fatBull', { gender: 'MALE', ageDays: 700 });
    await animal('leftBull', { gender: 'MALE', ageDays: 700 });
    await prisma.animalEvent.create({
      data: {
        farmId: owner.farmId,
        cattleId: ids.fatBull,
        type: 'ENTER_FATTENING',
        eventAt: dayAgo(30),
        recordedById: userId,
      },
    });
    await prisma.animalEvent.create({
      data: {
        farmId: owner.farmId,
        cattleId: ids.leftBull,
        type: 'ENTER_FATTENING',
        eventAt: dayAgo(60),
        recordedById: userId,
      },
    });
    await prisma.animalEvent.create({
      data: {
        farmId: owner.farmId,
        cattleId: ids.leftBull,
        type: 'LEAVE_FATTENING',
        eventAt: dayAgo(10),
        recordedById: userId,
      },
    });
  }, 90_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('property: matches() and where() agree for every category on seeded animals', async () => {
    const svc = ctx.app.get(EligibilityService);
    const cctx = await svc.context(owner.farmId, { withFattening: true });
    const seeded = Object.values(ids);
    const rows = await prisma.cattle.findMany({
      where: { id: { in: seeded } },
      select: {
        id: true,
        gender: true,
        dateOfBirth: true,
        productionStatus: true,
        reproductionProfile: {
          select: { totalCalvings: true, reproductiveStatus: true },
        },
        lactations: {
          where: { status: 'ACTIVE' },
          select: { startDate: true },
          take: 1,
        },
      },
    });
    const factsOf = (r: (typeof rows)[number]): AnimalFacts => ({
      gender: r.gender,
      dateOfBirth: r.dateOfBirth,
      totalCalvings: r.reproductionProfile?.totalCalvings ?? 0,
      productionStatus: r.productionStatus,
      reproductiveStatus: r.reproductionProfile?.reproductiveStatus ?? null,
      activeLactationStart: r.lactations[0]?.startDate ?? null,
      inFattening: (cctx.fatteningCattleIds ?? []).includes(r.id),
    });
    for (const cat of CATTLE_CATEGORIES) {
      const byMatches = rows
        .filter((r) => CATEGORY_RULES[cat].matches(factsOf(r), cctx))
        .map((r) => r.id)
        .sort();
      const byWhere = (
        await prisma.cattle.findMany({
          where: {
            AND: [{ id: { in: seeded } }, CATEGORY_RULES[cat].where(cctx)],
          },
          select: { id: true },
        })
      )
        .map((r) => r.id)
        .sort();
      expect({ cat, ids: byWhere }).toEqual({ cat, ids: byMatches });
    }
  });

  async function listIds(category: string) {
    const res = await request(ctx.app.getHttpServer())
      .get(api(`/cattle?category=${category}&limit=100&search=${run}`))
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    return (res.body.data as { id: string }[]).map((r) => r.id);
  }

  it('GET /cattle?category= filters by chip (all 13 accepted)', async () => {
    for (const c of CATTLE_CATEGORIES) await listIds(c.toLowerCase());
    expect(await listIds('calf')).toEqual([ids.calf]);
    expect(await listIds('fattening')).toEqual([ids.fatBull]);
    expect((await listIds('fresh')).sort()).toEqual([ids.freshCow]);
    expect((await listIds('dry')).sort()).toEqual([ids.pregDryCow]);
    expect((await listIds('pregnant')).sort()).toEqual([ids.pregDryCow]);
    expect((await listIds('open')).sort()).toEqual(
      [ids.heifer, ids.freshCow, ids.midCow].sort(),
    );
    expect((await listIds('weaned')).sort()).toEqual([ids.weanedHeifer].sort());
    expect((await listIds('male')).sort()).toEqual(
      [ids.bull, ids.steer, ids.fatBull, ids.leftBull].sort(),
    );
    await request(ctx.app.getHttpServer())
      .get(api('/cattle?category=bogus'))
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(400);
  });

  it('GET /cattle/:id/events/eligible reflects the animal (worker can read)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(api(`/cattle/${ids.pregDryCow}/events/eligible`))
      .set('Authorization', `Bearer ${worker.token}`)
      .expect(200);
    const by = (t: string) =>
      res.body.data.types.find((x: { type: string }) => x.type === t);
    expect(res.body.data.categories).toEqual(
      expect.arrayContaining(['COW', 'PREGNANT', 'DRY']),
    );
    expect(by('DRY_OFF').level).toBe('BLOCK');
    expect(by('HEAT').level).toBe('WARN');
    expect(by('CALVING').level).toBe('LISTED');
    expect(by('CASTRATION').eligible).toBe(false);

    const bull = await request(ctx.app.getHttpServer())
      .get(api(`/cattle/${ids.fatBull}/events/eligible`))
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const bt = (t: string) =>
      bull.body.data.types.find((x: { type: string }) => x.type === t);
    expect(bt('LEAVE_FATTENING').eligible).toBe(true);
    expect(bt('ENTER_FATTENING').eligible).toBe(false);
    expect(bt('HEAT').eligible).toBe(false);

    await request(ctx.app.getHttpServer())
      .get(api(`/cattle/${ids.pregDryCow}/events/eligible?date=2099-01-01`))
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200)
      .expect((r) => {
        const w = r.body.data.types.find(
          (x: { type: string }) => x.type === 'WEIGHT',
        );
        expect(w.findings.map((f: { code: string }) => f.code)).toContain(
          'DATE_IN_FUTURE',
        );
      });
  });
});

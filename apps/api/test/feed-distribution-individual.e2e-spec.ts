import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { concentrateDerivedIngredientId } from './utils/feed';

/**
 * Feed Formulator — Phase 12.4 (2026-07-18, no ticket #, plan `composed-pondering-teapot`):
 * `FeedDistribution` carries a `cattleId` target, so logging a feeding against an
 * INDIVIDUAL-targeted TMR records against that one cow. Covers: `POST /feed/distributions` on an
 * INDIVIDUAL TMR sets `cattleId` on the created row; `GET /feed/distributions?cattleId=` scopes
 * correctly; `GET /feed/efficiency?cattleId=` returns real adherence/cost-per-litre numbers for one
 * cow; `GET /feed/efficiency` 400s when `cattleId` is missing.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — individual-cow distribution + efficiency (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let ingredientId: string;
  /** RAKHAL-425: every TMR below needs one line using this. */
  let concentrateIngredientId: string;

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

    const created = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Individual Dist Ingredient ${Date.now()}`,
        nutrientGroup: 'ENERGY',
        pricePerKg: 12,
        dmPct: 90,
        cpPct: 14,
        meMjPerKgDm: 10,
      })
      .expect(201);
    ingredientId = created.body.data.id as string;
    concentrateIngredientId = await concentrateDerivedIngredientId(ctx, owner);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('logging a distribution against an INDIVIDUAL TMR sets cattleId', async () => {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-DIST-${Date.now()}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
        lastWeightKg: 410,
      },
    });

    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Individual TMR ${Date.now()}`,
        targetType: 'INDIVIDUAL',
        cattleId: cow.id,
        durationDays: 30,
        items: [
          { ingredientId, amountKg: 10 },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(201);

    const dist = await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({
        concentrationId: conc.body.data.id,
        items: [{ ingredientId, actualKg: 9 }],
      })
      .expect(201);
    expect(dist.body.data.cattle_id).toBe(cow.id);

    const list = await request(server())
      .get(api(`/feed/distributions?cattleId=${cow.id}`))
      .set(...auth(owner))
      .expect(200);
    expect(
      (list.body.data as Array<{ id: string }>).some(
        (d) => d.id === dist.body.data.id,
      ),
    ).toBe(true);
  });

  it('GET /feed/efficiency?cattleId= returns real adherence/cost-per-litre for one cow', async () => {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-EFF-${Date.now()}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
        lastWeightKg: 400,
      },
    });
    await prisma.milkLogEntry.create({
      data: {
        farmId: owner.farmId,
        cattleId: cow.id,
        logDate: new Date(),
        session: 'MORNING',
        yieldL: 8,
        // RD-077: `disposition` became required on MilkLogEntry; this fixture predates it.
        disposition: 'SALEABLE',
        createdBy: ownerUserId,
      },
    });

    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Efficiency TMR ${Date.now()}`,
        targetType: 'INDIVIDUAL',
        cattleId: cow.id,
        durationDays: 30,
        items: [
          { ingredientId, amountKg: 10 },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(201);
    await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({
        concentrationId: conc.body.data.id,
        items: [{ ingredientId, actualKg: 10 }],
      })
      .expect(201);

    const efficiency = await request(server())
      .get(api(`/feed/efficiency?cattleId=${cow.id}`))
      .set(...auth(owner))
      .expect(200);
    expect(efficiency.body.data.cattle_id).toBe(cow.id);
    expect(efficiency.body.data.distributions).toBeGreaterThanOrEqual(1);
    expect(efficiency.body.data.actual_kg).toBeCloseTo(10, 1);
    expect(efficiency.body.data.litres_produced).toBeCloseTo(8, 1);
    expect(efficiency.body.data.feed_cost_per_litre).not.toBeNull();
  });

  it('GET /feed/efficiency 400s when cattleId is not supplied', async () => {
    await request(server())
      .get(api('/feed/efficiency'))
      .set(...auth(owner))
      .expect(400);
  });
});

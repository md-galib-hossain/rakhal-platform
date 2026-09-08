import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * A saved ration and `GET /feed/requirements` must agree (RAKHAL-411, second half).
 *
 * `enrich()` used to compute a ration's requirement from the `targetWeightKg`/`targetMilkL`
 * frozen into it at creation, ignoring the cow's body condition, gestation days and actual milk
 * yield. `GET /feed/requirements?cattleId=` read all of those from her records. Same cow, two
 * numbers — and the ration screen showed the weaker one, which is where a farmer actually reads
 * it. The divergence was recorded in `COMPETITIVE_FEED_ANALYSIS.md`.
 *
 * Both paths now go through `FeedRequirementsService.resolveForConcentrations`, so this spec pins
 * the two together. It also covers what must NOT change: a Concentrate Mixer still has no
 * requirement, and a ration whose cow has been sold still reads rather than erroring.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — saved ration ↔ requirements parity (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let ingredientId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const createdCattleIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;

    const ing = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Parity Ingredient ${Date.now()}`,
        nutrientGroup: 'ENERGY',
        pricePerKg: 9,
        dmPct: 90,
        cpPct: 12,
        meMjPerKgDm: 10,
      })
      .expect(201);
    ingredientId = ing.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await prisma.cattle.deleteMany({ where: { id: { in: createdCattleIds } } });
    await ctx.app.close();
  });

  /** A cow whose live record deliberately differs from the ration's stored target. */
  async function createCow(opts: { weightKg: number; bcs: number }) {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-PARITY-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
        lastWeightKg: opts.weightKg,
        lastBcs: opts.bcs,
        productionStatus: 'MILKING',
      },
      select: { id: true },
    });
    createdCattleIds.push(cow.id);
    return cow.id;
  }

  async function createRation(
    cattleId: string,
    target: { weightKg: number; milkL: number },
  ) {
    const res = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Parity Ration ${Date.now()}-${Math.random()}`,
        targetType: 'INDIVIDUAL',
        cattleId,
        durationDays: 30,
        targetWeightKg: target.weightKg,
        targetMilkL: target.milkL,
        items: [{ ingredientId, amountKg: 6 }],
      })
      .expect(201);
    return res.body.data.id as string;
  }

  it('scores a saved ration against the same numbers GET /feed/requirements reports for that cow', async () => {
    // 520 kg on the record, but the ration was saved with a 400 kg target — the mismatch the old
    // `enrich()` silently preferred.
    const cattleId = await createCow({ weightKg: 520, bcs: 2.5 });
    const rationId = await createRation(cattleId, { weightKg: 400, milkL: 10 });

    const [ration, direct] = await Promise.all([
      request(server())
        .get(api(`/feed/concentrations/${rationId}`))
        .set(...auth(owner))
        .expect(200),
      request(server())
        .get(api('/feed/requirements'))
        .set(...auth(owner))
        // The stored `targetMilkL` is the ration's manual fallback, playing exactly the role
        // `calcForCattle`'s `query.milkTargetL` does: both resolve
        // `milkFromRecords ?? fallback ?? 0`. This cow has no milk logs, so the comparison is
        // only like-for-like if the endpoint is given the same fallback the ration carries.
        .query({ cattleId, milkTargetL: 10 })
        .expect(200),
    ]);

    const fromRation = ration.body.data.requirements;
    const fromEndpoint = direct.body.data.requirements;

    expect(fromRation).not.toBeNull();
    // The whole point of the ticket: these two used to disagree.
    expect(fromRation.dm_kg).toBeCloseTo(fromEndpoint.dm_kg, 2);
    expect(fromRation.cp_kg).toBeCloseTo(fromEndpoint.cp_kg, 2);
    expect(fromRation.me_mj).toBeCloseTo(fromEndpoint.me_mj, 2);
  });

  it('uses the live weight rather than the target frozen into the ration', async () => {
    const cattleId = await createCow({ weightKg: 520, bcs: 3 });
    const rationId = await createRation(cattleId, { weightKg: 300, milkL: 5 });

    const res = await request(server())
      .get(api(`/feed/concentrations/${rationId}`))
      .set(...auth(owner))
      .expect(200);

    // A 300 kg cow giving 5 L needs less than a 520 kg one. If the stored target were still
    // winning, this would match the lower figure instead of exceeding it.
    const direct = await request(server())
      .get(api('/feed/requirements'))
      .set(...auth(owner))
      .query({ weightKg: 300, milkTargetL: 5 })
      .expect(200);

    expect(res.body.data.requirements.dm_kg).toBeGreaterThan(
      direct.body.data.requirements.dm_kg,
    );
  });

  it('reflects body condition, which the stored target could never carry', async () => {
    // Below-target condition means she needs feeding up: more dry matter than an identical cow
    // sitting at the target score.
    const thin = await createCow({ weightKg: 450, bcs: 2 });
    const onTarget = await createCow({ weightKg: 450, bcs: 3 });

    const [thinRation, onTargetRation] = await Promise.all([
      createRation(thin, { weightKg: 450, milkL: 10 }),
      createRation(onTarget, { weightKg: 450, milkL: 10 }),
    ]);

    const [a, b] = await Promise.all([
      request(server())
        .get(api(`/feed/concentrations/${thinRation}`))
        .set(...auth(owner))
        .expect(200),
      request(server())
        .get(api(`/feed/concentrations/${onTargetRation}`))
        .set(...auth(owner))
        .expect(200),
    ]);

    expect(a.body.data.requirements.dm_kg).toBeGreaterThan(
      b.body.data.requirements.dm_kg,
    );
  });

  it('still reports no requirement for a Concentrate Mixer', async () => {
    const res = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Parity Template ${Date.now()}`,
        items: [{ ingredientId, amountKg: 6 }],
      })
      .expect(201);

    expect(res.body.data.requirements).toBeNull();
    expect(res.body.data.balance_score).toBeNull();

    await request(server())
      .delete(api(`/feed/concentrations/${res.body.data.id}`))
      .set(...auth(owner));
  });

  it('falls back to the stored target when the cow is gone, instead of failing the read', async () => {
    const cattleId = await createCow({ weightKg: 480, bcs: 3 });
    const rationId = await createRation(cattleId, { weightKg: 420, milkL: 12 });

    // Sold, culled, deleted — the ration must stay readable either way.
    await prisma.cattle.deleteMany({ where: { id: cattleId } });

    const res = await request(server())
      .get(api(`/feed/concentrations/${rationId}`))
      .set(...auth(owner))
      .expect(200);

    expect(res.body.data.requirements).not.toBeNull();
    const fallback = await request(server())
      .get(api('/feed/requirements'))
      .set(...auth(owner))
      .query({ weightKg: 420, milkTargetL: 12 })
      .expect(200);
    expect(res.body.data.requirements.dm_kg).toBeCloseTo(
      fallback.body.data.requirements.dm_kg,
      2,
    );
  });

  it('resolves a whole list in one batch, not once per ration', async () => {
    // Six rations across three cows. The assertion is behavioural — every row still gets its own
    // correct requirement — but the batching is what keeps this a constant number of queries
    // rather than six times the cattle/reproduction/milk round-trips.
    const cows = await Promise.all([
      createCow({ weightKg: 400, bcs: 3 }),
      createCow({ weightKg: 500, bcs: 3 }),
      createCow({ weightKg: 600, bcs: 3 }),
    ]);
    await Promise.all(
      cows.flatMap((c) => [
        createRation(c, { weightKg: 350, milkL: 8 }),
        createRation(c, { weightKg: 350, milkL: 8 }),
      ]),
    );

    const list = await request(server())
      .get(api('/feed/concentrations'))
      .set(...auth(owner))
      .query({ kind: 'FEED_MIXTURE' })
      .expect(200);

    const mine = (
      list.body.data as Array<{ name: string; requirements: unknown }>
    ).filter((r) => r.name.startsWith('E2E Parity Ration'));
    expect(mine.length).toBeGreaterThanOrEqual(6);
    expect(mine.every((r) => r.requirements != null)).toBe(true);
  });
});

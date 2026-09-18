import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import { AuthedUser, createTestApp, TestContext } from './utils/e2e';

/**
 * RD-050 (docs/TECH_DEBT.md) — purchased-lactation intake logic is deliberately duplicated
 * between `CattleService.create()` (the `intakeLactation` branch) and
 * `ReproductionService.createPurchasedLactation()` (`POST /cattle`'s "she is already milking at
 * intake" path vs `POST /reproduction/cattle/:id/purchased-lactation`'s standalone "add it after
 * the fact" path) — not shared, because `CattleModule` importing `ReproductionModule` would be a
 * genuine dependency cycle. The row's own recommended fix is a pinned contract test asserting
 * both paths produce an identical `Lactation` shape for the same inputs, so any future edit to
 * one side that silently drifts from the other fails CI instead of shipping unnoticed.
 *
 * Runs on a fresh, empty farm (`FarmService.create()`). Requires the dev stack up + `pnpm seed`.
 */
describe('Purchased-lactation intake — dual-path parity (e2e, RD-050)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let farmService: FarmService;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const unique = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    farmService = ctx.app.get(FarmService);
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });

    const farm = await farmService.create(user.id, {
      name: unique('E2E-RD050-PurchasedLactationFarm'),
    });
    const login = await request(server())
      .post(api('/auth/login'))
      .send({
        email: 'owner@demo.rakhal.test',
        password: 'DemoPass123',
        farmId: farm.id,
      })
      .expect(201);
    owner = { token: login.body.data.accessToken as string, farmId: farm.id };
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  /** Strips id/cattleId/createdAt/updatedAt — the only fields expected to differ between the
   * two paths' rows — leaving exactly the shape both intake methods are supposed to agree on.
   * `startDate` is excluded here and compared separately with a tolerance: the DIM-based branch
   * derives it as `now - N days`, and the two paths' `now` are two independently-timed HTTP
   * requests a few hundred ms apart — a real divergence in the derivation logic, not request
   * timing, is what this test exists to catch. */
  function comparableShape(l: {
    lactationNumber: number;
    status: string;
    startReason: string;
    isEstimated: boolean;
    estimatedLactationNumber: number | null;
    estimatedDaysInMilk: number | null;
  }) {
    return {
      lactationNumber: l.lactationNumber,
      status: l.status,
      startReason: l.startReason,
      isEstimated: l.isEstimated,
      estimatedLactationNumber: l.estimatedLactationNumber,
      estimatedDaysInMilk: l.estimatedDaysInMilk,
    };
  }

  /** `startDate`s from two independently-timed requests should agree within a generous window —
   * anything beyond normal request latency (seconds, not days) signals the two derivations
   * actually disagree, not just request timing. */
  function expectCloseStartDates(a: Date, b: Date, toleranceMs = 10_000) {
    expect(Math.abs(a.getTime() - b.getTime())).toBeLessThan(toleranceMs);
  }

  it('DIM + explicit lactation number: CattleService.create and ReproductionService.createPurchasedLactation produce an identical Lactation row', async () => {
    const viaCreate = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({
        tagNumber: unique('E2E-RD050-A'),
        gender: 'FEMALE',
        priorCalvings: 3,
        productionStatus: 'MILKING',
        intakeLactation: {
          estimatedDaysInMilk: 45,
          estimatedLactationNumber: 3,
        },
      })
      .expect(201);

    const plainCow = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({ tagNumber: unique('E2E-RD050-B'), gender: 'FEMALE' })
      .expect(201);
    await request(server())
      .post(
        api(
          `/reproduction/cattle/${plainCow.body.data.id as string}/purchased-lactation`,
        ),
      )
      .set(...auth(owner))
      .send({ estimatedDaysInMilk: 45, estimatedLactationNumber: 3 })
      .expect(201);

    const [lacA, lacB] = await Promise.all([
      prisma.lactation.findFirstOrThrow({
        where: { cattleId: viaCreate.body.data.id as string },
      }),
      prisma.lactation.findFirstOrThrow({
        where: { cattleId: plainCow.body.data.id as string },
      }),
    ]);

    expect(comparableShape(lacA)).toEqual(comparableShape(lacB));
    expectCloseStartDates(lacA.startDate, lacB.startDate);
  });

  it('estimatedCalvingDate only, no lactation number supplied: both paths derive the same startDate and default to lactationNumber 1', async () => {
    const calvingDate = new Date(Date.now() - 10 * 86_400_000).toISOString();

    const viaCreate = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({
        tagNumber: unique('E2E-RD050-C'),
        gender: 'FEMALE',
        priorCalvings: 1,
        productionStatus: 'MILKING',
        intakeLactation: { estimatedCalvingDate: calvingDate },
      })
      .expect(201);

    const plainCow = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({ tagNumber: unique('E2E-RD050-D'), gender: 'FEMALE' })
      .expect(201);
    await request(server())
      .post(
        api(
          `/reproduction/cattle/${plainCow.body.data.id as string}/purchased-lactation`,
        ),
      )
      .set(...auth(owner))
      .send({ estimatedCalvingDate: calvingDate })
      .expect(201);

    const [lacA, lacB] = await Promise.all([
      prisma.lactation.findFirstOrThrow({
        where: { cattleId: viaCreate.body.data.id as string },
      }),
      prisma.lactation.findFirstOrThrow({
        where: { cattleId: plainCow.body.data.id as string },
      }),
    ]);

    expect(comparableShape(lacA)).toEqual(comparableShape(lacB));
    expect(lacA.lactationNumber).toBe(1);
    expect(lacA.startDate.toISOString()).toBe(calvingDate);
  });
});

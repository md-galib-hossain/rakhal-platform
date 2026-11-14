import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { ReproductionDerivationService } from '../src/modules/reproduction/application/services/reproduction-derivation.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-301 — `ReproductionDerivationService.refreshDerivedState` supersedes
 * the old `refreshProfile`. Covers the four newly-derived fields
 * (`BreedingEvent.status`, `Pregnancy.status`, `Cattle.productionStatus`,
 * `Lactation.recommendedDryOffAt`) end-to-end through the real create routes,
 * plus the ticket's own idempotency AC: two consecutive calls produce
 * byte-identical state. Requires the dev stack up + `pnpm seed`.
 */
describe('Reproduction — derived state recompute (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let derivation: ReproductionDerivationService;
  let owner: AuthedUser;
  let ownerUserId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    derivation = ctx.app.get(ReproductionDerivationService);
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
        tagNumber: `E2E-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        dateOfBirth: new Date('2022-01-01'),
        createdBy: ownerUserId,
      },
    });
  }

  it('calving cascades BreedingEvent→CALVED, Pregnancy→CALVED, Cattle→MILKING, and clears recommendedDryOffAt (no more active pregnancy)', async () => {
    const cow = await createCow('CASCADE');
    const now = Date.now();

    const breedingRes = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date(now).toISOString(),
        breedingMethod: 'NATURAL',
      })
      .expect(201);
    const breedingEventId = breedingRes.body.data.id;

    const expectedCalvingDate = new Date(now + 280 * 86_400_000).toISOString();
    const diagRes = await request(server())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingEventId,
        diagnosisDate: new Date(now + 5 * 86_400_000).toISOString(),
        result: 'PREGNANT',
        diagnosisMethod: 'ULTRASOUND',
        expectedCalvingDate,
      })
      .expect(201);
    expect(diagRes.body.data.id).toBeDefined();

    const pregnancyBeforeCalving = await prisma.pregnancy.findFirstOrThrow({
      where: { cattleId: cow.id, breedingEventId },
    });
    expect(pregnancyBeforeCalving.status).toBe('ACTIVE');

    const lactationBefore = await prisma.lactation.findFirst({
      where: { cattleId: cow.id, status: 'ACTIVE' },
    });
    expect(lactationBefore).toBeNull(); // no lactation yet — this cow hasn't calved

    const calvingRes = await request(server())
      .post(api('/reproduction/calving-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        pregnancyId: pregnancyBeforeCalving.id,
        calvingDate: expectedCalvingDate,
        calvingEase: 'NORMAL',
      })
      .expect(201);
    expect(calvingRes.body.data.id).toBeDefined();

    const [breedingEvent, pregnancy, cattle, lactation] = await Promise.all([
      prisma.breedingEvent.findUniqueOrThrow({
        where: { id: breedingEventId },
      }),
      prisma.pregnancy.findUniqueOrThrow({
        where: { id: pregnancyBeforeCalving.id },
      }),
      prisma.cattle.findUniqueOrThrow({ where: { id: cow.id } }),
      prisma.lactation.findFirstOrThrow({
        where: { cattleId: cow.id, status: 'ACTIVE' },
      }),
    ]);

    expect(breedingEvent.status).toBe('CALVED');
    expect(pregnancy.status).toBe('CALVED');
    expect(cattle.productionStatus).toBe('MILKING');
    // No active Pregnancy remains after calving, so the recompute clears the
    // dry-off projection rather than leaving the pre-calving date stale.
    expect(lactation.recommendedDryOffAt).toBeNull();
  });

  it('refreshDerivedState is idempotent: two consecutive calls produce byte-identical state', async () => {
    const cow = await createCow('IDEMPOTENT');
    const now = Date.now();

    const breedingRes = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date(now).toISOString(),
        breedingMethod: 'NATURAL',
      })
      .expect(201);
    const breedingEventId = breedingRes.body.data.id;

    await request(server())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingEventId,
        diagnosisDate: new Date(now + 5 * 86_400_000).toISOString(),
        result: 'PREGNANT',
        diagnosisMethod: 'ULTRASOUND',
        expectedCalvingDate: new Date(now + 280 * 86_400_000).toISOString(),
      })
      .expect(201);

    async function snapshot() {
      const [breedingEvents, pregnancies, cattle, lactations, profile] =
        await Promise.all([
          prisma.breedingEvent.findMany({
            where: { cattleId: cow.id },
            orderBy: { id: 'asc' },
          }),
          prisma.pregnancy.findMany({
            where: { cattleId: cow.id },
            orderBy: { id: 'asc' },
          }),
          prisma.cattle.findUniqueOrThrow({ where: { id: cow.id } }),
          prisma.lactation.findMany({
            where: { cattleId: cow.id },
            orderBy: { id: 'asc' },
          }),
          prisma.reproductionProfile.findUnique({
            where: { cattleId: cow.id },
          }),
        ]);
      // `updatedAt`/`createdAt` on the ReproductionProfile legitimately move
      // on every upsert even when every other field is unchanged (the
      // recompute always re-upserts it) — excluded from the comparison, as
      // is `Cattle.updatedAt` for the same reason. Every field this ticket's
      // recompute actually derives is still compared byte-for-byte.
      return JSON.stringify({
        breedingEvents,
        pregnancies,
        cattleProductionStatus: cattle.productionStatus,
        lactations,
        profile: profile
          ? { ...profile, updatedAt: undefined, createdAt: undefined }
          : null,
      });
    }

    await derivation.refreshDerivedState(owner.farmId, cow.id);
    const first = await snapshot();

    await derivation.refreshDerivedState(owner.farmId, cow.id);
    const second = await snapshot();

    expect(second).toBe(first);
  });
});

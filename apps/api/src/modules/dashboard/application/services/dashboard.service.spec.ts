import { HealthCaseStatus } from '@prisma/client';
import { DashboardService } from './dashboard.service';

/**
 * Dashboard `herdStatus()` — real `categoryBreakdown` partition (the 5
 * mutually-exclusive `AnimalCategory` counts must sum to `totalActive`,
 * unlike the old overlapping `productionBreakdown`) + the `sick`/
 * `inTreatment` split (previously both fields silently reused the same
 * combined `activeCases` number — see `deriveHealthStatus()`,
 * `src/modules/cattle/domain/health-status.ts`, for the precedence this
 * mirrors: any open case whose status has moved past `ACTIVE` is
 * in-treatment, a still-`ACTIVE` case is sick).
 */
describe('DashboardService — herdStatus', () => {
  // Prisma `where` fragment shape helpers, mirroring
  // `buildAnimalCategoryWhere()` (`src/modules/cattle/domain/animal-category.ts`)
  // closely enough to route the mock without re-implementing its full logic.
  type WhereInput = Record<string, unknown>;

  const isAndArray = (where: WhereInput): WhereInput[] | null =>
    Array.isArray(where.AND) ? (where.AND as WhereInput[]) : null;

  const hasGender = (and: WhereInput[], gender: string): boolean =>
    and.some((c) => c.gender === gender);

  const CATEGORY_COUNTS = {
    CALF: 2,
    HEIFER: 3,
    COW: 4,
    BULL: 1,
    STEER: 1,
  };
  const TOTAL_ACTIVE = Object.values(CATEGORY_COUNTS).reduce(
    (a, b) => a + b,
    0,
  ); // 11

  let prisma: {
    cattle: { count: jest.Mock; findMany: jest.Mock };
    reproductionProfile: { groupBy: jest.Mock };
    healthCase: { groupBy: jest.Mock };
    safetyWithdrawal: { count: jest.Mock };
  };
  let logger: { setContext: jest.Mock };
  let farmSettings: { getEffective: jest.Mock };
  let healthCaseRows: Array<{
    status: HealthCaseStatus;
    _count: { _all: number };
  }>;

  beforeEach(() => {
    healthCaseRows = [];

    prisma = {
      cattle: {
        count: jest.fn((args: { where: WhereInput }) => {
          const { where } = args;
          if (
            where.purpose &&
            typeof where.purpose === 'object' &&
            (where.purpose as { not?: string }).not === 'CALF'
          ) {
            return Promise.resolve(TOTAL_ACTIVE);
          }
          if (where.productionStatus === 'MILKING') return Promise.resolve(5);
          if (where.productionStatus === 'DRY') return Promise.resolve(3);

          // CALF: no AND wrapper, just a bare dateOfBirth.gte fragment.
          if (!where.AND && where.dateOfBirth) {
            return Promise.resolve(CATEGORY_COUNTS.CALF);
          }

          const and = isAndArray(where);
          if (and) {
            if (hasGender(and, 'FEMALE')) {
              // Two fragments in `and` carry an `OR` array — `notCalfByAge`
              // (dateOfBirth-based) and HEIFER's own reproductionProfile
              // fragment; disambiguate by the key each OR branch checks.
              const heiferOr = and.find(
                (c) =>
                  Array.isArray(c.OR) &&
                  (c.OR as WhereInput[]).some(
                    (o) => 'reproductionProfile' in o,
                  ),
              ) as { OR?: WhereInput[] } | undefined;
              const isHeifer = heiferOr?.OR?.some(
                (o) => o.reproductionProfile === null,
              );
              return Promise.resolve(
                isHeifer ? CATEGORY_COUNTS.HEIFER : CATEGORY_COUNTS.COW,
              );
            }
            if (hasGender(and, 'MALE'))
              return Promise.resolve(CATEGORY_COUNTS.BULL);
            if (hasGender(and, 'CASTRATED_MALE'))
              return Promise.resolve(CATEGORY_COUNTS.STEER);
          }
          return Promise.resolve(0);
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      reproductionProfile: { groupBy: jest.fn().mockResolvedValue([]) },
      healthCase: {
        groupBy: jest.fn(() => Promise.resolve(healthCaseRows)),
      },
      safetyWithdrawal: { count: jest.fn().mockResolvedValue(0) },
    };
    logger = { setContext: jest.fn().mockReturnThis() };
    farmSettings = {
      getEffective: jest.fn().mockResolvedValue({
        lactationFreshDays: 21,
        lactationEarlyDays: 100,
        lactationMidDays: 200,
      }),
    };
  });

  const make = () =>
    new DashboardService(
      prisma as never,
      {} as never, // FinanceService — unused by herdStatus
      {} as never, // MilkService — unused by herdStatus
      {} as never, // HealthService — unused by herdStatus
      farmSettings as never,
      logger as never,
    );

  it('categoryBreakdown sums exactly to totalActive for a known category mix', async () => {
    const service = make();
    const result = await service.herdStatus('farm-1');

    expect(result.totalActive).toBe(TOTAL_ACTIVE);
    expect(result.categoryBreakdown).toEqual({
      calf: CATEGORY_COUNTS.CALF,
      heifer: CATEGORY_COUNTS.HEIFER,
      cow: CATEGORY_COUNTS.COW,
      bull: CATEGORY_COUNTS.BULL,
      steer: CATEGORY_COUNTS.STEER,
    });
    const sum = Object.values(result.categoryBreakdown).reduce(
      (a, b) => a + b,
      0,
    );
    expect(sum).toBe(result.totalActive);
  });

  it('no longer returns a `growing` field on productionBreakdown', async () => {
    const service = make();
    const result = await service.herdStatus('farm-1');
    expect(result.productionBreakdown).not.toHaveProperty('growing');
    expect(result.productionBreakdown).toHaveProperty('fresh');
  });

  it('sick counts only still-ACTIVE cases; inTreatment counts open-but-not-ACTIVE cases', async () => {
    healthCaseRows = [
      { status: HealthCaseStatus.ACTIVE, _count: { _all: 4 } },
      { status: HealthCaseStatus.IMPROVING, _count: { _all: 2 } },
      { status: HealthCaseStatus.STABLE, _count: { _all: 1 } },
    ];

    const service = make();
    const result = await service.herdStatus('farm-1');

    expect(result.healthBreakdown.sick).toBe(4);
    expect(result.healthBreakdown.inTreatment).toBe(3);
    expect(result.healthBreakdown.sick).not.toBe(
      result.healthBreakdown.inTreatment,
    );
  });

  it('sick/inTreatment both read 0 when there are no open health cases', async () => {
    healthCaseRows = [];
    const service = make();
    const result = await service.herdStatus('farm-1');
    expect(result.healthBreakdown.sick).toBe(0);
    expect(result.healthBreakdown.inTreatment).toBe(0);
    expect(result.healthBreakdown.healthy).toBe(TOTAL_ACTIVE);
  });
});

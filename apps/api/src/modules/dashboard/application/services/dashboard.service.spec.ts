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
      {} as never, // FeedDistributionService — unused by herdStatus
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

/**
 * `priorities()` — grouped rows carry the underlying cattle list (not just a
 * count) so the frontend can expand a row like "5 cow(s) overdue for
 * treatment dose" into its 5 individual cows. Only the two groupable
 * categories (overdue doses, pending milk log) are covered here; the other
 * three priority types are single-entity `findFirst` alerts, unaffected by
 * this change.
 */
describe('DashboardService — priorities (grouped cattle rows)', () => {
  const cow = (id: string, name: string | null, tag: string) => ({
    cattle: { id, name, tagNumber: tag },
  });

  let prisma: {
    healthTask: { findMany: jest.Mock };
    pregnancy: { findFirst: jest.Mock };
    medicine: { findFirst: jest.Mock; fields: { lowStockThreshold: string } };
    financeReceivable: { findFirst: jest.Mock };
    task: { count: jest.Mock };
    cattle: { findMany: jest.Mock };
    milkLogEntry: { findMany: jest.Mock };
  };
  let logger: { setContext: jest.Mock };

  beforeEach(() => {
    prisma = {
      healthTask: { findMany: jest.fn().mockResolvedValue([]) },
      pregnancy: { findFirst: jest.fn().mockResolvedValue(null) },
      medicine: {
        findFirst: jest.fn().mockResolvedValue(null),
        fields: { lowStockThreshold: 'lowStockThreshold' },
      },
      financeReceivable: { findFirst: jest.fn().mockResolvedValue(null) },
      task: { count: jest.fn().mockResolvedValue(0) },
      cattle: { findMany: jest.fn().mockResolvedValue([]) },
      milkLogEntry: { findMany: jest.fn().mockResolvedValue([]) },
    };
    logger = { setContext: jest.fn().mockReturnThis() };
  });

  const make = () =>
    new DashboardService(
      prisma as never,
      {} as never, // FinanceService — unused by priorities()
      {} as never, // MilkService — unused by priorities()
      {} as never, // HealthService — unused by priorities()
      {} as never, // FarmSettingsService — unused by priorities()
      {} as never, // FeedDistributionService — unused by priorities()
      logger as never,
    );

  it('omits the overdue-dose and pending-milk rows entirely when there are none', async () => {
    const service = make();
    const result = await service.priorities('farm-1');
    expect(
      result.priorities.some((p) =>
        p.message.includes('overdue for treatment'),
      ),
    ).toBe(false);
    expect(
      result.priorities.some((p) => p.message.includes('Milk log pending')),
    ).toBe(false);
  });

  it('groups >1 overdue-dose cows into one row carrying the full cattle list', async () => {
    prisma.healthTask.findMany.mockResolvedValue([
      cow('c1', 'Bella', 'T1'),
      cow('c2', 'Rosie', 'T2'),
    ]);
    const service = make();
    const result = await service.priorities('farm-1');
    const row = result.priorities.find((p) => p.priority === 'critical');
    expect(row?.message).toBe('2 cow(s) overdue for treatment dose');
    expect(row?.count).toBe(2);
    expect(row?.truncated).toBe(false);
    expect(row?.cattle).toEqual([
      { id: 'c1', name: 'Bella', tag: 'T1' },
      { id: 'c2', name: 'Rosie', tag: 'T2' },
    ]);
  });

  it('caps overdue-dose cattle at 50 and marks the row truncated beyond that', async () => {
    const rows = Array.from({ length: 51 }, (_, i) =>
      cow(`c${i}`, `Cow ${i}`, `T${i}`),
    );
    prisma.healthTask.findMany.mockResolvedValue(rows);
    const service = make();
    const result = await service.priorities('farm-1');
    const row = result.priorities.find((p) => p.priority === 'critical');
    expect(row?.truncated).toBe(true);
    expect(row?.count).toBe(50);
    expect(row?.cattle).toHaveLength(50);
    expect(row?.message).toBe('50+ cow(s) overdue for treatment dose');
  });

  it('groups pending milk-log cows into one row carrying the not-yet-logged cattle', async () => {
    prisma.cattle.findMany.mockResolvedValue([
      { id: 'c1', name: 'Bella', tagNumber: 'T1' },
      { id: 'c2', name: 'Rosie', tagNumber: 'T2' },
      { id: 'c3', name: null, tagNumber: 'T3' },
    ]);
    prisma.milkLogEntry.findMany.mockResolvedValue([{ cattleId: 'c1' }]);
    const service = make();
    const result = await service.priorities('farm-1');
    const row = result.priorities.find((p) => p.priority === 'operational');
    expect(row?.message).toBe('Milk log pending — 2 cow(s) not yet logged');
    expect(row?.count).toBe(2);
    expect(row?.truncated).toBe(false);
    expect(row?.cattle).toEqual([
      { id: 'c2', name: 'Rosie', tag: 'T2' },
      { id: 'c3', name: null, tag: 'T3' },
    ]);
  });

  it('a single overdue-dose cow still returns a one-item cattle array (frontend hides the chevron itself)', async () => {
    prisma.healthTask.findMany.mockResolvedValue([cow('c1', 'Bella', 'T1')]);
    const service = make();
    const result = await service.priorities('farm-1');
    const row = result.priorities.find((p) => p.priority === 'critical');
    expect(row?.cattle).toHaveLength(1);
    expect(row?.message).toBe('1 cow(s) overdue for treatment dose');
  });
});

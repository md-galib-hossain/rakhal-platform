import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BreedingStatus, CalvingEase, CattleGender } from '@prisma/client';
import { CreateDryOffDto } from '../../presentation/dto/create-dry-off.dto';
import { CreatePurchasedLactationDto } from '../../presentation/dto/create-purchased-lactation.dto';
import {
  deriveReproductionState,
  ReproductionService,
  ReproductionStateInput,
} from './reproduction.service';

/**
 * RAKHAL-271 (v2 correction) — pure breeding-cycle CORE-STATE derivation unit
 * tests. `deriveReproductionState` is exported specifically so this suite
 * doesn't need a Prisma double; the private `refreshProfile()` on
 * `ReproductionService` is covered end-to-end by
 * `test/reproduction-lifecycle.e2e-spec.ts`. Alert derivation
 * (`HEAT_DETECTED`/`PREGNANCY_CHECK_DUE`/`CALVING_DUE`) moved to
 * `../../domain/reproduction-alerts.spec.ts` — v2 split the old 8-value
 * `ReproductiveStatus` into this 5-value core state + derived alerts.
 */
describe('deriveReproductionState', () => {
  const now = new Date('2026-08-05T00:00:00.000Z');
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const base: ReproductionStateInput = {
    now,
    gender: CattleGender.FEMALE,
    dateOfBirth: daysAgo(1000), // well past breeding age
    hasBreedingHistory: false,
    hasActivePregnancy: false,
    lastBreeding: null,
    lastCalving: null,
    vwpDays: 60,
  };

  it('returns NOT_ELIGIBLE for a male animal', () => {
    expect(
      deriveReproductionState({ ...base, gender: CattleGender.MALE }),
    ).toBe('NOT_ELIGIBLE');
  });

  it('returns NOT_ELIGIBLE for a female below breeding age with no history', () => {
    expect(
      deriveReproductionState({
        ...base,
        dateOfBirth: daysAgo(200), // ~6.5 months, well under 450-day threshold
        hasBreedingHistory: false,
      }),
    ).toBe('NOT_ELIGIBLE');
  });

  it('does not gate a young female that already has breeding history', () => {
    expect(
      deriveReproductionState({
        ...base,
        dateOfBirth: daysAgo(200),
        hasBreedingHistory: true,
      }),
    ).toBe('OPEN');
  });

  it('returns OPEN when there is no active pregnancy/breeding/recent calving', () => {
    expect(deriveReproductionState(base)).toBe('OPEN');
  });

  it('returns POSTPARTUM_WAITING inside the VWP window after calving', () => {
    expect(
      deriveReproductionState({
        ...base,
        lastCalving: { calvingDate: daysAgo(30) },
        vwpDays: 60,
      }),
    ).toBe('POSTPARTUM_WAITING');
  });

  it('returns OPEN once the VWP window has elapsed', () => {
    expect(
      deriveReproductionState({
        ...base,
        lastCalving: { calvingDate: daysAgo(90) },
        vwpDays: 60,
      }),
    ).toBe('OPEN');
  });

  it('returns BRED_AWAITING_CONFIRMATION for a pending-check breeding', () => {
    expect(
      deriveReproductionState({
        ...base,
        lastBreeding: { status: BreedingStatus.PENDING_CHECK },
      }),
    ).toBe('BRED_AWAITING_CONFIRMATION');
  });

  it('a pending-check breeding takes priority over VWP/postpartum waiting', () => {
    expect(
      deriveReproductionState({
        ...base,
        lastBreeding: { status: BreedingStatus.PENDING_CHECK },
        lastCalving: { calvingDate: daysAgo(30) },
        vwpDays: 60,
      }),
    ).toBe('BRED_AWAITING_CONFIRMATION');
  });

  it('returns PREGNANT for any active pregnancy, regardless of a stale non-PENDING_CHECK breeding', () => {
    expect(
      deriveReproductionState({
        ...base,
        hasActivePregnancy: true,
        lastBreeding: { status: BreedingStatus.PREGNANT },
      }),
    ).toBe('PREGNANT');
  });

  it('pregnancy takes priority over a pending-check breeding', () => {
    expect(
      deriveReproductionState({
        ...base,
        hasActivePregnancy: true,
        lastBreeding: { status: BreedingStatus.PENDING_CHECK },
      }),
    ).toBe('PREGNANT');
  });

  it('v2: a PREGNANT cow stays PREGNANT close to calving — closeness is an alert, not a different state', () => {
    // v1 used to derive EXPECTED_TO_CALVE here based on a close-up window;
    // v2 has no such branch at all — `deriveReproductionState` doesn't even
    // take an expectedCalvingDate/closeUpWindowDays input anymore.
    expect(
      deriveReproductionState({
        ...base,
        hasActivePregnancy: true,
      }),
    ).toBe('PREGNANT');
  });
});

/**
 * RAKHAL-274 — `CreateDryOffDto.reason` is optional (`recordDryOff` itself is
 * exercised end-to-end by `test/reproduction-dry-off.e2e-spec.ts`; this suite
 * just pins down the DTO validation contract without needing a Prisma
 * double).
 */
describe('CreateDryOffDto — reason (RAKHAL-274)', () => {
  it('validates with no reason supplied', async () => {
    const dto = plainToInstance(CreateDryOffDto, { notes: 'routine dry-off' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.reason).toBeUndefined();
  });

  it('validates with a valid DryOffReason supplied', async () => {
    const dto = plainToInstance(CreateDryOffDto, {
      notes: 'low yield',
      reason: 'LOW_PRODUCTION',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe('LOW_PRODUCTION');
  });

  it('rejects an invalid reason value', async () => {
    const dto = plainToInstance(CreateDryOffDto, { reason: 'NOT_A_REASON' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });
});

/**
 * Atomicity fix (heifer/MILKING invariant task): `ReproductionProfile.totalCalvings`
 * must be written inside the SAME `$transaction` that creates the
 * `CalvingEvent`/`Lactation` and flips `Cattle.productionStatus` to MILKING —
 * previously it only landed via the post-transaction `refreshProfile()` call,
 * leaving a window where a reader could observe `productionStatus: MILKING`
 * with a stale `totalCalvings` (e.g. still 0, mis-deriving `animalCategory`
 * as HEIFER) between the transaction commit and that follow-up write.
 *
 * `tx` is mocked as `prisma` itself (every model method lives directly on
 * this one mock object), same pattern as `cattle.service.spec.ts`, so call
 * ORDER on `prisma.reproductionProfile.upsert.mock.calls` is what proves the
 * in-transaction write happened first, independently of the later
 * `refreshProfile()` call.
 */
describe('ReproductionService.createCalvingEvent — totalCalvings atomicity', () => {
  let prisma: {
    cattle: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    calvingEvent: {
      count: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
    lactation: { create: jest.Mock; findFirst: jest.Mock };
    reproductionProfile: { upsert: jest.Mock };
    breedingEvent: { count: jest.Mock; findFirst: jest.Mock };
    pregnancy: { findMany: jest.Mock; findFirst: jest.Mock };
    abortionEvent: { count: jest.Mock };
    pregnancyDiagnosis: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let aqrService: { applyEvent: jest.Mock };
  let taskService: { createInternal: jest.Mock };
  let farmSettings: { reproVwpDays: jest.Mock };
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock };
  let derivation: { refreshDerivedState: jest.Mock };

  const cattleRow = {
    id: 'cattle-1',
    farmId: 'farm-1',
    gender: CattleGender.FEMALE,
    tagNumber: 'TAG-1',
  };

  beforeEach(() => {
    prisma = {
      cattle: {
        findFirst: jest.fn().mockResolvedValue(cattleRow),
        findUnique: jest.fn().mockResolvedValue(cattleRow),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      calvingEvent: {
        // Outside the transaction computes `calvingNumber` from the
        // pre-existing count; inside the transaction, after the new
        // CalvingEvent row is created, computes `totalCalvings` — this cow's
        // very first calving, so both resolve consistently.
        // `refreshDerivedState()`'s own post-transaction re-derivation is a
        // separately-mocked collaborator now (RAKHAL-301), not a further
        // call on this same mock.
        count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
        create: jest.fn().mockResolvedValue({ id: 'calving-1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'calving-1',
          calfBirths: [],
        }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      lactation: {
        create: jest.fn().mockResolvedValue({ id: 'lactation-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      reproductionProfile: { upsert: jest.fn().mockResolvedValue({}) },
      breedingEvent: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      pregnancy: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      abortionEvent: { count: jest.fn().mockResolvedValue(0) },
      pregnancyDiagnosis: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    };
    aqrService = { applyEvent: jest.fn().mockResolvedValue({ aqrScore: 0 }) };
    taskService = { createInternal: jest.fn().mockResolvedValue({}) };
    farmSettings = { reproVwpDays: jest.fn().mockResolvedValue(60) };
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
    derivation = {
      refreshDerivedState: jest.fn().mockResolvedValue(undefined),
    };
  });

  const make = () =>
    new ReproductionService(
      prisma as never,
      aqrService as never, // AqrService
      taskService as never, // TaskService
      {} as never, // SemenService (unused by createCalvingEvent)
      {} as never, // FinanceService (unused by createCalvingEvent)
      { scheduleCareReminders: jest.fn() } as never, // CalfService
      farmSettings as never, // FarmSettingsService
      { activeHoldsForCattle: jest.fn() } as never, // AnimalHoldService (unused here)
      logger as never,
      derivation as never, // ReproductionDerivationService
    );

  it('writes ReproductionProfile.totalCalvings inside the same $transaction as the CalvingEvent + MILKING flip, before refreshDerivedState() runs', async () => {
    const service = make();

    await service.createCalvingEvent('farm-1', 'user-1', {
      cattleId: 'cattle-1',
      calvingDate: '2026-08-06',
      calvingEase: CalvingEase.NORMAL,
    });

    // The in-transaction write (this fix adds) is the ONLY
    // reproductionProfile.upsert call on this mock now — the post-transaction
    // recompute moved to the separately-mocked `ReproductionDerivationService`
    // (RAKHAL-301), so it's asserted independently below instead of via a
    // second call on this same mock.
    expect(prisma.reproductionProfile.upsert).toHaveBeenCalledTimes(1);
    const upsertCalls = prisma.reproductionProfile.upsert.mock.calls as Array<
      [{ create: { totalCalvings: number }; update: { totalCalvings: number } }]
    >;
    const firstCallArgs = upsertCalls[0][0];
    expect(firstCallArgs.create.totalCalvings).toBe(1);
    expect(firstCallArgs.update.totalCalvings).toBe(1);

    // The MILKING flip itself happened in the same transaction (the mocked
    // tx === prisma, so this call is on the same mock).
    expect(prisma.cattle.updateMany).toHaveBeenCalledWith({
      where: { id: 'cattle-1', isActive: true },
      data: { productionStatus: 'MILKING' },
    });

    // refreshDerivedState() still runs after the transaction commits.
    expect(derivation.refreshDerivedState).toHaveBeenCalledWith(
      'farm-1',
      'cattle-1',
    );
  });
});

/**
 * RAKHAL-290 — "no two ACTIVE lactations": `createCalvingEvent()` must detect
 * a dam whose prior `Lactation` is still `ACTIVE` (a missed dry-off record),
 * close it with `endReason: MISSING_DRY_OFF_RECORD` and `endDate` = the new
 * calving date, then open the new lactation — surfacing the closure on the
 * response rather than silently overwriting it. Same Prisma-double-as-tx
 * pattern as the `totalCalvings atomicity` suite above.
 */
interface MissingDryOffPrismaMock {
  cattle: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
  };
  calvingEvent: {
    count: jest.Mock;
    create: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
  };
  lactation: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
  reproductionProfile: { upsert: jest.Mock };
  breedingEvent: { count: jest.Mock; findFirst: jest.Mock };
  pregnancy: { findMany: jest.Mock; findFirst: jest.Mock };
  abortionEvent: { count: jest.Mock };
  pregnancyDiagnosis: { findFirst: jest.Mock };
  $transaction: jest.Mock;
}

describe('ReproductionService.createCalvingEvent — missing dry-off auto-close (RAKHAL-290)', () => {
  let prisma: MissingDryOffPrismaMock;
  let aqrService: { applyEvent: jest.Mock };
  let taskService: { createInternal: jest.Mock };
  let farmSettings: { reproVwpDays: jest.Mock };
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock };

  const cattleRow = {
    id: 'cattle-1',
    farmId: 'farm-1',
    gender: CattleGender.FEMALE,
    tagNumber: 'TAG-1',
  };
  const priorActiveLactation = {
    id: 'lactation-prior',
    cattleId: 'cattle-1',
    status: 'ACTIVE',
    startDate: new Date('2025-01-01'),
  };

  function makePrisma(activeLactation: unknown): MissingDryOffPrismaMock {
    const p: MissingDryOffPrismaMock = {
      cattle: {
        findFirst: jest.fn().mockResolvedValue(cattleRow),
        findUnique: jest.fn().mockResolvedValue(cattleRow),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      calvingEvent: {
        count: jest
          .fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(1)
          .mockResolvedValue(1),
        create: jest.fn().mockResolvedValue({ id: 'calving-1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'calving-1',
          calfBirths: [],
        }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      lactation: {
        create: jest.fn().mockResolvedValue({ id: 'lactation-new' }),
        findFirst: jest.fn().mockResolvedValue(activeLactation),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...priorActiveLactation,
          status: 'ENDED',
          endReason: 'MISSING_DRY_OFF_RECORD',
        }),
      },
      reproductionProfile: { upsert: jest.fn().mockResolvedValue({}) },
      breedingEvent: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      pregnancy: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      abortionEvent: { count: jest.fn().mockResolvedValue(0) },
      pregnancyDiagnosis: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(p)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    };
    return p;
  }

  beforeEach(() => {
    aqrService = { applyEvent: jest.fn().mockResolvedValue({ aqrScore: 0 }) };
    taskService = { createInternal: jest.fn().mockResolvedValue({}) };
    farmSettings = { reproVwpDays: jest.fn().mockResolvedValue(60) };
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
  });

  const make = () =>
    new ReproductionService(
      prisma as never,
      aqrService as never,
      taskService as never,
      {} as never,
      {} as never, // FinanceService (unused)
      { scheduleCareReminders: jest.fn() } as never,
      farmSettings as never,
      { activeHoldsForCattle: jest.fn() } as never,
      logger as never,
      { refreshDerivedState: jest.fn().mockResolvedValue(undefined) } as never, // ReproductionDerivationService
    );

  it('closes an already-ACTIVE lactation with MISSING_DRY_OFF_RECORD before opening the new one, and surfaces it on the response', async () => {
    prisma = makePrisma(priorActiveLactation);
    const service = make();

    const result = await service.createCalvingEvent('farm-1', 'user-1', {
      cattleId: 'cattle-1',
      calvingDate: '2026-08-06',
      calvingEase: CalvingEase.NORMAL,
    });

    expect(prisma.lactation.update).toHaveBeenCalledWith({
      where: { id: 'lactation-prior' },
      data: {
        status: 'ENDED',
        endDate: new Date('2026-08-06'),
        endReason: 'MISSING_DRY_OFF_RECORD',
      },
    });
    // The closure never silently overwrites — it's visible on the response.
    expect(
      (result as { closedMissingDryOffLactation: { id: string } | null })
        .closedMissingDryOffLactation?.id,
    ).toBe('lactation-prior');
    // The new lactation is still created after the close.
    expect(prisma.lactation.create).toHaveBeenCalled();
  });

  it('does nothing extra when the dam has no ACTIVE lactation (the normal case)', async () => {
    prisma = makePrisma(null);
    const service = make();

    const result = await service.createCalvingEvent('farm-1', 'user-1', {
      cattleId: 'cattle-1',
      calvingDate: '2026-08-06',
      calvingEase: CalvingEase.NORMAL,
    });

    expect(prisma.lactation.update).not.toHaveBeenCalled();
    expect(
      (result as { closedMissingDryOffLactation: unknown })
        .closedMissingDryOffLactation,
    ).toBeNull();
  });
});

/**
 * RAKHAL-281: purchased-lactating cow intake (no CalvingEvent). Same
 * Prisma-double-as-tx pattern as the `totalCalvings atomicity` suite above.
 */
describe('ReproductionService.createPurchasedLactation', () => {
  let prisma: {
    cattle: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    lactation: { create: jest.Mock; findFirst: jest.Mock; count: jest.Mock };
    reproductionProfile: { upsert: jest.Mock };
    breedingEvent: { count: jest.Mock; findFirst: jest.Mock };
    pregnancy: { findMany: jest.Mock; findFirst: jest.Mock };
    calvingEvent: { count: jest.Mock; findFirst: jest.Mock };
    abortionEvent: { count: jest.Mock };
    pregnancyDiagnosis: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let farmSettings: { reproVwpDays: jest.Mock };
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock };

  const cattleRow = {
    id: 'cattle-1',
    farmId: 'farm-1',
    gender: CattleGender.FEMALE,
    tagNumber: 'TAG-1',
  };

  beforeEach(() => {
    prisma = {
      cattle: {
        findFirst: jest.fn().mockResolvedValue(cattleRow),
        findUnique: jest.fn().mockResolvedValue(cattleRow),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      lactation: {
        create: jest.fn().mockResolvedValue({ id: 'lactation-purchased-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      reproductionProfile: { upsert: jest.fn().mockResolvedValue({}) },
      breedingEvent: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      pregnancy: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      calvingEvent: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      abortionEvent: { count: jest.fn().mockResolvedValue(0) },
      pregnancyDiagnosis: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    };
    farmSettings = { reproVwpDays: jest.fn().mockResolvedValue(60) };
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
  });

  const make = () =>
    new ReproductionService(
      prisma as never,
      { applyEvent: jest.fn() } as never, // AqrService (unused by this use-case)
      { createInternal: jest.fn() } as never, // TaskService (unused)
      {} as never, // SemenService (unused)
      {} as never, // FinanceService (unused)
      { scheduleCareReminders: jest.fn() } as never, // CalfService (unused)
      farmSettings as never,
      { activeHoldsForCattle: jest.fn() } as never, // AnimalHoldService (unused)
      logger as never,
      { refreshDerivedState: jest.fn().mockResolvedValue(undefined) } as never, // ReproductionDerivationService
    );

  it('creates an ACTIVE, isEstimated Lactation with startReason PURCHASED_LACTATING and flips Cattle to MILKING', async () => {
    const service = make();
    const dto: CreatePurchasedLactationDto = {
      estimatedDaysInMilk: 45,
      estimatedLactationNumber: 3,
    };

    const result = await service.createPurchasedLactation(
      'farm-1',
      'user-1',
      'cattle-1',
      dto,
    );

    expect(result).toEqual({ id: 'lactation-purchased-1' });
    expect(prisma.lactation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cattleId: 'cattle-1',
        lactationNumber: 3,
        status: 'ACTIVE',
        startReason: 'PURCHASED_LACTATING',
        isEstimated: true,
        estimatedLactationNumber: 3,
        estimatedDaysInMilk: 45,
      }) as unknown,
    });
    expect(prisma.cattle.updateMany).toHaveBeenCalledWith({
      where: { id: 'cattle-1', isActive: true },
      data: { productionStatus: 'MILKING' },
    });
  });

  it('defaults lactationNumber to the existing Lactation count + 1 and leaves estimated fields null when nothing is supplied', async () => {
    prisma.lactation.count.mockResolvedValueOnce(2);
    const service = make();

    await service.createPurchasedLactation('farm-1', 'user-1', 'cattle-1', {});

    expect(prisma.lactation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lactationNumber: 3,
        isEstimated: true,
        estimatedLactationNumber: null,
        estimatedDaysInMilk: null,
      }) as unknown,
    });
  });

  it('rejects intake when the cow already has an active Lactation', async () => {
    prisma.lactation.findFirst.mockResolvedValueOnce({ id: 'existing' });
    const service = make();

    await expect(
      service.createPurchasedLactation('farm-1', 'user-1', 'cattle-1', {}),
    ).rejects.toThrow('already has an active lactation on record');
    expect(prisma.lactation.create).not.toHaveBeenCalled();
  });
});

/**
 * RAKHAL-290 — `recordDryOff()` must stamp `Lactation.endReason: DRY_OFF`
 * (RAKHAL-281 added the column but left this call site as a documented gap).
 * Full end-to-end coverage (DryPeriod creation, productionStatus flip, DIM
 * reads null afterward) already lives in `test/reproduction-dry-off.e2e-spec.ts`
 * — this unit test isolates just the new `endReason` write.
 */
describe('ReproductionService.recordDryOff — endReason (RAKHAL-290)', () => {
  let prisma: {
    cattle: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    lactation: { findFirst: jest.Mock; update: jest.Mock };
    reproductionProfile: { upsert: jest.Mock };
    dryPeriod: { findFirst: jest.Mock; create: jest.Mock };
    breedingEvent: { count: jest.Mock; findFirst: jest.Mock };
    pregnancy: { findMany: jest.Mock; findFirst: jest.Mock };
    calvingEvent: { count: jest.Mock; findFirst: jest.Mock };
    abortionEvent: { count: jest.Mock };
    pregnancyDiagnosis: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let farmSettings: {
    reproVwpDays: jest.Mock;
    reproDryPeriodTargetDays: jest.Mock;
  };
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock };

  const cattleRow = {
    id: 'cattle-1',
    farmId: 'farm-1',
    gender: CattleGender.FEMALE,
    tagNumber: 'TAG-1',
  };
  const activeLactation = {
    id: 'lactation-1',
    cattleId: 'cattle-1',
    status: 'ACTIVE',
    startDate: new Date('2025-06-01'),
  };

  beforeEach(() => {
    prisma = {
      cattle: {
        findFirst: jest.fn().mockResolvedValue(cattleRow),
        findUnique: jest.fn().mockResolvedValue(cattleRow),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      lactation: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(activeLactation) // recordDryOff's own active-lactation lookup
          .mockResolvedValue(null), // refreshProfile()'s lookup afterward
        update: jest.fn().mockResolvedValue({}),
      },
      reproductionProfile: { upsert: jest.fn().mockResolvedValue({}) },
      dryPeriod: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'dryperiod-1', cattleId: 'cattle-1' }),
      },
      breedingEvent: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      pregnancy: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      calvingEvent: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      abortionEvent: { count: jest.fn().mockResolvedValue(0) },
      pregnancyDiagnosis: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    };
    farmSettings = {
      reproVwpDays: jest.fn().mockResolvedValue(60),
      reproDryPeriodTargetDays: jest.fn().mockResolvedValue(60),
    };
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
  });

  const make = () =>
    new ReproductionService(
      prisma as never,
      { applyEvent: jest.fn() } as never, // AqrService (unused)
      { createInternal: jest.fn() } as never, // TaskService (unused)
      {} as never, // SemenService (unused)
      {} as never, // FinanceService (unused)
      { scheduleCareReminders: jest.fn() } as never, // CalfService (unused)
      farmSettings as never,
      { activeHoldsForCattle: jest.fn() } as never, // AnimalHoldService (unused)
      logger as never,
      { refreshDerivedState: jest.fn().mockResolvedValue(undefined) } as never, // ReproductionDerivationService
    );

  it('stamps endReason: DRY_OFF on the closed Lactation', async () => {
    const service = make();

    await service.recordDryOff('farm-1', 'cattle-1', {});

    expect(prisma.lactation.update).toHaveBeenCalledWith({
      where: { id: 'lactation-1' },
      data: expect.objectContaining({
        status: 'ENDED',
        endReason: 'DRY_OFF',
      }) as unknown,
    });
  });
});

/**
 * RAKHAL-285 — dynamic, pregnancy-driven `Lactation.recommendedDryOffAt`
 * projection. `createPregnancyDiagnosis` recomputes it on a PREGNANT
 * diagnosis (`expectedCalvingDate - reproDryPeriodTargetDays`);
 * `createAbortionEvent` clears it back to null on pregnancy loss (the
 * `Lactation` row itself — status/endDate — stays untouched, she keeps
 * milking). Confirms the REDESIGNED spec (not a fixed 305-day target): the
 * projected date tracks a live `Pregnancy.expectedCalvingDate`, and moves
 * exactly with it.
 */
describe('ReproductionService — RAKHAL-285 dry-off projection recompute', () => {
  let prisma: {
    cattle: { findFirst: jest.Mock; findUnique: jest.Mock };
    lactation: { updateMany: jest.Mock; findFirst: jest.Mock };
    breedingEvent: {
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    pregnancy: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    pregnancyDiagnosis: { create: jest.Mock; findFirst: jest.Mock };
    calvingEvent: { count: jest.Mock; findFirst: jest.Mock };
    abortionEvent: { create: jest.Mock; count: jest.Mock };
    reproductionProfile: { upsert: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let farmSettings: {
    reproVwpDays: jest.Mock;
    reproDryPeriodTargetDays: jest.Mock;
  };
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock };

  const cattleRow = {
    id: 'cattle-1',
    farmId: 'farm-1',
    gender: CattleGender.FEMALE,
    tagNumber: 'TAG-1',
  };

  beforeEach(() => {
    prisma = {
      cattle: {
        findFirst: jest.fn().mockResolvedValue(cattleRow),
        findUnique: jest.fn().mockResolvedValue(cattleRow),
      },
      lactation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      breedingEvent: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      pregnancy: {
        create: jest.fn().mockResolvedValue({
          id: 'pregnancy-1',
          expectedCalvingDate: new Date('2027-01-01T00:00:00.000Z'),
          breedingEventId: null,
        }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      pregnancyDiagnosis: {
        create: jest.fn().mockResolvedValue({ id: 'diag-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      calvingEvent: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      abortionEvent: {
        create: jest.fn().mockResolvedValue({ id: 'abortion-1' }),
        count: jest.fn().mockResolvedValue(0),
      },
      reproductionProfile: { upsert: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      ),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    farmSettings = {
      reproVwpDays: jest.fn().mockResolvedValue(60),
      reproDryPeriodTargetDays: jest.fn().mockResolvedValue(60),
    };
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
  });

  const make = () =>
    new ReproductionService(
      prisma as never,
      { applyEvent: jest.fn() } as never, // AqrService (unused)
      { createInternal: jest.fn() } as never, // TaskService (unused)
      {} as never, // SemenService (unused)
      {} as never, // FinanceService (unused)
      { scheduleCareReminders: jest.fn() } as never, // CalfService (unused)
      farmSettings as never,
      { activeHoldsForCattle: jest.fn() } as never, // AnimalHoldService (unused)
      logger as never,
      { refreshDerivedState: jest.fn().mockResolvedValue(undefined) } as never, // ReproductionDerivationService
    );

  it('createPregnancyDiagnosis(PREGNANT) recomputes recommendedDryOffAt = expectedCalvingDate - dryPeriodDays on the dam active Lactation', async () => {
    const service = make();

    await service.createPregnancyDiagnosis('farm-1', 'user-1', {
      cattleId: 'cattle-1',
      diagnosisDate: '2026-06-01',
      result: 'PREGNANT',
      diagnosisMethod: 'ULTRASOUND',
      expectedCalvingDate: '2027-01-01',
    } as never);

    expect(farmSettings.reproDryPeriodTargetDays).toHaveBeenCalledWith(
      'farm-1',
    );
    expect(prisma.lactation.updateMany).toHaveBeenCalledWith({
      where: { cattleId: 'cattle-1', status: 'ACTIVE' },
      data: { recommendedDryOffAt: new Date('2026-11-02T00:00:00.000Z') },
    });
  });

  it('createPregnancyDiagnosis(NOT_PREGNANT) never touches recommendedDryOffAt', async () => {
    const service = make();

    await service.createPregnancyDiagnosis('farm-1', 'user-1', {
      cattleId: 'cattle-1',
      diagnosisDate: '2026-06-01',
      result: 'NOT_PREGNANT',
      diagnosisMethod: 'ULTRASOUND',
    } as never);

    expect(prisma.lactation.updateMany).not.toHaveBeenCalled();
  });

  it('createAbortionEvent clears recommendedDryOffAt on the dam active Lactation without touching its status/endDate', async () => {
    const service = make();

    await service.createAbortionEvent('farm-1', {
      cattleId: 'cattle-1',
      abortionDate: '2026-08-01',
    });

    expect(prisma.lactation.updateMany).toHaveBeenCalledWith({
      where: { cattleId: 'cattle-1', status: 'ACTIVE' },
      data: { recommendedDryOffAt: null },
    });
    expect(prisma.lactation.updateMany).toHaveBeenCalledTimes(1);
  });
});

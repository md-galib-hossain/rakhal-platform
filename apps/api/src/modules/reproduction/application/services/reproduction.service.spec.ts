import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BreedingStatus, CalvingEase, CattleGender } from '@prisma/client';
import { CreateDryOffDto } from '../../presentation/dto/create-dry-off.dto';
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
        // First call (outside the transaction) computes `calvingNumber` from
        // the pre-existing count; second call (inside the transaction, after
        // the new CalvingEvent row is created) computes `totalCalvings` —
        // this cow's very first calving, so both resolve consistently. A
        // third call happens inside `refreshProfile()`'s own independent
        // re-derivation after the transaction — same value, falls back to
        // the default `mockResolvedValue`.
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
  });

  const make = () =>
    new ReproductionService(
      prisma as never,
      aqrService as never, // AqrService
      taskService as never, // TaskService
      {} as never, // SemenService (unused by createCalvingEvent)
      { scheduleCareReminders: jest.fn() } as never, // CalfService
      farmSettings as never, // FarmSettingsService
      { activeHoldsForCattle: jest.fn() } as never, // AnimalHoldService (unused here)
      logger as never,
    );

  it('writes ReproductionProfile.totalCalvings inside the same $transaction as the CalvingEvent + MILKING flip, before refreshProfile() runs again', async () => {
    const service = make();

    await service.createCalvingEvent('farm-1', 'user-1', {
      cattleId: 'cattle-1',
      calvingDate: '2026-08-06',
      calvingEase: CalvingEase.NORMAL,
    });

    // Two reproductionProfile.upsert calls total: the in-transaction write
    // this fix adds, then refreshProfile()'s own post-transaction write.
    expect(prisma.reproductionProfile.upsert).toHaveBeenCalledTimes(2);

    // The FIRST call — proven by call order, not by re-deriving from a
    // second refreshProfile() round-trip — already carries the correct
    // totalCalvings, computed from a `tx.calvingEvent.count()` that ran
    // inside the same transaction as the CalvingEvent create + the
    // productionStatus:MILKING flip.
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
  });
});

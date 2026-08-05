import { BreedingStatus, CattleGender } from '@prisma/client';
import {
  deriveReproductionState,
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

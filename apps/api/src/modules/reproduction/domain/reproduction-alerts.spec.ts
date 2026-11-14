import { BreedingStatus } from '@prisma/client';
import {
  deriveReproductionAlerts,
  ReproductionAlertsInput,
} from './reproduction-alerts';

/**
 * RAKHAL-271's correction pass covered the date-window-based alerts
 * (`HEAT_DETECTED`/`PREGNANCY_CHECK_DUE`/`CALVING_DUE`) that v1's now-removed
 * `IN_HEAT`/`PREGNANCY_CHECK_DUE`/`EXPECTED_TO_CALVE` branches used to cover.
 * This ticket (RAKHAL-272) covers the remaining counters/history-based
 * alerts (`OVERDUE_PREGNANCY_CHECK`, `REPEAT_BREEDER`, `LONG_DAYS_OPEN`,
 * `ABORTION_HISTORY`), the hold-based one (`REPRODUCTIVE_HOLD`, backed by
 * RAKHAL-280's `AnimalHold`), and `CALVING_OVERDUE` (this ticket's own
 * extension to close the `ReproductionAlert` union — see the file-level doc
 * comment in `reproduction-alerts.ts`).
 */
describe('deriveReproductionAlerts', () => {
  const now = new Date('2026-08-05T00:00:00.000Z');
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const daysFromNow = (days: number) =>
    new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const base: ReproductionAlertsInput = {
    now,
    reproductionState: 'OPEN',
    recentHeat: null,
    heatWindowDays: 3,
    lastBreeding: null,
    currentPregnancy: null,
    closeUpWindowDays: 21,
    overdueCheckDays: 7,
    calvingOverdueDays: 7,
    breedingsSinceLastSuccess: 0,
    repeatBreederThreshold: 3,
    daysOpen: null,
    longDaysOpenThresholdDays: 120,
    totalAbortions: 0,
    hasReproductiveHold: false,
  };

  it('returns no alerts when nothing is due', () => {
    expect(deriveReproductionAlerts(base)).toEqual([]);
  });

  it('flags HEAT_DETECTED for a heat event inside the window', () => {
    expect(
      deriveReproductionAlerts({
        ...base,
        recentHeat: { heatDateTime: daysAgo(1) },
      }),
    ).toEqual(['HEAT_DETECTED']);
  });

  it('does not flag a stale heat event outside the window', () => {
    expect(
      deriveReproductionAlerts({
        ...base,
        recentHeat: { heatDateTime: daysAgo(10) },
        heatWindowDays: 3,
      }),
    ).toEqual([]);
  });

  it('flags PREGNANCY_CHECK_DUE once past the expected check date', () => {
    expect(
      deriveReproductionAlerts({
        ...base,
        reproductionState: 'BRED_AWAITING_CONFIRMATION',
        lastBreeding: {
          status: BreedingStatus.PENDING_CHECK,
          expectedPregnancyCheckDate: daysAgo(2),
        },
      }),
    ).toEqual(['PREGNANCY_CHECK_DUE']);
  });

  it('does not flag PREGNANCY_CHECK_DUE before the expected check date', () => {
    expect(
      deriveReproductionAlerts({
        ...base,
        reproductionState: 'BRED_AWAITING_CONFIRMATION',
        lastBreeding: {
          status: BreedingStatus.PENDING_CHECK,
          expectedPregnancyCheckDate: daysFromNow(10),
        },
      }),
    ).toEqual([]);
  });

  describe('OVERDUE_PREGNANCY_CHECK', () => {
    it('escalates PREGNANCY_CHECK_DUE once past the overdue grace period', () => {
      expect(
        deriveReproductionAlerts({
          ...base,
          reproductionState: 'BRED_AWAITING_CONFIRMATION',
          lastBreeding: {
            status: BreedingStatus.PENDING_CHECK,
            // Due 10 days ago, grace period is 7 days → 3 days past the
            // overdue cutoff.
            expectedPregnancyCheckDate: daysAgo(10),
          },
          overdueCheckDays: 7,
        }),
      ).toEqual(['PREGNANCY_CHECK_DUE', 'OVERDUE_PREGNANCY_CHECK']);
    });

    it('does not escalate before the overdue grace period elapses', () => {
      expect(
        deriveReproductionAlerts({
          ...base,
          reproductionState: 'BRED_AWAITING_CONFIRMATION',
          lastBreeding: {
            status: BreedingStatus.PENDING_CHECK,
            // Due 5 days ago, grace period is 7 days → not yet overdue.
            expectedPregnancyCheckDate: daysAgo(5),
          },
          overdueCheckDays: 7,
        }),
      ).toEqual(['PREGNANCY_CHECK_DUE']);
    });
  });

  describe('REPEAT_BREEDER', () => {
    it('fires once breedingsSinceLastSuccess reaches the threshold', () => {
      expect(
        deriveReproductionAlerts({
          ...base,
          breedingsSinceLastSuccess: 3,
          repeatBreederThreshold: 3,
        }),
      ).toEqual(['REPEAT_BREEDER']);
    });

    it('does not fire below the threshold', () => {
      expect(
        deriveReproductionAlerts({
          ...base,
          breedingsSinceLastSuccess: 2,
          repeatBreederThreshold: 3,
        }),
      ).toEqual([]);
    });

    it('does not fire for a currently PREGNANT cow, even above threshold', () => {
      expect(
        deriveReproductionAlerts({
          ...base,
          reproductionState: 'PREGNANT',
          breedingsSinceLastSuccess: 5,
          repeatBreederThreshold: 3,
        }),
      ).toEqual([]);
    });
  });

  describe('LONG_DAYS_OPEN', () => {
    it('fires once daysOpen reaches the threshold', () => {
      expect(
        deriveReproductionAlerts({
          ...base,
          daysOpen: 120,
          longDaysOpenThresholdDays: 120,
        }),
      ).toEqual(['LONG_DAYS_OPEN']);
    });

    it('does not fire below the threshold', () => {
      expect(
        deriveReproductionAlerts({
          ...base,
          daysOpen: 119,
          longDaysOpenThresholdDays: 120,
        }),
      ).toEqual([]);
    });

    it('does not fire when daysOpen is null (never calved)', () => {
      expect(
        deriveReproductionAlerts({
          ...base,
          daysOpen: null,
          longDaysOpenThresholdDays: 0,
        }),
      ).toEqual([]);
    });

    it('does not fire for a currently PREGNANT cow, even above threshold', () => {
      expect(
        deriveReproductionAlerts({
          ...base,
          reproductionState: 'PREGNANT',
          daysOpen: 500,
          longDaysOpenThresholdDays: 120,
        }),
      ).toEqual([]);
    });
  });

  it('flags CALVING_DUE for a PREGNANT cow inside the close-up window', () => {
    expect(
      deriveReproductionAlerts({
        ...base,
        reproductionState: 'PREGNANT',
        currentPregnancy: { expectedCalvingDate: daysFromNow(10) },
        closeUpWindowDays: 21,
      }),
    ).toEqual(['CALVING_DUE']);
  });

  it('does not flag CALVING_DUE outside the close-up window', () => {
    expect(
      deriveReproductionAlerts({
        ...base,
        reproductionState: 'PREGNANT',
        currentPregnancy: { expectedCalvingDate: daysFromNow(100) },
        closeUpWindowDays: 21,
      }),
    ).toEqual([]);
  });

  it('does not flag CALVING_DUE when the core state is not PREGNANT', () => {
    expect(
      deriveReproductionAlerts({
        ...base,
        reproductionState: 'OPEN',
        currentPregnancy: { expectedCalvingDate: daysFromNow(10) },
        closeUpWindowDays: 21,
      }),
    ).toEqual([]);
  });

  describe('CALVING_OVERDUE', () => {
    it('fires once past expectedCalvingDate + grace period', () => {
      expect(
        deriveReproductionAlerts({
          ...base,
          reproductionState: 'PREGNANT',
          // Expected 10 days ago, grace period is 7 days → 3 days past the
          // overdue cutoff. CALVING_DUE also fires (well past the close-up
          // window too).
          currentPregnancy: { expectedCalvingDate: daysAgo(10) },
          closeUpWindowDays: 21,
          calvingOverdueDays: 7,
        }),
      ).toEqual(['CALVING_DUE', 'CALVING_OVERDUE']);
    });

    it('does not fire before the grace period elapses', () => {
      expect(
        deriveReproductionAlerts({
          ...base,
          reproductionState: 'PREGNANT',
          // Expected 3 days ago, grace period is 7 days → not yet overdue.
          currentPregnancy: { expectedCalvingDate: daysAgo(3) },
          closeUpWindowDays: 21,
          calvingOverdueDays: 7,
        }),
      ).toEqual(['CALVING_DUE']);
    });

    it('does not fire when the core state is not PREGNANT', () => {
      expect(
        deriveReproductionAlerts({
          ...base,
          reproductionState: 'OPEN',
          currentPregnancy: { expectedCalvingDate: daysAgo(30) },
          calvingOverdueDays: 7,
        }),
      ).toEqual([]);
    });
  });

  describe('ABORTION_HISTORY', () => {
    it('fires whenever totalAbortions is above zero', () => {
      expect(deriveReproductionAlerts({ ...base, totalAbortions: 1 })).toEqual([
        'ABORTION_HISTORY',
      ]);
    });

    it('does not fire when totalAbortions is zero', () => {
      expect(deriveReproductionAlerts({ ...base, totalAbortions: 0 })).toEqual(
        [],
      );
    });
  });

  describe('REPRODUCTIVE_HOLD', () => {
    it('fires whenever an active REPRODUCTIVE AnimalHold exists', () => {
      expect(
        deriveReproductionAlerts({ ...base, hasReproductiveHold: true }),
      ).toEqual(['REPRODUCTIVE_HOLD']);
    });

    it('does not fire without an active hold', () => {
      expect(
        deriveReproductionAlerts({ ...base, hasReproductiveHold: false }),
      ).toEqual([]);
    });
  });

  it('can return multiple alerts at once', () => {
    expect(
      deriveReproductionAlerts({
        ...base,
        reproductionState: 'PREGNANT',
        recentHeat: { heatDateTime: daysAgo(1) },
        currentPregnancy: { expectedCalvingDate: daysFromNow(10) },
        closeUpWindowDays: 21,
        totalAbortions: 1,
        hasReproductiveHold: true,
      }),
    ).toEqual([
      'HEAT_DETECTED',
      'HEAT_ON_ACTIVE_PREGNANCY',
      'CALVING_DUE',
      'ABORTION_HISTORY',
      'REPRODUCTIVE_HOLD',
    ]);
  });
});

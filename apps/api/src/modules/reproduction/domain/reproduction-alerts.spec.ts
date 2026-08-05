import { BreedingStatus } from '@prisma/client';
import {
  deriveReproductionAlerts,
  ReproductionAlertsInput,
} from './reproduction-alerts';

/**
 * RAKHAL-271's correction pass implements only the date-window-based alerts
 * that v1's now-removed `IN_HEAT`/`PREGNANCY_CHECK_DUE`/`EXPECTED_TO_CALVE`
 * branches used to cover. Counters/history-based alerts (`REPEAT_BREEDER`,
 * `LONG_DAYS_OPEN`, `ABORTION_HISTORY`, `OVERDUE_PREGNANCY_CHECK`) and
 * `REPRODUCTIVE_HOLD` (needs RAKHAL-280's `AnimalHold`) are RAKHAL-272's job.
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

  it('can return multiple alerts at once', () => {
    expect(
      deriveReproductionAlerts({
        ...base,
        reproductionState: 'PREGNANT',
        recentHeat: { heatDateTime: daysAgo(1) },
        currentPregnancy: { expectedCalvingDate: daysFromNow(10) },
        closeUpWindowDays: 21,
      }),
    ).toEqual(['HEAT_DETECTED', 'CALVING_DUE']);
  });
});

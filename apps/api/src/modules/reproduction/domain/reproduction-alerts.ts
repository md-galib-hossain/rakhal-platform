import { BreedingStatus } from '@prisma/client';

/**
 * Derived (not stored) reproduction alerts (RAKHAL-271/272, v2 correction —
 * see `docs/PROJECT_PROGRESS.md` MILESTONE 10 + the v1→v2 plan). v1 had
 * `IN_HEAT`/`PREGNANCY_CHECK_DUE`/`EXPECTED_TO_CALVE` baked into the core
 * `ReproductiveStatus` enum as if they were biological states — a pregnant
 * cow near calving is still `PREGNANT`, not a different state. These are
 * time-bound/history-bound flags layered on top of the 5-value
 * `ReproductionState`, always computed at read time, never persisted.
 *
 * This ticket (RAKHAL-271's correction pass) implements only the
 * date-window-based alerts that the removed v1 branches used to cover:
 * `HEAT_DETECTED`, `PREGNANCY_CHECK_DUE`, `CALVING_DUE`. The
 * counters/history-based alerts (`OVERDUE_PREGNANCY_CHECK`, `REPEAT_BREEDER`,
 * `LONG_DAYS_OPEN`, `ABORTION_HISTORY`) and the hold-based one
 * (`REPRODUCTIVE_HOLD`, needs RAKHAL-280's `AnimalHold`) are RAKHAL-272's job
 * — omitted here rather than stubbed, so callers don't have to special-case a
 * permanently-empty branch.
 */
export type ReproductionAlert =
  | 'HEAT_DETECTED'
  | 'PREGNANCY_CHECK_DUE'
  | 'OVERDUE_PREGNANCY_CHECK'
  | 'REPEAT_BREEDER'
  | 'LONG_DAYS_OPEN'
  | 'CALVING_DUE'
  | 'CALVING_OVERDUE'
  | 'ABORTION_HISTORY'
  | 'REPRODUCTIVE_HOLD';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReproductionAlertsInput {
  now: Date;
  /** Alerts are layered on the already-derived core state (e.g. `CALVING_DUE`
   * only means something for a `PREGNANT` cow). */
  reproductionState:
    | 'NOT_ELIGIBLE'
    | 'POSTPARTUM_WAITING'
    | 'OPEN'
    | 'BRED_AWAITING_CONFIRMATION'
    | 'PREGNANT';
  recentHeat: { heatDateTime: Date } | null;
  heatWindowDays: number;
  lastBreeding: {
    status: BreedingStatus;
    expectedPregnancyCheckDate: Date | null;
  } | null;
  currentPregnancy: { expectedCalvingDate: Date | null } | null;
  closeUpWindowDays: number;
}

/**
 * Pure alert derivation. No framework/Prisma imports (besides the
 * `BreedingStatus` enum, a value type, not a service dependency) — mirrors
 * `deriveReproductionState`'s testability-without-a-Prisma-double pattern.
 */
export function deriveReproductionAlerts(
  input: ReproductionAlertsInput,
): ReproductionAlert[] {
  const {
    now,
    reproductionState,
    recentHeat,
    heatWindowDays,
    lastBreeding,
    currentPregnancy,
    closeUpWindowDays,
  } = input;

  const alerts: ReproductionAlert[] = [];

  if (recentHeat) {
    const heatCutoff = new Date(now.getTime() - heatWindowDays * DAY_MS);
    if (recentHeat.heatDateTime >= heatCutoff) {
      alerts.push('HEAT_DETECTED');
    }
  }

  if (lastBreeding?.status === BreedingStatus.PENDING_CHECK) {
    const dueDate = lastBreeding.expectedPregnancyCheckDate;
    if (dueDate && now > dueDate) {
      alerts.push('PREGNANCY_CHECK_DUE');
    }
  }

  if (
    reproductionState === 'PREGNANT' &&
    currentPregnancy?.expectedCalvingDate
  ) {
    const closeUpCutoff = new Date(
      currentPregnancy.expectedCalvingDate.getTime() -
        closeUpWindowDays * DAY_MS,
    );
    if (now >= closeUpCutoff) {
      alerts.push('CALVING_DUE');
    }
  }

  return alerts;
}

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
 * RAKHAL-271's correction pass implemented the date-window-based alerts that
 * the removed v1 branches used to cover: `HEAT_DETECTED`, `PREGNANCY_CHECK_DUE`,
 * `CALVING_DUE`. This ticket (RAKHAL-272) adds the remaining counters/history-
 * based alerts (`OVERDUE_PREGNANCY_CHECK`, `REPEAT_BREEDER`, `LONG_DAYS_OPEN`,
 * `ABORTION_HISTORY`) and the hold-based one (`REPRODUCTIVE_HOLD`, reads
 * RAKHAL-280's `AnimalHold`).
 *
 * `CALVING_OVERDUE` is also implemented here even though 272's own acceptance
 * criteria in `docs/PROJECT_PROGRESS.md` don't list it explicitly (only
 * `REPEAT_BREEDER`/`LONG_DAYS_OPEN`/`ABORTION_HISTORY` are named there) — it's
 * a member of the `ReproductionAlert` union that neither 271 nor 272's ticket
 * text actually implements, and leaving it permanently unreachable would be a
 * silent gap in the union. It mirrors `OVERDUE_PREGNANCY_CHECK`'s "further
 * past the plain due-window than a farm-configurable grace period" shape,
 * applied to `CALVING_DUE`/`expectedCalvingDate` instead of the pregnancy-
 * check date.
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
  /**
   * Extra days past `lastBreeding.expectedPregnancyCheckDate` (on top of the
   * plain `PREGNANCY_CHECK_DUE` trigger, which fires as soon as `now` passes
   * the date itself) before `OVERDUE_PREGNANCY_CHECK` also fires. Both alerts
   * can be present at once — `OVERDUE_PREGNANCY_CHECK` doesn't replace
   * `PREGNANCY_CHECK_DUE`, it escalates it.
   */
  overdueCheckDays: number;
  /**
   * Extra days past `currentPregnancy.expectedCalvingDate` before
   * `CALVING_OVERDUE` fires (see the file-level doc comment — this alert is
   * this ticket's own extension to close the `ReproductionAlert` union, not
   * explicitly named in RAKHAL-272's acceptance criteria).
   */
  calvingOverdueDays: number;
  /**
   * Count of `BreedingEvent`s recorded since the cow's last calving (or, if
   * she's never calved, her whole breeding history), used for
   * `REPEAT_BREEDER`. The caller is responsible for the "since last success"
   * windowing — this function only compares the count against the threshold.
   */
  breedingsSinceLastSuccess: number;
  /** `REPEAT_BREEDER` fires once `breedingsSinceLastSuccess` reaches this. */
  repeatBreederThreshold: number;
  /**
   * Days since the cow's last calving (or `null` if she's never calved),
   * used for `LONG_DAYS_OPEN`. Only meaningful while she isn't currently
   * pregnant — the caller doesn't need to pre-gate this, the derivation
   * already skips the alert for `reproductionState === 'PREGNANT'`.
   */
  daysOpen: number | null;
  /** `LONG_DAYS_OPEN` fires once `daysOpen` reaches this. */
  longDaysOpenThresholdDays: number;
  /** `ReproductionProfile.totalAbortions` — presence-only check (see doc). */
  totalAbortions: number;
  /**
   * Whether an active `AnimalHold` of type `REPRODUCTIVE` exists for this
   * cow (RAKHAL-280). The caller resolves this via
   * `AnimalHoldService.activeHoldsForCattle(farmId, cattleId, 'REPRODUCTIVE')`
   * — this pure function only sees the boolean result.
   */
  hasReproductiveHold: boolean;
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
    overdueCheckDays,
    calvingOverdueDays,
    breedingsSinceLastSuccess,
    repeatBreederThreshold,
    daysOpen,
    longDaysOpenThresholdDays,
    totalAbortions,
    hasReproductiveHold,
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

      const overdueCutoff = new Date(
        dueDate.getTime() + overdueCheckDays * DAY_MS,
      );
      if (now > overdueCutoff) {
        alerts.push('OVERDUE_PREGNANCY_CHECK');
      }
    }
  }

  // "No successful outcome" is implied by not currently being PREGNANT — if
  // the cow is pregnant, her most recent attempt (or an earlier one still
  // being carried) succeeded, so the streak of failures is over.
  if (
    reproductionState !== 'PREGNANT' &&
    breedingsSinceLastSuccess >= repeatBreederThreshold
  ) {
    alerts.push('REPEAT_BREEDER');
  }

  if (
    reproductionState !== 'PREGNANT' &&
    daysOpen !== null &&
    daysOpen >= longDaysOpenThresholdDays
  ) {
    alerts.push('LONG_DAYS_OPEN');
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

    const calvingOverdueCutoff = new Date(
      currentPregnancy.expectedCalvingDate.getTime() +
        calvingOverdueDays * DAY_MS,
    );
    if (now > calvingOverdueCutoff) {
      alerts.push('CALVING_OVERDUE');
    }
  }

  if (totalAbortions > 0) {
    alerts.push('ABORTION_HISTORY');
  }

  if (hasReproductiveHold) {
    alerts.push('REPRODUCTIVE_HOLD');
  }

  return alerts;
}

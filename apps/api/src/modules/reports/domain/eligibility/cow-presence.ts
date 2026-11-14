/** Half-open reporting window `[start, end)`. Plain Date inputs only (period module is independent). */
export interface PresencePeriod {
  start: Date;
  end: Date;
  /**
   * Inclusive farm-civil first/last day (`YYYY-MM-DD`, from ReportPeriod). When BOTH are given, the
   * date-only fields (`enteredAt`, `dispositionDate`) are compared as civil dates against them instead of
   * as instants, so a UTC-midnight date-only value is not shifted a day on farms west of UTC.
   */
  startDate?: string;
  endDate?: string;
}

/** A date-only value is stored at UTC midnight: its civil date is its UTC calendar date. */
const civilDate = (d: Date): string => d.toISOString().slice(0, 10);

export interface CowPresenceInput {
  /** Approved but not-yet-existing `Cattle.enteredHerdAt`. */
  enteredAt?: Date | null;
  createdAt: Date;
  /** CattleDisposition.date (NOT soldAt). */
  dispositionDate?: Date | null;
  deletedAt?: Date | null;
}

export type EntrySource = 'enteredAt' | 'createdAt';

export type AbsentReason =
  | 'deleted'
  | 'entered_after_period'
  | 'exited_before_period';

export interface PresenceResult {
  present: boolean;
  /** createdAt is only a proxy for herd entry: reports should note it. */
  entrySource: EntrySource;
  reason: AbsentReason | null;
}

/**
 * Presence rule (EPIC_REPORTS section 3/5):
 * entry = enteredAt ?? createdAt; exit = disposition date.
 * present iff entry < period.end AND (no exit OR exit >= period.start).
 * Soft delete means a mistaken/duplicate record: excluded entirely once deletedAt <= generatedAt.
 */
export function evaluatePresence(
  cow: CowPresenceInput,
  period: PresencePeriod,
  generatedAt: Date = new Date(),
): PresenceResult {
  const entrySource: EntrySource = cow.enteredAt ? 'enteredAt' : 'createdAt';
  const result = (
    present: boolean,
    reason: AbsentReason | null,
  ): PresenceResult => ({ present, entrySource, reason });
  if (cow.deletedAt && cow.deletedAt.getTime() <= generatedAt.getTime())
    return result(false, 'deleted');

  const { startDate, endDate } = period;
  // enteredAt / dispositionDate are date-only (civil compare when the period carries civil dates);
  // createdAt and deletedAt are true timestamps (instant compare).
  const enteredAfter =
    cow.enteredAt && endDate !== undefined
      ? civilDate(cow.enteredAt) > endDate
      : (cow.enteredAt ?? cow.createdAt).getTime() >= period.end.getTime();
  if (enteredAfter) return result(false, 'entered_after_period');

  let exitedBefore = false;
  if (cow.dispositionDate) {
    exitedBefore =
      startDate !== undefined
        ? civilDate(cow.dispositionDate) < startDate
        : cow.dispositionDate.getTime() < period.start.getTime();
  }
  if (exitedBefore) return result(false, 'exited_before_period');
  return result(true, null);
}

export function isPresentDuring(
  cow: CowPresenceInput,
  period: PresencePeriod,
  generatedAt: Date = new Date(),
): boolean {
  return evaluatePresence(cow, period, generatedAt).present;
}

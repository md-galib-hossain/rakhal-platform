/**
 * Feeding look-ahead (MILESTONE 27, RAKHAL-459a). A cow's requirement changes at dry-off, around calving and
 * as she climbs to peak milk, so the grid tells the farmer *before* the plan stops fitting. Pure: dates in,
 * upcoming events out.
 */

export type LookaheadKind = 'dry_off' | 'calving' | 'peak_dim';

export interface LookaheadEvent {
  kind: LookaheadKind;
  /** Whole days from `now` (UTC dates). Negative = overdue, only for an event that has not been recorded yet. */
  in_days: number;
}

/** Days in milk at which a lactation is assumed to peak when no peak has been recorded. */
export const ASSUMED_PEAK_DIM = 60;

export interface LookaheadInput {
  now: Date;
  windowDays: number;
  /** `Pregnancy.expectedCalvingDate` of her ACTIVE pregnancy. */
  expectedCalvingDate?: Date | null;
  /** `plannedDryOffAt`, else `recommendedDryOffAt`, of her ACTIVE lactation. */
  dryOffDate?: Date | null;
  /** Start of her ACTIVE lactation. */
  lactationStart?: Date | null;
  /** Recorded peak of the ACTIVE lactation; once set, the peak is behind her. */
  peakDaysInMilk?: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const utcDay = (d: Date) =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

const daysUntil = (target: Date, now: Date) =>
  Math.round((utcDay(target) - utcDay(now)) / MS_PER_DAY);

/**
 * Calving and dry-off stay listed while overdue (the pregnancy / lactation is still open, so the change is
 * still ahead of her in practice). The assumed peak is only listed inside the window and never once a peak
 * has been recorded.
 */
export function computeLookahead(input: LookaheadInput): LookaheadEvent[] {
  const { now, windowDays } = input;
  const events: LookaheadEvent[] = [];

  if (input.dryOffDate) {
    const d = daysUntil(input.dryOffDate, now);
    if (d <= windowDays) events.push({ kind: 'dry_off', in_days: d });
  }
  if (input.expectedCalvingDate) {
    const d = daysUntil(input.expectedCalvingDate, now);
    if (d <= windowDays) events.push({ kind: 'calving', in_days: d });
  }
  if (input.lactationStart && input.peakDaysInMilk == null) {
    const peak = new Date(
      utcDay(input.lactationStart) + ASSUMED_PEAK_DIM * MS_PER_DAY,
    );
    const d = daysUntil(peak, now);
    if (d >= 0 && d <= windowDays)
      events.push({ kind: 'peak_dim', in_days: d });
  }

  return events.sort((a, b) => a.in_days - b.in_days);
}

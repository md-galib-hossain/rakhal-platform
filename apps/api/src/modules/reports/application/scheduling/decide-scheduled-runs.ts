import type { ReportPeriod } from '../../domain/contracts/period';
import { scheduledReportKey } from '../../domain/contracts/job-key';
import {
  closedPeriodFor,
  previousEquivalentPeriod,
  scheduledRunInstant,
} from '../../domain/period';
import { HOUR_MS, SCHEDULE_CATCH_UP_PERIODS } from './scheduling.constants';

export type ScheduledType = 'WEEKLY' | 'MONTHLY';
export const SCHEDULED_TYPES: readonly ScheduledType[] = ['WEEKLY', 'MONTHLY'];

export interface DecideScheduledRunsInput {
  farmId: string;
  now: Date;
  farmTimezone: string;
  farmCreatedAt: Date;
  /** Latest effective template version per type; a type without one is not scheduled. */
  templates: Partial<Record<ScheduledType, { version: number }>>;
  /** Closed periods considered, newest first. Defaults to the current closed period + the one before. */
  catchUpPeriods?: number;
}

export interface DueScheduledRun {
  type: ScheduledType;
  period: ReportPeriod;
  /** 00:00 farm-local on the day after the period ends. */
  runInstant: Date;
  templateVersion: number;
  scheduledKey: string;
}

export interface MissedSchedule {
  type: ScheduledType;
  periodStartDate: string;
}

export interface DecideScheduledRunsResult {
  due: DueScheduledRun[];
  /**
   * The period right outside the catch-up window, when the farm already existed during it. These are NOT
   * back-filled; the sweep counts one as 'missed' only when no scheduled report exists for it.
   */
  missedCandidates: MissedSchedule[];
}

/**
 * Pure: which scheduled reports are due for one farm at `now`. No I/O, no clock reads.
 * Due = a closed Mon-Sun week / calendar month whose run instant (00:00 farm-local after it ends) is <= now,
 * limited to the catch-up window, and which did not end before the farm was created.
 */
export function decideScheduledRuns(
  input: DecideScheduledRunsInput,
): DecideScheduledRunsResult {
  const { farmId, now, farmTimezone, farmCreatedAt, templates } = input;
  const window = input.catchUpPeriods ?? SCHEDULE_CATCH_UP_PERIODS;
  const due: DueScheduledRun[] = [];
  const missedCandidates: MissedSchedule[] = [];

  for (const type of SCHEDULED_TYPES) {
    const template = templates[type];
    if (!template) continue;

    let period = closedPeriodFor(type, now, farmTimezone);
    // `window` periods are eligible; one more is inspected only to report a missed schedule.
    for (let i = 0; i <= window; i += 1) {
      const existedDuring =
        new Date(period.end).getTime() > farmCreatedAt.getTime();
      if (!existedDuring) break; // older periods ended before the farm existed
      if (i < window) {
        const runInstant = scheduledRunInstant(period, farmTimezone);
        if (runInstant.getTime() <= now.getTime()) {
          due.push({
            type,
            period,
            runInstant,
            templateVersion: template.version,
            scheduledKey: scheduledReportKey({
              farmId,
              type,
              periodStartDate: period.startDate,
              templateVersion: template.version,
            }),
          });
        }
      } else {
        missedCandidates.push({ type, periodStartDate: period.startDate });
      }
      period = previousEquivalentPeriod(period, now).previous;
    }
  }
  return { due, missedCandidates };
}

/**
 * True while a scheduled run may still defer for unsubmitted milk drafts: `now` is before the run instant plus
 * the template's wait. An absent / non-finite / negative wait means no waiting.
 */
export function withinFinalizationWindow(
  now: Date,
  runInstant: Date,
  maxWaitHours: unknown,
): boolean {
  const hours =
    typeof maxWaitHours === 'number' &&
    Number.isFinite(maxWaitHours) &&
    maxWaitHours > 0
      ? maxWaitHours
      : 0;
  return now.getTime() < runInstant.getTime() + hours * HOUR_MS;
}

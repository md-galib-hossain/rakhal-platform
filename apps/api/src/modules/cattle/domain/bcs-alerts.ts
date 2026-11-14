/**
 * Body Condition Score alerts (PRD §8.6). Pure function (no Prisma/framework):
 * given the new score, its date, the cow's expected calving date, and the most
 * recent prior score within the look-back window, it returns the alerts to raise.
 */
import {
  BCS_DROP_THRESHOLD,
  BCS_DROP_WINDOW_DAYS,
  BCS_NEAR_CALVING_HIGH,
  BCS_NEAR_CALVING_LOW,
  BCS_NEAR_CALVING_WINDOW_DAYS,
} from './cattle.constants';

export interface BcsAlert {
  level: 'orange' | 'yellow';
  code: string;
  message: string;
}

export interface BcsAlertInput {
  score: number;
  recordedDate: Date;
  /** Expected calving date of the cow's active pregnancy, if any. */
  expectedCalvingDate?: Date | null;
  /** Most recent BCS recorded within `BCS_DROP_WINDOW_DAYS` before this one. */
  priorScore?: number | null;
}

const DAY_MS = 1000 * 60 * 60 * 24;

const round = (value: number) => Math.round(value * 100) / 100;

export function computeBcsAlerts(input: BcsAlertInput): BcsAlert[] {
  const alerts: BcsAlert[] = [];
  const { score, recordedDate, expectedCalvingDate, priorScore } = input;

  // Near-calving deviation: within ~3 weeks of expected calving (PRD §8.6).
  if (expectedCalvingDate) {
    const daysToCalving = Math.round(
      (expectedCalvingDate.getTime() - recordedDate.getTime()) / DAY_MS,
    );
    if (Math.abs(daysToCalving) <= BCS_NEAR_CALVING_WINDOW_DAYS) {
      if (score < BCS_NEAR_CALVING_LOW) {
        alerts.push({
          level: 'orange',
          code: 'bcs_low_near_calving',
          message: `BCS ${score} is below ${BCS_NEAR_CALVING_LOW} within 3 weeks of calving.`,
        });
      } else if (score > BCS_NEAR_CALVING_HIGH) {
        alerts.push({
          level: 'orange',
          code: 'bcs_high_near_calving',
          message: `BCS ${score} is above ${BCS_NEAR_CALVING_HIGH} within 3 weeks of calving (milk-fever risk).`,
        });
      }
    }
  }

  // Excessive mobilization: drop > 1.0 point in < 60 days (PRD §8.6).
  if (
    priorScore !== null &&
    priorScore !== undefined &&
    priorScore - score > BCS_DROP_THRESHOLD
  ) {
    alerts.push({
      level: 'yellow',
      code: 'bcs_excessive_drop',
      message: `BCS dropped ${round(priorScore - score)} points in under ${BCS_DROP_WINDOW_DAYS} days (excessive mobilization).`,
    });
  }

  return alerts;
}

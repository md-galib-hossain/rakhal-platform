import { RenewalStage } from '@prisma/client';

/**
 * Renewal campaign cadence (RAKHAL-240, PRD §36.5). Pre-expiry reminders at
 * T-7/T-3/T-1/expiry-day, post-expiry win-back at T+3/T+7/T+30 (capped — three
 * nudges then churned). Pure config; the admin-tunable cadence/copy is a future
 * seam (RD — mirrors the AQR/coupon admin-config pattern). **No auto-charge.**
 */

export const PRE_EXPIRY_CADENCE: { stage: RenewalStage; daysUntil: number }[] =
  [
    { stage: 'T_MINUS_7', daysUntil: 7 },
    { stage: 'T_MINUS_3', daysUntil: 3 },
    { stage: 'T_MINUS_1', daysUntil: 1 },
    { stage: 'EXPIRY_DAY', daysUntil: 0 },
  ];

export const WINBACK_CADENCE: { stage: RenewalStage; daysSince: number }[] = [
  { stage: 'WINBACK_3', daysSince: 3 },
  { stage: 'WINBACK_7', daysSince: 7 },
  { stage: 'WINBACK_30', daysSince: 30 },
];

/** Whole calendar days from `from` to `to` (UTC-midnight based; sign preserved). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const DAY = 24 * 60 * 60 * 1000;
  const a = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / DAY);
}

/** The pre-expiry stage for a subscription expiring in `daysUntil` days, or null. */
export function preExpiryStageFor(daysUntil: number): RenewalStage | null {
  return (
    PRE_EXPIRY_CADENCE.find((s) => s.daysUntil === daysUntil)?.stage ?? null
  );
}

/** The win-back stage for a subscription that expired `daysSince` days ago, or null. */
export function winbackStageFor(daysSince: number): RenewalStage | null {
  return WINBACK_CADENCE.find((s) => s.daysSince === daysSince)?.stage ?? null;
}

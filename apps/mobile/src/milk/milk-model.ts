/**
 * Data structures and domain rules for the mobile milk log (WP10, ADR-006).
 */
import type { MessageKey } from '../i18n/messages.ts';

export type MilkSession = 'MORNING' | 'NOON' | 'EVENING' | 'NIGHT';

export const DEFAULT_SESSIONS: readonly MilkSession[] = ['MORNING', 'NOON', 'EVENING', 'NIGHT'];

export const SESSION_ACCENTS: Record<MilkSession, 'sessionMorning' | 'sessionNoon' | 'sessionEvening' | 'sessionNight'> = {
  MORNING: 'sessionMorning',
  NOON: 'sessionNoon',
  EVENING: 'sessionEvening',
  NIGHT: 'sessionNight',
};

export const SESSION_LABEL_KEYS: Record<MilkSession, MessageKey> = {
  MORNING: 'milk.session.morning',
  NOON: 'milk.session.noon',
  EVENING: 'milk.session.evening',
  NIGHT: 'milk.session.night',
};

/**
 * Clock-based default session (HANDOVER.md section 4, WP10):
 * - 04:00 - 10:59: MORNING
 * - 11:00 - 15:59: NOON
 * - 16:00 - 19:59: EVENING
 * - 20:00 - 03:59: NIGHT
 */
export function defaultSessionByClock(now: Date = new Date(), configuredSessions?: readonly string[]): MilkSession {
  const hour = now.getHours();
  let preferred: MilkSession;
  if (hour >= 4 && hour < 11) preferred = 'MORNING';
  else if (hour >= 11 && hour < 16) preferred = 'NOON';
  else if (hour >= 16 && hour < 20) preferred = 'EVENING';
  else preferred = 'NIGHT';

  if (configuredSessions && configuredSessions.length > 0) {
    if (configuredSessions.includes(preferred)) return preferred;
    return (configuredSessions[0] as MilkSession) || 'MORNING';
  }
  return preferred;
}

export type MilkEntryStatus = 'saved' | 'waiting' | 'failed' | 'conflict';

export interface MilkCowRow {
  cattleId: string;
  tag: string;
  name: string | null;
  animalCategory: string;
  breedName?: string;
  shedId?: string;
  shedName?: string;
  withholding: boolean;
  withholdingReason?: string;
  yieldL: number | null;
  prevDayYieldL?: number;
  avgYield7d?: number;
  anomalyFlag: boolean;
  status: MilkEntryStatus | null;
  baseUpdatedAt: string | null;
  outboxLocalId?: string;
  isSubmitted: boolean;
}

export interface MilkTotals {
  totalL: number;
  sellableL: number;
  withheldL: number;
  loggedCount: number;
  totalCows: number;
}

export const QUICK_YIELD_PRESETS = [0.5, 1.0, 5.0] as const;

/**
 * Check whether a yield reading represents an anomaly:
 * - Server already flagged it as anomaly (`anomalyFlag: true`)
 * - Or a >30% drop from the 7-day average (when avgYield7d > 0 and yieldL > 0)
 */
export function isMilkAnomaly(yieldL: number | null, avgYield7d?: number, serverAnomaly?: boolean): boolean {
  if (serverAnomaly) return true;
  if (yieldL === null || yieldL <= 0 || !avgYield7d || avgYield7d <= 0) return false;
  return yieldL < avgYield7d * 0.7;
}

/**
 * Get date string formatted as YYYY-MM-DD.
 */
export function toIsoDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

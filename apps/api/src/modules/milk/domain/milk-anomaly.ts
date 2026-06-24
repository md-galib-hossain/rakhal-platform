/**
 * Pure milk-production domain helpers (PRD §10). No framework/Prisma deps so
 * they are trivially unit-testable. Anomaly detection (a session yield that has
 * dropped sharply vs the cow's recent average) and the session config live here.
 */
import { MilkSession } from '@prisma/client';

/** A session is anomalous when it falls below this fraction of the 7-day average (PRD §10.2). */
export const ANOMALY_THRESHOLD = 0.7;

/**
 * Sessions a farm collects, in order. A farm setting in the full product;
 * defaulted here until Settings (RAKHAL-027+) lands — NIGHT is "not configured".
 */
export const DEFAULT_SESSION_CONFIG: MilkSession[] = [
  MilkSession.MORNING,
  MilkSession.NOON,
  MilkSession.EVENING,
];

/** True when `yieldL` is below 70% of a positive 7-day average (possible health issue). */
export function isAnomaly(yieldL: number, avg7d: number | null): boolean {
  if (avg7d == null || avg7d <= 0) return false;
  return yieldL < ANOMALY_THRESHOLD * avg7d;
}

/** Percentage drop of `yieldL` vs the average (0–100), or null when not computable. */
export function dropPct(yieldL: number, avg7d: number | null): number | null {
  if (avg7d == null || avg7d <= 0) return null;
  return Math.max(0, Math.round((1 - yieldL / avg7d) * 100));
}

/**
 * Pure, framework-free helpers that derive a Medicine's stock and expiry state.
 *
 * Kept in `domain/` so both the service (list presentation) and any future
 * treatment-selection logic (FIFO / expired-blocked) share one source of truth.
 */

/** Days-before-expiry window that counts as "expiring soon" (PRD §15.2). */
export const EXPIRY_SOON_DAYS = 30;

export type StockStatus = 'out' | 'low' | 'adequate';
export type ExpiryStatus = 'expired' | 'expiring_soon' | 'ok';

/**
 * Classify stock level against the configured low-stock threshold.
 * `out` when nothing remains, `low` at/below threshold, else `adequate`.
 */
export function computeStockStatus(
  currentStock: number,
  lowStockThreshold: number,
): StockStatus {
  if (currentStock <= 0) return 'out';
  if (currentStock <= lowStockThreshold) return 'low';
  return 'adequate';
}

/**
 * Classify shelf life relative to `now`.
 * `expired` once the date has passed, `expiring_soon` within
 * {@link EXPIRY_SOON_DAYS}, otherwise `ok`.
 */
export function computeExpiryStatus(
  expiryDate: Date,
  now: Date = new Date(),
): ExpiryStatus {
  if (expiryDate.getTime() <= now.getTime()) return 'expired';

  const soonThreshold = now.getTime() + EXPIRY_SOON_DAYS * 24 * 60 * 60 * 1000;
  if (expiryDate.getTime() <= soonThreshold) return 'expiring_soon';

  return 'ok';
}

/**
 * Whether a medicine is expired as of `now`. Treatment logging must reject
 * expired batches (PRD business rule HLT-02 / INV expiry block).
 */
export function isExpired(expiryDate: Date, now: Date = new Date()): boolean {
  return expiryDate.getTime() <= now.getTime();
}

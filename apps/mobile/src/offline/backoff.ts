/** Retry delays for a queued write that could not reach the server (ADR-006 section 5): 5 s doubling to 15 min, +-20% jitter. */
export const BACKOFF_BASE_MS = 5_000;
export const BACKOFF_MAX_MS = 15 * 60_000;

/** `attempts` is how many times the row has been tried so far (1 after the first failure). */
export function backoffDelayMs(attempts: number, random: () => number = Math.random): number {
  const exponent = Math.max(0, attempts - 1);
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.min(exponent, 20));
  const jitter = 0.8 + random() * 0.4;
  return Math.min(BACKOFF_MAX_MS, Math.round(base * jitter));
}

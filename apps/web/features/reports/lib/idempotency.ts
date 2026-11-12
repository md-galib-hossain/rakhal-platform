import { MAX_IDEMPOTENCY_KEY_LENGTH, type CreateReportRequest } from "../types";

/** Backend accepts `^[A-Za-z0-9._:-]+$`, 1..128 chars (`normaliseIdempotencyKey`). */
const KEY_SHAPE = /^[A-Za-z0-9._:-]+$/;

export function isValidIdempotencyKey(key: string): boolean {
  return key.length > 0 && key.length <= MAX_IDEMPOTENCY_KEY_LENGTH && KEY_SHAPE.test(key);
}

export function newIdempotencyKey(): string {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `rk-rpt-${id}`;
}

/** Order-independent identity of a request, so the same form submitted twice maps to one key. */
export function requestFingerprint(req: CreateReportRequest): string {
  return JSON.stringify({
    t: req.templateId,
    p: req.period,
    s: req.scope,
    m: [...new Set(req.selectedMetricIds)].sort(),
    c: req.compare ?? null,
    f: req.forceNew ?? false,
  });
}

/**
 * One key per *submitted form attempt*. While a submit fails (network drop, 5xx) the SAME key is reused for the
 * identical payload, so a retry can never create a second report (the backend replays it). A different payload gets
 * a fresh key. `settle()` drops the key once the attempt resolved (created or duplicate), so a deliberate later
 * "generate again" (`forceNew`) starts a new attempt.
 */
export function createIdempotencyKeyStore() {
  let fingerprint: string | null = null;
  let key: string | null = null;
  return {
    keyFor(req: CreateReportRequest): string {
      const fp = requestFingerprint(req);
      if (key === null || fp !== fingerprint) {
        fingerprint = fp;
        key = newIdempotencyKey();
      }
      return key;
    },
    settle(): void {
      fingerprint = null;
      key = null;
    },
  };
}

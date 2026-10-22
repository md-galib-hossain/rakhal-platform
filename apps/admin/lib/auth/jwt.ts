/**
 * Reads the `exp` claim (seconds since epoch) from a JWT **without verifying it**.
 * Only used to decide when to refresh; the backend verifies every token.
 */
export function decodeJwtExp(token: string | undefined | null): number | null {
  if (!token) return null;
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

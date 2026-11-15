/** `https://host/api/v1` -> `https://host/health` (the health route sits outside the API prefix). */
export function healthUrl(apiBaseUrl: string): string {
  const trimmed = apiBaseUrl.replace(/\/+$/, '');
  return `${trimmed.replace(/\/api\/v\d+$/, '')}/health`;
}

/**
 * One short request that tells "the phone says it is online" apart from "the server is actually reachable" (captive
 * portals, dead 2G, a sleeping API). Any HTTP answer means reachable; a timeout or network error means not.
 */
export async function probeHealth(
  url: string,
  // The one place the app calls the network outside the typed API client: `/health` is not under `/api/v1` and carries
  // no auth, farm or body, so the client (token refresh, envelope parsing) would only get in the way.
  fetchImpl: typeof fetch = globalThis.fetch,
  timeoutMs = 5_000,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetchImpl(url, { method: 'GET', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

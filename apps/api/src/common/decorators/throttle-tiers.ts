import { Throttle } from '@nestjs/throttler';

/**
 * Named rate-limit tiers.
 *
 * Prefer these over inline `@Throttle({ ... })` literals so the numbers stay
 * comparable across ~53 controllers and can be retuned in one place.
 *
 * All tiers override the **`default`** throttler only. The `global` throttler
 * (see `AppModule`) always applies on top and is what actually caps aggregate
 * traffic per identity — a tier raises or lowers the per-endpoint budget, it
 * never lifts the API-wide ceiling.
 *
 * Untiered routes inherit `default` (RATE_LIMIT_MAX_REQUESTS, 100/min), which
 * is the right answer for ordinary reads: the key includes the handler, so a
 * dashboard fanning out across a dozen endpoints gets a dozen separate budgets.
 */

const MINUTE_MS = 60_000;

/**
 * Credential-checking routes: login, register, password reset, OTP request.
 *
 * `blockDuration` is the point — without it the 6th attempt merely waits out
 * the 60s window. This is per-identity/IP and so complements, rather than
 * duplicates, the per-*account* DB lockout in `AuthService.handleFailedLogin`:
 * it also catches enumeration spread thin across many accounts.
 */
export const ThrottleAuth = () =>
  Throttle({
    default: { ttl: MINUTE_MS, limit: 5, blockDuration: 15 * MINUTE_MS },
  });

/**
 * Routes that cost real CPU, a queue job, or a wide DB scan — report
 * generation and download, search, dashboard rollups.
 */
export const ThrottleExpensive = () =>
  Throttle({ default: { ttl: MINUTE_MS, limit: 10 } });

/**
 * Multipart upload routes. `fileSize` limits already cap a single request;
 * this caps how many such requests one identity may fire per minute.
 */
export const ThrottleUpload = () =>
  Throttle({ default: { ttl: MINUTE_MS, limit: 15 } });

/**
 * Optional tightening for mutations. `default` already caps writes, so reach
 * for this only where a write is unusually costly or abuse-prone.
 */
export const ThrottleWrite = () =>
  Throttle({ default: { ttl: MINUTE_MS, limit: 60 } });

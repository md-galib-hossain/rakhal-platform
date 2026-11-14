import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Stateless cryptographic helpers for non-password secrets.
 *
 * Use these for opaque tokens that must be stored as a hash and compared safely:
 * refresh/verification/reset tokens, API keys, webhook signatures, idempotency
 * keys, etc. **Not for user passwords** — those use Argon2id via
 * `PasswordService`.
 */

/**
 * Generate a cryptographically-random, URL-safe opaque token.
 *
 * Hand the raw value to the client ONCE; persist only its {@link sha256Hex}.
 *
 * @param byteLength Entropy in bytes (default 32 → 256-bit).
 * @example
 * const raw = generateOpaqueToken();          // send to user
 * await repo.save({ tokenHash: sha256Hex(raw) });
 */
export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

/**
 * Deterministic SHA-256 hex digest. Use to store/look up a token by its hash.
 *
 * @example
 * const row = await repo.findByHash(sha256Hex(incomingToken));
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of two hex digests, safe against timing attacks.
 * Returns false (never throws) on length mismatch or malformed input.
 *
 * @example
 * if (!safeEqualHex(sha256Hex(incoming), storedHash)) throw new UnauthorizedException();
 */
export function safeEqualHex(a: string, b: string): boolean {
  try {
    const bufferA = Buffer.from(a, 'hex');
    const bufferB = Buffer.from(b, 'hex');

    if (bufferA.length === 0 || bufferA.length !== bufferB.length) {
      return false;
    }

    return timingSafeEqual(bufferA, bufferB);
  } catch {
    return false;
  }
}

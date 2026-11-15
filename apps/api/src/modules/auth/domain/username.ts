/**
 * WP5b (mobile): usernames are an optional second login handle for password login.
 *
 * Stored lowercase, 3-32 chars of `[a-z0-9._-]`, starting and ending with a letter or digit, never containing `@`
 * (so an identifier is an email exactly when it contains `@`). Unique across all farms (global, case-insensitive).
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

/** Names that would read as staff, system accounts or routes. Compared after normalisation. */
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'rakhal',
  'owner',
  'manager',
  'worker',
  'vet',
  'staff',
  'api',
  'null',
  'undefined',
  'me',
]);

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/** Returns the reason a (normalised) username is rejected, or `null` when it is acceptable. */
export function usernameProblem(
  normalized: string,
): 'length' | 'format' | 'reserved' | null {
  if (
    normalized.length < USERNAME_MIN_LENGTH ||
    normalized.length > USERNAME_MAX_LENGTH
  ) {
    return 'length';
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return 'format';
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    return 'reserved';
  }
  return null;
}

/** A login identifier is an email exactly when it contains `@` (usernames can never contain it). */
export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes('@');
}

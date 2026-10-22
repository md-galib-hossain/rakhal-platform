import { randomInt } from 'crypto';
import { BadRequestException } from '@nestjs/common';

export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_MAX_LENGTH = 128;

/** Returns the unmet rules (empty = acceptable). Pure, so it is unit-testable. */
export function adminPasswordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    problems.push(`at least ${ADMIN_PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > ADMIN_PASSWORD_MAX_LENGTH) {
    problems.push(`at most ${ADMIN_PASSWORD_MAX_LENGTH} characters`);
  }
  if (!/[a-z]/.test(password)) problems.push('a lowercase letter');
  if (!/[A-Z]/.test(password)) problems.push('an uppercase letter');
  if (!/\d/.test(password)) problems.push('a digit');
  if (/\s/.test(password)) problems.push('no whitespace');
  return problems;
}

export function assertAdminPasswordPolicy(password: string): void {
  const problems = adminPasswordProblems(password);
  if (problems.length > 0) {
    throw new BadRequestException(
      `Password must contain ${problems.join(', ')}`,
    );
  }
}

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

/** A policy-compliant, unambiguous one-time password (shown once, then forced to change). */
export function generateTemporaryAdminPassword(length = 16): string {
  const all = LOWER + UPPER + DIGITS;
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(all));
  // Fisher-Yates shuffle with a CSPRNG so the guaranteed classes aren't at fixed spots.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

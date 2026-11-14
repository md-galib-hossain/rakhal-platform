import { redactAuditPayload } from './admin-audit-actions';
import {
  adminPasswordProblems,
  generateTemporaryAdminPassword,
} from './admin-password-policy';

describe('redactAuditPayload', () => {
  it('masks credential-like keys at any depth, keeps the rest', () => {
    const out = redactAuditPayload({
      name: 'ok',
      password: 'p',
      nested: { refreshToken: 't', totpSecret: 's', keep: 1 },
      list: [{ passwordHash: 'h', n: 2 }],
    });
    expect(out).toEqual({
      name: 'ok',
      password: '[REDACTED]',
      nested: { refreshToken: '[REDACTED]', totpSecret: '[REDACTED]', keep: 1 },
      list: [{ passwordHash: '[REDACTED]', n: 2 }],
    });
  });

  it('passes through null, primitives and dates', () => {
    const d = new Date();
    expect(redactAuditPayload(null)).toBeNull();
    expect(redactAuditPayload(5)).toBe(5);
    expect(redactAuditPayload(d)).toBe(d);
  });
});

describe('admin password policy', () => {
  it('accepts a strong password', () => {
    expect(adminPasswordProblems('Another-Strong-Pass-9')).toEqual([]);
  });

  it.each([
    ['short1A', 'at least 12'],
    ['alllowercase12345', 'an uppercase'],
    ['ALLUPPERCASE12345', 'a lowercase'],
    ['NoDigitsInHereAtAll', 'a digit'],
    ['Has Space In It 12345', 'no whitespace'],
  ])('rejects %s', (pw, fragment) => {
    expect(adminPasswordProblems(pw).join(' ')).toContain(fragment);
  });

  it('generates compliant, unique temporary passwords', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const pw = generateTemporaryAdminPassword();
      expect(adminPasswordProblems(pw)).toEqual([]);
      seen.add(pw);
    }
    expect(seen.size).toBe(50);
  });
});

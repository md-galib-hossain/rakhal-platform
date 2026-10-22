import { ForbiddenException } from '@nestjs/common';
import { safeEqualHex, sha256Hex } from 'src/common/crypto/hash.util';
import { AdminIpAllowlistGuard } from '../presentation/guards/admin-ip-allowlist.guard';
import { isIpAllowed, normalizeIp, parseAllowlist } from './ip-allowlist';

const mockEnv: { ADMIN_IP_ALLOWLIST?: string } = {};
jest.mock('src/core/config/env', () => ({
  get env() {
    return mockEnv;
  },
}));

describe('ip allowlist (pure)', () => {
  it('parses and normalises entries', () => {
    expect(parseAllowlist(' 1.2.3.4 , ::FFFF:5.6.7.8,,10.0.0.0/8 ')).toEqual([
      '1.2.3.4',
      '5.6.7.8',
      '10.0.0.0/8',
    ]);
    expect(parseAllowlist(undefined)).toEqual([]);
  });

  it('treats an empty list as disabled', () => {
    expect(isIpAllowed('9.9.9.9', [])).toBe(true);
  });

  it('matches exact IPs, IPv4-mapped IPv6 and IPv6 literals', () => {
    expect(isIpAllowed('::ffff:1.2.3.4', ['1.2.3.4'])).toBe(true);
    expect(isIpAllowed('1.2.3.5', ['1.2.3.4'])).toBe(false);
    expect(isIpAllowed('2001:db8::1', ['2001:db8::1'])).toBe(true);
    expect(isIpAllowed('2001:db8::2', ['2001:db8::1'])).toBe(false);
  });

  it('matches IPv4 CIDRs on the boundary', () => {
    const list = ['203.0.113.0/24'];
    expect(isIpAllowed('203.0.113.0', list)).toBe(true);
    expect(isIpAllowed('203.0.113.255', list)).toBe(true);
    expect(isIpAllowed('203.0.114.0', list)).toBe(false);
    expect(isIpAllowed('10.1.2.3', ['10.0.0.0/8'])).toBe(true);
    expect(isIpAllowed('1.2.3.4', ['0.0.0.0/0'])).toBe(true);
  });

  it('rejects malformed CIDRs and missing client IPs instead of allowing', () => {
    expect(isIpAllowed('1.2.3.4', ['1.2.3.0/40'])).toBe(false);
    expect(isIpAllowed('1.2.3.4', ['nonsense/8'])).toBe(false);
    expect(isIpAllowed(undefined, ['1.2.3.4'])).toBe(false);
    expect(normalizeIp(null)).toBe('');
  });
});

describe('AdminIpAllowlistGuard', () => {
  const guard = new AdminIpAllowlistGuard({
    setContext: () => ({ warn: jest.fn() }),
  } as never);
  const ctx = (ip: string) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ ip, path: '/admin/x' }) }),
    }) as never;

  afterEach(() => {
    delete mockEnv.ADMIN_IP_ALLOWLIST;
  });

  it('is off when the env var is unset', () => {
    expect(guard.canActivate(ctx('8.8.8.8'))).toBe(true);
  });

  it('allows a listed IP and blocks others with a generic 403', () => {
    mockEnv.ADMIN_IP_ALLOWLIST = '203.0.113.0/24,198.51.100.7';
    expect(guard.canActivate(ctx('203.0.113.9'))).toBe(true);
    expect(guard.canActivate(ctx('198.51.100.7'))).toBe(true);
    expect(() => guard.canActivate(ctx('8.8.8.8'))).toThrow(ForbiddenException);
  });
});

const tokensMatch = (a: string, b: string) =>
  safeEqualHex(sha256Hex(a), sha256Hex(b));

describe('metrics token comparison (same recipe as GET /metrics)', () => {
  it('matches only the exact token, of any length', () => {
    expect(tokensMatch('secret-token', 'secret-token')).toBe(true);
    expect(tokensMatch('secret-token', 'secret-tokeN')).toBe(false);
    expect(tokensMatch('short', 'a-much-longer-expected-token')).toBe(false);
    expect(tokensMatch('', 'x')).toBe(false);
  });
});

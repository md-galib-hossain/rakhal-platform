import { deriveHealthStatus } from './health-status';

describe('deriveHealthStatus', () => {
  const now = new Date('2026-06-25T00:00:00Z');
  const future = new Date('2026-07-10T00:00:00Z');
  const past = new Date('2026-06-01T00:00:00Z');

  it('returns HEALTHY when there are no open cases or withdrawals', () => {
    expect(deriveHealthStatus([], [], now)).toBe('HEALTHY');
  });

  it('returns IN_TREATMENT when an open case exists without active withholding', () => {
    expect(
      deriveHealthStatus(
        [{ isSafetyWithholdingActive: false, milkWithdrawalUntil: null }],
        [],
        now,
      ),
    ).toBe('IN_TREATMENT');
  });

  it('returns WITHHOLDING when a safety withdrawal is still active (future date)', () => {
    expect(
      deriveHealthStatus(
        [],
        [{ milkWithdrawalUntil: future, meatWithdrawalUntil: null }],
        now,
      ),
    ).toBe('WITHHOLDING');
  });

  it('withholding takes precedence over an open case', () => {
    expect(
      deriveHealthStatus(
        [{ isSafetyWithholdingActive: true, milkWithdrawalUntil: future }],
        [],
        now,
      ),
    ).toBe('WITHHOLDING');
  });

  it('a past withdrawal date does not count as withholding', () => {
    expect(
      deriveHealthStatus(
        [],
        [{ milkWithdrawalUntil: past, meatWithdrawalUntil: past }],
        now,
      ),
    ).toBe('HEALTHY');
  });

  it('meat-only withholding still flags WITHHOLDING', () => {
    expect(
      deriveHealthStatus(
        [],
        [{ milkWithdrawalUntil: null, meatWithdrawalUntil: future }],
        now,
      ),
    ).toBe('WITHHOLDING');
  });
});

import { deriveHealthStatus, OpenHealthCaseInput } from './health-status';

describe('deriveHealthStatus', () => {
  const now = new Date('2026-06-25T00:00:00Z');
  const future = new Date('2026-07-10T00:00:00Z');
  const past = new Date('2026-06-01T00:00:00Z');

  const activeCase: OpenHealthCaseInput = {
    status: 'ACTIVE',
    isSafetyWithholdingActive: false,
    milkWithdrawalUntil: null,
  };
  const treatingCase: OpenHealthCaseInput = {
    status: 'IMPROVING',
    isSafetyWithholdingActive: false,
    milkWithdrawalUntil: null,
  };

  it('returns HEALTHY when there are no open cases or withdrawals', () => {
    expect(deriveHealthStatus([], [], now)).toBe('HEALTHY');
  });

  it('returns SICK for a freshly reported (ACTIVE) case with no treatment yet', () => {
    expect(deriveHealthStatus([activeCase], [], now)).toBe('SICK');
  });

  it('returns IN_TREATMENT once a case has moved past ACTIVE', () => {
    expect(deriveHealthStatus([treatingCase], [], now)).toBe('IN_TREATMENT');
  });

  it('IN_TREATMENT wins over SICK when both an active and a treating case are open', () => {
    expect(deriveHealthStatus([activeCase, treatingCase], [], now)).toBe(
      'IN_TREATMENT',
    );
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
        [
          {
            status: 'ACTIVE',
            isSafetyWithholdingActive: true,
            milkWithdrawalUntil: future,
          },
        ],
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

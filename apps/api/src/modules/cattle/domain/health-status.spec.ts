import { deriveHealthStatus, OpenHealthCaseInput } from './health-status';

describe('deriveHealthStatus', () => {
  const activeCase: OpenHealthCaseInput = {
    status: 'ACTIVE',
    diagnosisType: 'DISEASE',
  };
  const treatingCase: OpenHealthCaseInput = {
    status: 'IMPROVING',
    diagnosisType: 'DISEASE',
  };
  const vaccinationCase: OpenHealthCaseInput = {
    status: 'ACTIVE',
    diagnosisType: 'VACCINATION',
  };

  it('returns HEALTHY when there are no open cases', () => {
    expect(deriveHealthStatus([])).toBe('HEALTHY');
  });

  it('returns SICK for a freshly reported (ACTIVE) case with no treatment yet', () => {
    expect(deriveHealthStatus([activeCase])).toBe('SICK');
  });

  it('returns IN_TREATMENT once a case has moved past ACTIVE', () => {
    expect(deriveHealthStatus([treatingCase])).toBe('IN_TREATMENT');
  });

  it('IN_TREATMENT wins over SICK when both an active and a treating case are open', () => {
    expect(deriveHealthStatus([activeCase, treatingCase])).toBe('IN_TREATMENT');
  });

  it('returns HEALTHY for an open VACCINATION case — preventive care is not sickness', () => {
    expect(deriveHealthStatus([vaccinationCase])).toBe('HEALTHY');
  });

  it('SICK still wins when a real DISEASE case is open alongside a VACCINATION case', () => {
    expect(deriveHealthStatus([activeCase, vaccinationCase])).toBe('SICK');
  });

  // RAKHAL-279: WITHHOLDING dropped from this dimension — milk eligibility
  // (RAKHAL-278, `deriveMilkEligibility()`) is now the sole owner of that
  // signal. See `docs/DECISIONS.md` for the adjudication. Withholding-related
  // cases are covered by `src/modules/milk/domain/milk-eligibility.spec.ts`.
});

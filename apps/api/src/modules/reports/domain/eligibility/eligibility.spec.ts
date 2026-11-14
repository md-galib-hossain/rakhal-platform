import { evaluatePresence, isPresentDuring } from './cow-presence';
import { resolveScopeCattleIds } from './scope-resolver';
import {
  classifyBreedingStatus,
  isMilkEligibleRow,
  isReproductionEligible,
  hasUnsubmittedDrafts,
  type BreedingStatus,
} from './predicates';
import {
  buildCoverage,
  buildDataQuality,
  coverageRatio,
  missingKeys,
  valueOrMissing,
  DQ_NOTE,
} from './data-quality';

const d = (s: string) => new Date(s);
const period = {
  start: d('2026-10-01T00:00:00Z'),
  end: d('2026-11-01T00:00:00Z'),
};
const gen = d('2026-11-02T00:00:00Z');

describe('cow presence', () => {
  it('cow entering mid-period is present', () => {
    expect(
      isPresentDuring({ createdAt: d('2026-10-15T00:00:00Z') }, period, gen),
    ).toBe(true);
  });
  it('cow entering at period.end is absent (exclusive)', () => {
    const r = evaluatePresence({ createdAt: period.end }, period, gen);
    expect(r).toMatchObject({ present: false, reason: 'entered_after_period' });
  });
  it('exiting before period is absent', () => {
    const r = evaluatePresence(
      {
        createdAt: d('2026-01-01T00:00:00Z'),
        dispositionDate: d('2026-09-30T23:59:59Z'),
      },
      period,
      gen,
    );
    expect(r).toMatchObject({
      present: false,
      reason: 'exited_before_period',
    });
  });
  it('exiting exactly on period.start is present', () => {
    expect(
      isPresentDuring(
        { createdAt: d('2026-01-01T00:00:00Z'), dispositionDate: period.start },
        period,
        gen,
      ),
    ).toBe(true);
  });
  it('flags createdAt proxy vs enteredAt', () => {
    expect(
      evaluatePresence({ createdAt: d('2026-01-01') }, period, gen).entrySource,
    ).toBe('createdAt');
    const r = evaluatePresence(
      { enteredAt: d('2026-01-01'), createdAt: d('2026-12-01') },
      period,
      gen,
    );
    expect(r).toMatchObject({ entrySource: 'enteredAt', present: true });
  });
  it('soft-deleted cow excluded entirely', () => {
    const r = evaluatePresence(
      { createdAt: d('2026-01-01'), deletedAt: d('2026-10-20') },
      period,
      gen,
    );
    expect(r).toMatchObject({ present: false, reason: 'deleted' });
  });
});

describe('scope resolver', () => {
  const cows = {
    present: [
      { id: 'a', entrySource: 'enteredAt' as const },
      { id: 'b', entrySource: 'createdAt' as const },
    ],
    absent: { z: 'exited_before_period' as const },
  };
  it('single cow present', () => {
    const r = resolveScopeCattleIds(
      { kind: 'SINGLE_COW', cattleId: 'a' },
      cows,
    );
    expect(r.cattleIds).toEqual(['a']);
    expect(r.usesCreatedAtProxy).toBe(false);
  });
  it('single cow absent returns explicit empty with reason', () => {
    const r = resolveScopeCattleIds(
      { kind: 'SINGLE_COW', cattleId: 'z' },
      cows,
    );
    expect(r).toMatchObject({
      isEmpty: true,
      emptyReason: 'cow_not_present_in_period',
      absentReason: 'exited_before_period',
    });
    expect(
      resolveScopeCattleIds({ kind: 'SINGLE_COW', cattleId: 'q' }, cows)
        .emptyReason,
    ).toBe('cow_not_found');
  });
  it('group intersects present and carries as-of note', () => {
    const r = resolveScopeCattleIds(
      { kind: 'GROUP', groupId: 'g', membershipAsOf: '2026-11-02T00:00:00Z' },
      cows,
      ['b', 'z'],
    );
    expect(r.cattleIds).toEqual(['b']);
    expect(r.membershipAsOf).toBe('2026-11-02T00:00:00Z');
    expect(r.groupMembershipCurrentOnly).toBe(true);
    expect(r.usesCreatedAtProxy).toBe(true);
  });
  it('empty scope is explicit', () => {
    const r = resolveScopeCattleIds({ kind: 'ALL_ELIGIBLE' }, { present: [] });
    expect(r).toMatchObject({
      isEmpty: true,
      emptyReason: 'no_eligible_cows',
      cattleIds: [],
    });
    const g = resolveScopeCattleIds(
      { kind: 'GROUP', groupId: 'g', membershipAsOf: 'x' },
      cows,
      [],
    );
    expect(g.emptyReason).toBe('group_has_no_present_members');
  });
});

describe('breeding classification', () => {
  const expected: Record<BreedingStatus, string> = {
    PENDING_CHECK: 'pending',
    PREGNANT: 'confirmed',
    CALVED: 'confirmed',
    FAILED: 'failed',
    RETURNED_TO_HEAT: 'other',
    ABORTED: 'other',
    VOIDED: 'excluded',
  };
  it.each(Object.entries(expected))('%s -> %s', (s, c) => {
    expect(classifyBreedingStatus(s as BreedingStatus)).toBe(c);
  });
  it('pending is never failed', () => {
    expect(classifyBreedingStatus('PENDING_CHECK')).not.toBe('failed');
  });
  it('eligibility excludes voided', () => {
    expect(isReproductionEligible({ status: 'PREGNANT' })).toBe(true);
    expect(
      isReproductionEligible({ status: 'PREGNANT', voidedAt: d('2026-10-02') }),
    ).toBe(false);
    expect(isReproductionEligible({ status: 'VOIDED' })).toBe(false);
  });
});

describe('milk eligibility', () => {
  it('only submitted rows; zero yield eligible', () => {
    expect(isMilkEligibleRow({ submitted: true, yieldL: 0 })).toBe(true);
    expect(isMilkEligibleRow({ submitted: false, yieldL: 10 })).toBe(false);
    expect(isMilkEligibleRow({ submitted: true, yieldL: null })).toBe(false);
    expect(isMilkEligibleRow({ submitted: true, yieldL: NaN })).toBe(false);
    expect(
      hasUnsubmittedDrafts([
        { submitted: true, yieldL: 1 },
        { submitted: false, yieldL: 2 },
      ]),
    ).toBe(true);
  });
});

describe('data quality', () => {
  it('zero vs missing', () => {
    expect(valueOrMissing(0, 'L', 'no_row')).toEqual({
      state: 'value',
      value: 0,
      unit: 'L',
    });
    expect(valueOrMissing(undefined, 'L', 'no_row')).toEqual({
      state: 'missing',
      reason: 'no_row',
    });
    expect(missingKeys(['d1', 'd2', 'd3'], ['d2'])).toEqual(['d1', 'd3']);
  });
  it('coverage from counts and items; extras do not inflate', () => {
    expect(buildCoverage(3, 2)).toEqual({ expected: 3, recorded: 2 });
    expect(buildCoverage(['a', 'b', 'c'], ['a', 'a', 'x'])).toEqual({
      expected: 3,
      recorded: 1,
    });
  });
  it('zero denominator coverage', () => {
    const c = buildCoverage(0, 0);
    expect(coverageRatio(c)).toBeNull();
    const dq = buildDataQuality({ coverage: c });
    expect(dq.flags.incompleteCoverage).toBe(false);
    expect(dq.notes).toContain(DQ_NOTE.noExpectedData);
  });
  it('builds notes and flags', () => {
    const dq = buildDataQuality({
      coverage: buildCoverage(10, 6),
      hasUnsubmittedDrafts: true,
      usesCreatedAtProxy: true,
      groupMembershipCurrentOnly: true,
    });
    expect(dq.flags).toMatchObject({
      incompleteCoverage: true,
      hasUnsubmittedDrafts: true,
      hasEstimatedValues: true,
      groupMembershipCurrentOnly: true,
    });
    expect(dq.notes).toEqual(
      expect.arrayContaining([
        DQ_NOTE.incompleteCoverage,
        DQ_NOTE.unsubmittedDrafts,
        DQ_NOTE.entryDateProxy,
        DQ_NOTE.groupMembershipCurrentOnly,
      ]),
    );
  });
  it('empty scope note', () => {
    expect(
      buildDataQuality({ coverage: buildCoverage(0, 0), scopeEmpty: true })
        .notes,
    ).toEqual([DQ_NOTE.scopeEmpty]);
  });
});

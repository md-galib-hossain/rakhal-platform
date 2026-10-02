import { computePlanStats, planKind } from './health-plan-stats';

describe('planKind', () => {
  it.each([
    ['TREATMENT', 'TREATMENT'],
    ['BREEDING', 'BREEDING'],
    ['PREVENTION', 'PREVENTION'],
    ['VACCINATION', 'PREVENTION'],
    ['DEWORMING', 'PREVENTION'],
    ['ROUTINE', 'PREVENTION'],
  ])('%s → %s', (category, kind) => {
    expect(planKind(category)).toBe(kind);
  });
});

describe('computePlanStats — treatment protocol', () => {
  it('counts distinct animals, open cases and the recovery rate', () => {
    const stats = computePlanStats(
      'TREATMENT',
      [
        { cattleId: 'a', status: 'RECOVERED' },
        { cattleId: 'b', status: 'RECOVERED' },
        { cattleId: 'c', status: 'MORTALITY' },
        { cattleId: 'a', status: 'ACTIVE' }, // same cow treated again
        { cattleId: 'd', status: 'IMPROVING' },
        { cattleId: 'e', status: 'CLOSED' }, // auto-closed: no recorded outcome
      ],
      [],
      0,
    );
    expect(stats).toMatchObject({
      kind: 'TREATMENT',
      appliedTo: 5,
      inProgress: 2,
      recovered: 2,
      mortality: 1,
      recoveryRate: 66.7,
      completed: null,
      due: null,
      coverageRate: null,
    });
  });

  it('has no recovery rate until a case has a recorded outcome — null, not 0', () => {
    const stats = computePlanStats(
      'TREATMENT',
      [{ cattleId: 'a', status: 'ACTIVE' }],
      [],
      0,
    );
    expect(stats.recoveryRate).toBeNull();
    expect(stats.recovered).toBe(0);
  });

  it('a protocol that was never applied is all zeros with null rates', () => {
    expect(computePlanStats('TREATMENT', [], [], 0)).toMatchObject({
      appliedTo: 0,
      inProgress: 0,
      recoveryRate: null,
    });
  });
});

describe('computePlanStats — prevention / breeding protocol', () => {
  it('reports enrolled animals, completion, steps due and the coverage rate', () => {
    const stats = computePlanStats(
      'VACCINATION',
      [],
      [
        { cattleId: 'a', status: 'COMPLETED' },
        { cattleId: 'b', status: 'COMPLETED' },
        { cattleId: 'c', status: 'ACTIVE' },
        { cattleId: 'd', status: 'ACTIVE' },
      ],
      3,
    );
    expect(stats).toMatchObject({
      kind: 'PREVENTION',
      appliedTo: 4,
      inProgress: 2,
      completed: 2,
      due: 3,
      coverageRate: 50,
      recovered: null,
      mortality: null,
      recoveryRate: null,
    });
  });

  it('counts an animal once however many rounds it joined, but every enrollment toward coverage', () => {
    const stats = computePlanStats(
      'DEWORMING',
      [],
      [
        { cattleId: 'a', status: 'COMPLETED' },
        { cattleId: 'a', status: 'ACTIVE' },
      ],
      0,
    );
    expect(stats.appliedTo).toBe(1);
    expect(stats.coverageRate).toBe(50);
  });

  it('has no coverage rate before anything is enrolled', () => {
    expect(computePlanStats('ROUTINE', [], [], 0).coverageRate).toBeNull();
  });

  it('breeding protocols use the preventive maths but keep their own kind', () => {
    expect(computePlanStats('BREEDING', [], [], 0).kind).toBe('BREEDING');
  });
});

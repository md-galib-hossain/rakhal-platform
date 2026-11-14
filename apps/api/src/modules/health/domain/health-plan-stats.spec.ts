import {
  computePlanStats,
  countStepsByFarmDay,
  NO_SCHEDULE,
  planKind,
} from './health-plan-stats';

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

describe('computePlanStats — schedule (RAKHAL-470)', () => {
  const schedule = {
    stepsDue: 2,
    stepsOverdue: 1,
    nextDueDate: '2026-10-01',
  };

  it('both kinds carry the same schedule fields', () => {
    expect(computePlanStats('TREATMENT', [], [], 0, schedule)).toMatchObject(
      schedule,
    );
    expect(computePlanStats('VACCINATION', [], [], 0, schedule)).toMatchObject(
      schedule,
    );
  });

  it('with nothing open it is zeros and a null date — never a made-up day', () => {
    expect(computePlanStats('TREATMENT', [], [], 0)).toMatchObject(NO_SCHEDULE);
  });
});

describe('countStepsByFarmDay', () => {
  // 2026-10-02 08:00 in Dhaka (UTC+6)
  const now = new Date('2026-10-02T02:00:00.000Z');

  it('splits today from overdue on the farm calendar day, ignores later steps', () => {
    const counts = countStepsByFarmDay(
      [
        new Date('2026-10-01T09:00:00.000Z'), // 1 Oct 15:00 Dhaka — overdue
        new Date('2026-09-20T09:00:00.000Z'), // long overdue
        new Date('2026-10-02T09:00:00.000Z'), // today 15:00 Dhaka
        new Date('2026-10-03T09:00:00.000Z'), // tomorrow — neither
      ],
      'Asia/Dhaka',
      now,
    );
    expect(counts).toEqual({ stepsDue: 1, stepsOverdue: 2 });
  });

  it('a step due at 23:30 farm time is still today; one at 00:30 the next day is not', () => {
    const counts = countStepsByFarmDay(
      [
        new Date('2026-10-02T17:30:00.000Z'), // 23:30 Dhaka, 2 Oct
        new Date('2026-10-02T18:30:00.000Z'), // 00:30 Dhaka, 3 Oct
      ],
      'Asia/Dhaka',
      now,
    );
    expect(counts).toEqual({ stepsDue: 1, stepsOverdue: 0 });
  });

  it('the same instant is a different day for a different farm timezone', () => {
    // 1 Oct 16:00 in Dhaka (yesterday there), but 06:00 on 1 Oct in New York, where it is still 1 Oct "now"
    const step = [new Date('2026-10-01T10:00:00.000Z')];
    expect(countStepsByFarmDay(step, 'Asia/Dhaka', now)).toEqual({
      stepsDue: 0,
      stepsOverdue: 1,
    });
    expect(countStepsByFarmDay(step, 'America/New_York', now)).toEqual({
      stepsDue: 1,
      stepsOverdue: 0,
    });
  });

  it('no steps is zeros', () => {
    expect(countStepsByFarmDay([], 'Asia/Dhaka', now)).toEqual({
      stepsDue: 0,
      stepsOverdue: 0,
    });
  });
});

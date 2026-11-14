import {
  aggregateOutcomes,
  CaseTimeline,
  dayOfIllness,
  elapsedDays,
  findPreviousSameCondition,
  OutcomeCase,
  RECURRENCE_WINDOW_DAYS,
} from './health-case-outcome';

const d = (iso: string) => new Date(`${iso}T09:00:00Z`);

describe('elapsedDays / dayOfIllness', () => {
  it('rounds elapsed time up and never goes below 1', () => {
    expect(elapsedDays(d('2026-09-01'), new Date('2026-09-01T15:00:00Z'))).toBe(
      1,
    );
    expect(elapsedDays(d('2026-09-01'), d('2026-09-04'))).toBe(3);
    expect(elapsedDays(d('2026-09-01'), new Date('2026-09-04T10:00:00Z'))).toBe(
      4,
    );
  });

  it('counts the day of reporting as day 1', () => {
    expect(
      dayOfIllness(d('2026-09-01'), new Date('2026-09-01T20:00:00Z')),
    ).toBe(1);
    expect(dayOfIllness(d('2026-09-01'), d('2026-09-08'))).toBe(8);
  });
});

describe('findPreviousSameCondition', () => {
  const cur: CaseTimeline = {
    id: 'now',
    cattleId: 'cow',
    condition: 'MASTITIS',
    startDate: d('2026-10-01'),
    closedDate: null,
  };
  const prev = (over: Partial<CaseTimeline>): CaseTimeline => ({
    id: 'prev',
    cattleId: 'cow',
    condition: 'MASTITIS',
    startDate: d('2026-08-10'),
    closedDate: d('2026-08-21'), // 41 days before 2026-10-01
    ...over,
  });

  it('finds a same-animal same-condition case closed 41 days earlier', () => {
    expect(findPreviousSameCondition(cur, [prev({})])?.id).toBe('prev');
  });

  it('ignores a different animal, a different condition, or an unclosed case', () => {
    expect(
      findPreviousSameCondition(cur, [prev({ cattleId: 'x' })]),
    ).toBeNull();
    expect(
      findPreviousSameCondition(cur, [prev({ condition: 'LAMENESS' })]),
    ).toBeNull();
    expect(
      findPreviousSameCondition(cur, [prev({ closedDate: null })]),
    ).toBeNull();
  });

  it('honours the window edge and picks the most recent match', () => {
    const edge = d('2026-08-02'); // 60 days before 2026-10-01
    expect(RECURRENCE_WINDOW_DAYS).toBe(60);
    expect(
      findPreviousSameCondition(cur, [prev({ id: 'edge', closedDate: edge })])
        ?.id,
    ).toBe('edge');
    expect(
      findPreviousSameCondition(cur, [
        prev({ id: 'old', closedDate: new Date('2026-08-01T00:00:00Z') }),
      ]),
    ).toBeNull();
    expect(
      findPreviousSameCondition(cur, [
        prev({ id: 'a', closedDate: d('2026-08-10') }),
        prev({ id: 'b', closedDate: d('2026-09-10') }),
      ])?.id,
    ).toBe('b');
  });

  it('a case that closed after this one started is not "previous"', () => {
    expect(
      findPreviousSameCondition(cur, [prev({ closedDate: d('2026-10-05') })]),
    ).toBeNull();
  });

  it('needs a structured condition — never guesses from free text', () => {
    expect(
      findPreviousSameCondition({ ...cur, condition: null }, [
        prev({ condition: null }),
      ]),
    ).toBeNull();
  });
});

describe('aggregateOutcomes', () => {
  const c = (over: Partial<OutcomeCase>): OutcomeCase => ({
    condition: 'MASTITIS',
    status: 'RECOVERED',
    startDate: d('2026-09-01'),
    closedDate: d('2026-09-05'),
    cost: 0,
    isRecurrence: false,
    ...over,
  });

  it('is empty-safe: no cases means null rates, not 0 %', () => {
    const r = aggregateOutcomes([]);
    expect(r).toMatchObject({
      cases: 0,
      recoveryRate: null,
      avgDaysToRecover: null,
      avgCost: null,
      recurrenceRate: null,
      totalCost: 0,
      byCondition: [],
    });
  });

  it('recovery rate is recovered ÷ (recovered + mortality); open and auto-closed cases stay out of it', () => {
    const r = aggregateOutcomes([
      c({}),
      c({}),
      c({ status: 'MORTALITY' }),
      c({ status: 'CLOSED' }), // protocol_completed — no recorded outcome
      c({ status: 'ACTIVE', closedDate: null }),
    ]);
    expect(r.cases).toBe(5);
    expect(r.recovered).toBe(2);
    expect(r.mortality).toBe(1);
    expect(r.recoveryRate).toBe(66.7);
    expect(r.otherClosed).toBe(1);
    expect(r.openCases).toBe(1);
  });

  it('averages days to recover over recovered cases only, and cost over every case', () => {
    const r = aggregateOutcomes([
      c({ closedDate: d('2026-09-04'), cost: 120 }), // 3 days
      c({ closedDate: d('2026-09-08'), cost: 80 }), // 7 days
      c({ status: 'MORTALITY', cost: 0 }),
    ]);
    expect(r.avgDaysToRecover).toBe(5);
    expect(r.totalCost).toBe(200);
    expect(r.avgCost).toBe(66.67);
  });

  it('recurrence rate is flagged cases ÷ all cases', () => {
    const r = aggregateOutcomes([
      c({ isRecurrence: true }),
      c({}),
      c({}),
      c({}),
    ]);
    expect(r.recurrenceRate).toBe(25);
  });

  it('breaks results down by condition, largest group first', () => {
    const r = aggregateOutcomes([
      c({ condition: 'LAMENESS' }),
      c({ condition: 'MASTITIS' }),
      c({ condition: 'MASTITIS', status: 'MORTALITY' }),
      c({ condition: null }),
    ]);
    expect(r.byCondition.map((b) => [b.condition, b.cases])).toEqual([
      ['MASTITIS', 2],
      ['LAMENESS', 1],
      [null, 1],
    ]);
    expect(r.byCondition[0].recoveryRate).toBe(50);
  });
});

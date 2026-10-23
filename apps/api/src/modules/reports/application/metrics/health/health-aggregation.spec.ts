import { toMoney } from 'src/common/money';
import {
  activeWithdrawals,
  casesClosed,
  casesOpenAt,
  casesOpened,
  overdueTasks,
  preventiveCompleted,
  preventiveMissed,
  repeatedCases,
  treatmentCost,
  vetFees,
  treatmentsGiven,
  type CaseRow,
  type TaskRow,
  type TreatmentRow,
} from './health-aggregation';

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const W = { start: D('2026-10-01'), end: D('2026-11-01') };

const kase = (o: Partial<CaseRow> & { id: string }): CaseRow => ({
  cattleId: 'c1',
  condition: 'MASTITIS',
  status: 'ACTIVE',
  startDate: D('2026-10-10'),
  closedDate: null,
  ...o,
});

describe('unique cows vs events', () => {
  it('counts events and distinct cows separately', () => {
    const r = casesOpened(
      [kase({ id: 'a' }), kase({ id: 'b' }), kase({ id: 'c', cattleId: 'c2' })],
      W,
    );
    expect(r.events).toBe(3);
    expect(r.cows).toHaveLength(2);
  });
  it('treatments: events vs cows', () => {
    const t: TreatmentRow[] = [
      { id: '1', cattleId: 'c1', financeTransactionId: null },
      { id: '2', cattleId: 'c1', financeTransactionId: null },
    ];
    const r = treatmentsGiven(t);
    expect(r.events).toBe(2);
    expect(r.cows).toEqual(['c1']);
  });
  it('excludes cases outside the window (end exclusive)', () => {
    expect(
      casesOpened([kase({ id: 'a', startDate: D('2026-11-01') })], W).events,
    ).toBe(0);
  });
});

describe('closed / open at end', () => {
  it('closed counts only closedDate in period', () => {
    const rows = [
      kase({ id: 'a', status: 'RECOVERED', closedDate: D('2026-10-05') }),
      kase({ id: 'b', status: 'RECOVERED', closedDate: D('2026-09-05') }),
    ];
    expect(casesClosed(rows, W)).toBe(1);
  });
  it('open at end excludes cases closed on/before end', () => {
    const rows = [
      kase({ id: 'a' }),
      kase({ id: 'b', status: 'RECOVERED', closedDate: D('2026-10-20') }),
      kase({ id: 'c', status: 'RECOVERED', closedDate: D('2026-11-05') }),
      kase({ id: 'd', startDate: D('2026-11-02') }),
    ];
    expect(casesOpenAt(rows, W.end)).toBe(2);
  });
});

describe('overdue derived from dueDateTime', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  const task = (o: Partial<TaskRow> & { id: string }): TaskRow => ({
    cattleId: 'c1',
    planEnrollmentId: null,
    status: 'PENDING',
    dueDateTime: new Date('2026-10-22T00:00:00Z'),
    completedAt: null,
    ...o,
  });
  it('PENDING past due is overdue even though stored status is not OVERDUE', () => {
    expect(overdueTasks([task({ id: 'a' })], now)).toHaveLength(1);
  });
  it('PENDING not yet due is not overdue', () => {
    expect(
      overdueTasks(
        [task({ id: 'a', dueDateTime: new Date('2026-10-24T00:00:00Z') })],
        now,
      ),
    ).toHaveLength(0);
  });
  it('RESCHEDULED uses its new due time; COMPLETED/MISSED never overdue', () => {
    const rows = [
      task({ id: 'a', status: 'RESCHEDULED' }),
      task({
        id: 'b',
        status: 'RESCHEDULED',
        dueDateTime: new Date('2026-12-01'),
      }),
      task({ id: 'c', status: 'COMPLETED' }),
      task({ id: 'd', status: 'MISSED' }),
    ];
    expect(overdueTasks(rows, now).map((t) => t.id)).toEqual(['a']);
  });
  it('preventive completed/missed only count enrollment tasks in window', () => {
    const rows = [
      task({
        id: 'a',
        planEnrollmentId: 'e',
        status: 'COMPLETED',
        completedAt: D('2026-10-03'),
      }),
      task({ id: 'b', status: 'COMPLETED', completedAt: D('2026-10-03') }),
      task({
        id: 'c',
        planEnrollmentId: 'e',
        status: 'MISSED',
        dueDateTime: D('2026-10-04'),
      }),
    ];
    expect(preventiveCompleted(rows, W)).toBe(1);
    expect(preventiveMissed(rows, W)).toBe(1);
  });
});

describe('repeated cases window', () => {
  const start = D('2026-10-20');
  const daysBefore = (n: number) => new Date(start.getTime() - n * 86400000);
  const run = (n: number) =>
    repeatedCases(
      [kase({ id: 'cur', startDate: start })],
      [
        kase({
          id: 'prev',
          status: 'RECOVERED',
          startDate: D('2026-01-01'),
          closedDate: daysBefore(n),
        }),
      ],
      60,
    ).events;
  it('59 days -> repeated, 60 -> repeated, 61 -> not', () => {
    expect(run(59)).toBe(1);
    expect(run(60)).toBe(1);
    expect(run(61)).toBe(0);
  });
  it('null condition is never matched', () => {
    const r = repeatedCases(
      [kase({ id: 'cur', condition: null, startDate: start })],
      [
        kase({
          id: 'prev',
          condition: null,
          status: 'RECOVERED',
          closedDate: daysBefore(5),
        }),
      ],
      60,
    );
    expect(r.events).toBe(0);
  });
  it('different cow or condition is not a repeat', () => {
    const prev = kase({
      id: 'p',
      status: 'RECOVERED',
      closedDate: daysBefore(5),
    });
    expect(
      repeatedCases(
        [kase({ id: 'cur', startDate: start, cattleId: 'c2' })],
        [prev],
        60,
      ).events,
    ).toBe(0);
    expect(
      repeatedCases(
        [kase({ id: 'cur', startDate: start, condition: 'LAMENESS' })],
        [prev],
        60,
      ).events,
    ).toBe(0);
  });
});

describe('withdrawals and cost', () => {
  it('ACTIVE and READY_FOR_RELEASE count; RELEASED and CANCELLED do not', () => {
    const r = activeWithdrawals([
      { id: '1', cattleId: 'c1', status: 'ACTIVE' },
      { id: '2', cattleId: 'c2', status: 'RELEASED' },
      { id: '3', cattleId: 'c3', status: 'READY_FOR_RELEASE' },
      { id: '4', cattleId: 'c4', status: 'CANCELLED' },
    ]);
    expect(r.events).toBe(2);
    expect(r.cows.sort()).toEqual(['c1', 'c3']);
  });
  it('vetFees sums vetCost, skips nulls and the same Expense already in treatment cost', () => {
    const t: TreatmentRow[] = [
      {
        id: '1',
        cattleId: 'c1',
        financeTransactionId: 'e1',
        vetCost: '100.50',
        vetExpenseId: 'v1',
      },
      {
        id: '2',
        cattleId: 'c1',
        financeTransactionId: null,
        vetCost: null,
        vetExpenseId: null,
      },
      {
        id: '3',
        cattleId: 'c1',
        financeTransactionId: 'e3',
        vetCost: 40,
        vetExpenseId: 'e3',
      },
      { id: '4', cattleId: 'c1', financeTransactionId: null },
    ];
    expect(vetFees(t, new Map([['v1', toMoney(100.5)]])).value).toEqual({
      state: 'value',
      value: 100.5,
      unit: 'BDT',
    });
  });
  it('cost sums only expenses present in the (non-voided) map; unresolved is partial, never 0', () => {
    const t: TreatmentRow[] = [
      { id: '1', cattleId: 'c1', financeTransactionId: 'e1' },
      { id: '2', cattleId: 'c1', financeTransactionId: 'e2' }, // voided: absent
      { id: '3', cattleId: 'c1', financeTransactionId: null },
    ];
    const r = treatmentCost(t, new Map([['e1', toMoney('120.5')]]));
    expect(r.value).toEqual({ state: 'value', value: 120.5, unit: 'BDT' });
    expect(r.partial).toBe(true);
  });
});

import {
  applicationRoundKey,
  buildRoundGrid,
  cellState,
  GridRunFact,
  parseRoundKey,
  RoundTaskFact,
  summarizeRound,
  treatmentRoundKey,
} from './health-round';

const TZ = 'Asia/Dhaka';
/** 12:00 on 2 Oct in Dhaka (06:00 UTC). */
const NOW = new Date('2026-10-02T06:00:00.000Z');
/** Noon Dhaka, `n` farm days from 2 Oct. */
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
const dayOf = (due: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(due);

let seq = 0;
const task = (
  over: Partial<RoundTaskFact> & { due: number },
): RoundTaskFact => {
  const { due, ...rest } = over;
  seq += 1;
  return {
    id: `t${seq}`,
    runKey: 'run-a',
    stepNumber: 1,
    title: 'Dose',
    status: 'PENDING',
    dueDateTime: day(due),
    completedAt: null,
    live: true,
    ...rest,
  };
};
const run = (key: string, name: string): GridRunFact => ({
  runKey: key,
  runType: 'ENROLLMENT',
  healthCaseId: null,
  planEnrollmentId: key,
  caseCode: null,
  cattle: { id: `c-${key}`, name, tagNumber: `TAG-${name}` },
});

describe('round keys', () => {
  it('round-trips an application key and a treatment key', () => {
    expect(parseRoundKey(applicationRoundKey('abc123'))).toEqual({
      type: 'APPLICATION',
      applicationId: 'abc123',
    });
    expect(parseRoundKey(treatmentRoundKey('plan9', '2026-10-02'))).toEqual({
      type: 'TREATMENT',
      planId: 'plan9',
      day: '2026-10-02',
    });
  });

  it.each([
    '',
    'app:',
    'app:a:b',
    'trt:p',
    'trt:p:2026-10',
    'xyz:1',
    'trt:p:2026-10-02:x',
  ])('rejects %p', (key) => {
    expect(parseRoundKey(key)).toBeNull();
  });
});

describe('cellState (farm days, Asia/Dhaka)', () => {
  it('done and skipped come from status', () => {
    expect(
      cellState(task({ due: -4, status: 'COMPLETED' }), TZ, NOW).state,
    ).toBe('done');
    expect(cellState(task({ due: -4, status: 'SKIPPED' }), TZ, NOW).state).toBe(
      'skipped',
    );
  });

  it('an open live step is overdue / today / upcoming by the farm day', () => {
    expect(cellState(task({ due: -4 }), TZ, NOW)).toEqual({
      state: 'overdue',
      days: -4,
    });
    expect(cellState(task({ due: 0 }), TZ, NOW).state).toBe('today');
    expect(cellState(task({ due: 2 }), TZ, NOW)).toEqual({
      state: 'upcoming',
      days: 2,
    });
  });

  it('23:30 farm time is still today (not overdue) until midnight there', () => {
    const late = new Date('2026-10-02T17:30:00.000Z'); // 23:30 Dhaka on 2 Oct
    expect(cellState(task({ due: 0, dueDateTime: late }), TZ, NOW).state).toBe(
      'today',
    );
  });

  it('an OVERDUE status is late even when the date looks fine', () => {
    expect(cellState(task({ due: 3, status: 'OVERDUE' }), TZ, NOW).state).toBe(
      'overdue',
    );
  });

  it('a step that is not live (cow left, case closed) or MISSED is inactive, never due', () => {
    expect(cellState(task({ due: -4, live: false }), TZ, NOW).state).toBe(
      'inactive',
    );
    expect(cellState(task({ due: -4, status: 'MISSED' }), TZ, NOW).state).toBe(
      'inactive',
    );
  });
});

describe('summarizeRound', () => {
  const tasks = [
    task({ due: -4, status: 'COMPLETED' }),
    task({ due: -4 }), // overdue
    task({ due: 0 }), // today
    task({ due: 2 }), // upcoming
    task({ due: 5, status: 'SKIPPED' }),
  ];

  it('counts steps, done, skipped, overdue and due today', () => {
    const s = summarizeRound(tasks, TZ, NOW, dayOf);
    expect(s).toMatchObject({
      stepsTotal: 4, // the skipped one is not a step to do
      stepsDone: 1,
      stepsSkipped: 1,
      stepsOverdue: 1,
      stepsDueToday: 1,
      status: 'RUNNING',
    });
  });

  it('next due date is the earliest live open step, on the farm day', () => {
    expect(summarizeRound(tasks, TZ, NOW, dayOf).nextDueDate).toBe(
      '2026-09-28',
    );
  });

  it('a round with no live open step is FINISHED', () => {
    const s = summarizeRound(
      [
        task({ due: -4, status: 'COMPLETED' }),
        task({ due: 2, live: false }),
        task({ due: 4, status: 'SKIPPED' }),
      ],
      TZ,
      NOW,
      dayOf,
    );
    expect(s.status).toBe('FINISHED');
    expect(s.nextDueDate).toBeNull();
    expect(s.stepsOverdue).toBe(0);
  });

  it('an open step of an animal that left the herd does not count as overdue', () => {
    const s = summarizeRound([task({ due: -4, live: false })], TZ, NOW, dayOf);
    expect(s.stepsOverdue).toBe(0);
    expect(s.status).toBe('FINISHED');
  });
});

describe('buildRoundGrid — the screenshot case: 2 cows, 2 steps', () => {
  const steps = [
    { dayNumber: 2, title: 'Booster' },
    { dayNumber: 0, title: 'First dose' },
  ]; // deliberately out of order
  const runs = [run('a', 'Tuni'), run('b', 'Bhola')];
  const tasks = [
    task({ runKey: 'b', stepNumber: 1, due: -4, status: 'COMPLETED' }),
    task({ runKey: 'b', stepNumber: 2, due: -4 }),
    task({ runKey: 'a', stepNumber: 1, due: 0 }),
    task({ runKey: 'a', stepNumber: 2, due: 2 }),
  ];
  const grid = buildRoundGrid(runs, tasks, steps, TZ, NOW);

  it('columns follow the protocol days', () => {
    expect(grid.columns.map((c) => [c.key, c.dayNumber, c.title])).toEqual([
      ['s1', 0, 'First dose'],
      ['s2', 2, 'Booster'],
    ]);
  });

  it('the most urgent animal is first, each with a cell per step', () => {
    expect(grid.rows.map((r) => r.cattle.name)).toEqual(['Bhola', 'Tuni']);
    expect(grid.rows[0].cells.s1.state).toBe('done');
    expect(grid.rows[0].cells.s2.state).toBe('overdue');
    expect(grid.rows[1].cells.s1.state).toBe('today');
    expect(grid.rows[1].cells.s2.state).toBe('upcoming');
  });

  it('per-row due and overdue counts', () => {
    expect(grid.rows[0]).toMatchObject({ dueCount: 1, overdueCount: 1 });
    expect(grid.rows[1]).toMatchObject({ dueCount: 1, overdueCount: 0 });
  });

  it('red and amber cells in the grid add up to the round card counts', () => {
    const summary = summarizeRound(tasks, TZ, NOW, dayOf);
    const cells = grid.rows.flatMap((r) => Object.values(r.cells));
    expect(cells.filter((c) => c.state === 'overdue')).toHaveLength(
      summary.stepsOverdue,
    );
    expect(cells.filter((c) => c.state === 'today')).toHaveLength(
      summary.stepsDueToday,
    );
  });
});

describe('buildRoundGrid — edge cases', () => {
  it('a run with no steps yet is still a row', () => {
    const grid = buildRoundGrid(
      [run('a', 'Tuni')],
      [],
      [{ dayNumber: 0, title: 'Dose' }],
      TZ,
      NOW,
    );
    expect(grid.rows).toHaveLength(1);
    expect(grid.rows[0].cells).toEqual({});
  });

  it('a step that matches no protocol step gets its own column', () => {
    const grid = buildRoundGrid(
      [run('a', 'Tuni')],
      [task({ runKey: 'a', stepNumber: null, title: 'Extra check', due: 0 })],
      [{ dayNumber: 0, title: 'Dose' }],
      TZ,
      NOW,
    );
    expect(grid.columns.map((c) => c.title)).toEqual(['Dose', 'Extra check']);
    expect(grid.rows[0].cells['x:Extra check']).toBeDefined();
  });

  it('a task for a run that is not in the round is ignored', () => {
    const grid = buildRoundGrid(
      [run('a', 'Tuni')],
      [task({ runKey: 'stranger', due: 0 })],
      [{ dayNumber: 0, title: 'Dose' }],
      TZ,
      NOW,
    );
    expect(grid.rows[0].cells).toEqual({});
  });
});

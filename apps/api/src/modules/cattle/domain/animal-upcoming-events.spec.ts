import {
  buildAnimalUpcomingEvents,
  farmDaysUntil,
  UpcomingEventCandidate,
  urgencyForDaysUntil,
} from './animal-upcoming-events';

const TZ = 'Asia/Dhaka'; // UTC+6, no DST
// 2026-10-11 12:00 Dhaka
const NOW = new Date('2026-10-11T06:00:00Z');

function cand(
  overrides: Partial<UpcomingEventCandidate> & { dueAt: Date },
): UpcomingEventCandidate {
  return {
    kind: 'HEALTH_STEP',
    labelKey: 'cattle.upcoming.healthStep',
    actionable: true,
    ref: { type: 'HEALTH_TASK', id: 'x' },
    ...overrides,
  };
}

/** `n` farm days from today at noon Dhaka. */
function inDays(n: number): Date {
  return new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
}

describe('farmDaysUntil', () => {
  it('reads both dates as the farm calendar day', () => {
    // 2026-10-11T20:00Z is 2026-10-12 02:00 in Dhaka -> tomorrow, though the UTC date is still today
    expect(farmDaysUntil(new Date('2026-10-11T20:00:00Z'), TZ, NOW)).toBe(1);
  });

  it('treats a step late in the farm day as today', () => {
    // 2026-10-11T17:30Z is 23:30 Dhaka, still 2026-10-11
    expect(farmDaysUntil(new Date('2026-10-11T17:30:00Z'), TZ, NOW)).toBe(0);
  });

  it('is negative once the day has passed', () => {
    expect(farmDaysUntil(new Date('2026-10-09T06:00:00Z'), TZ, NOW)).toBe(-2);
  });
});

describe('urgencyForDaysUntil', () => {
  it.each([
    [-1, 'OVERDUE'],
    [0, 'DUE_SOON'],
    [3, 'DUE_SOON'],
    [4, 'LATER'],
  ])('%i days -> %s', (days, expected) => {
    expect(urgencyForDaysUntil(days)).toBe(expected);
  });
});

describe('buildAnimalUpcomingEvents', () => {
  const opts = { now: NOW, timezone: TZ };

  it('returns nothing for no candidates', () => {
    expect(buildAnimalUpcomingEvents([], opts)).toEqual([]);
  });

  it('keeps everything inside the window, drops what is beyond it', () => {
    const events = buildAnimalUpcomingEvents(
      [
        cand({ dueAt: inDays(14), ref: { type: 'HEALTH_TASK', id: 'in' } }),
        cand({ dueAt: inDays(15), ref: { type: 'HEALTH_TASK', id: 'out' } }),
      ],
      opts,
    );
    expect(events.map((e) => e.ref.id)).toEqual(['in']);
  });

  it('honours a custom window', () => {
    const events = buildAnimalUpcomingEvents([cand({ dueAt: inDays(8) })], {
      ...opts,
      windowDays: 7,
    });
    expect(events).toEqual([]);
  });

  it('keeps overdue items however old', () => {
    const events = buildAnimalUpcomingEvents(
      [cand({ dueAt: inDays(-200) })],
      opts,
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ urgency: 'OVERDUE', daysUntil: -200 });
  });

  it('orders overdue first (most overdue first), then soonest', () => {
    const events = buildAnimalUpcomingEvents(
      [
        cand({ dueAt: inDays(5), ref: { type: 'HEALTH_TASK', id: 'later' } }),
        cand({ dueAt: inDays(-1), ref: { type: 'HEALTH_TASK', id: 'late1' } }),
        cand({ dueAt: inDays(1), ref: { type: 'HEALTH_TASK', id: 'soon' } }),
        cand({ dueAt: inDays(-4), ref: { type: 'HEALTH_TASK', id: 'late4' } }),
      ],
      opts,
    );
    expect(events.map((e) => e.ref.id)).toEqual([
      'late4',
      'late1',
      'soon',
      'later',
    ]);
  });

  it('a withdrawal ending never outranks an action, even when sooner', () => {
    const events = buildAnimalUpcomingEvents(
      [
        cand({
          kind: 'WITHDRAWAL_END',
          actionable: false,
          dueAt: inDays(1),
          ref: { type: 'SAFETY_WITHDRAWAL', id: 'w' },
        }),
        cand({
          kind: 'TASK',
          dueAt: inDays(6),
          ref: { type: 'TASK', id: 't' },
        }),
      ],
      opts,
    );
    expect(events.map((e) => e.kind)).toEqual(['TASK', 'WITHDRAWAL_END']);
  });

  it('an overdue action outranks everything, an ended withdrawal is dropped', () => {
    const events = buildAnimalUpcomingEvents(
      [
        cand({
          kind: 'WITHDRAWAL_END',
          actionable: false,
          dueAt: inDays(-1),
          ref: { type: 'SAFETY_WITHDRAWAL', id: 'ended' },
        }),
        cand({ dueAt: inDays(-2), ref: { type: 'HEALTH_TASK', id: 'late' } }),
      ],
      opts,
    );
    expect(events.map((e) => e.ref.id)).toEqual(['late']);
  });

  it('breaks same-day ties by kind priority, then ref id', () => {
    const same = inDays(2);
    const events = buildAnimalUpcomingEvents(
      [
        cand({ kind: 'TASK', dueAt: same, ref: { type: 'TASK', id: 'b' } }),
        cand({
          kind: 'PREGNANCY_CHECK',
          dueAt: same,
          ref: { type: 'BREEDING_EVENT', id: 'a' },
        }),
        cand({ kind: 'TASK', dueAt: same, ref: { type: 'TASK', id: 'a' } }),
      ],
      opts,
    );
    expect(events.map((e) => `${e.kind}:${e.ref.id}`)).toEqual([
      'PREGNANCY_CHECK:a',
      'TASK:a',
      'TASK:b',
    ]);
  });

  it('is deterministic whatever the input order', () => {
    const list = [
      cand({ dueAt: inDays(3), ref: { type: 'HEALTH_TASK', id: 'a' } }),
      cand({ dueAt: inDays(-1), ref: { type: 'HEALTH_TASK', id: 'b' } }),
      cand({ kind: 'TASK', dueAt: inDays(3), ref: { type: 'TASK', id: 'c' } }),
    ];
    expect(buildAnimalUpcomingEvents([...list].reverse(), opts)).toEqual(
      buildAnimalUpcomingEvents(list, opts),
    );
  });

  it('tags urgency from the farm-local day', () => {
    const events = buildAnimalUpcomingEvents(
      [
        cand({ dueAt: inDays(0), ref: { type: 'HEALTH_TASK', id: 'today' } }),
        cand({ dueAt: inDays(3), ref: { type: 'HEALTH_TASK', id: 'soon' } }),
        cand({ dueAt: inDays(4), ref: { type: 'HEALTH_TASK', id: 'later' } }),
      ],
      opts,
    );
    expect(events.map((e) => [e.ref.id, e.urgency])).toEqual([
      ['today', 'DUE_SOON'],
      ['soon', 'DUE_SOON'],
      ['later', 'LATER'],
    ]);
  });

  describe('Task Hub de-duplication', () => {
    const dueDay = inDays(2);

    it('drops a task for a source event already covered on the same farm day', () => {
      const events = buildAnimalUpcomingEvents(
        [
          cand({
            kind: 'PREGNANCY_CHECK',
            dueAt: dueDay,
            ref: { type: 'BREEDING_EVENT', id: 'be1' },
            coversSourceKeys: ['BREEDING_EVENT:be1'],
          }),
          cand({
            kind: 'TASK',
            dueAt: new Date(dueDay.getTime() + 60 * 60 * 1000), // same farm day, later hour
            ref: { type: 'TASK', id: 't1' },
            sourceKey: 'BREEDING_EVENT:be1',
          }),
        ],
        opts,
      );
      expect(events.map((e) => e.kind)).toEqual(['PREGNANCY_CHECK']);
    });

    it('keeps a task for the same source event on a different day', () => {
      const events = buildAnimalUpcomingEvents(
        [
          cand({
            kind: 'PREGNANCY_CHECK',
            dueAt: dueDay,
            ref: { type: 'BREEDING_EVENT', id: 'be1' },
            coversSourceKeys: ['BREEDING_EVENT:be1'],
          }),
          cand({
            kind: 'TASK',
            dueAt: inDays(5),
            ref: { type: 'TASK', id: 't1' },
            sourceKey: 'BREEDING_EVENT:be1',
          }),
        ],
        opts,
      );
      expect(events.map((e) => e.kind)).toEqual(['PREGNANCY_CHECK', 'TASK']);
    });

    it('keeps a task whose source is not covered, and manual tasks', () => {
      const events = buildAnimalUpcomingEvents(
        [
          cand({
            kind: 'PREGNANCY_CHECK',
            dueAt: dueDay,
            ref: { type: 'BREEDING_EVENT', id: 'be1' },
            coversSourceKeys: ['BREEDING_EVENT:be1'],
          }),
          cand({
            kind: 'TASK',
            dueAt: dueDay,
            ref: { type: 'TASK', id: 'other' },
            sourceKey: 'BREEDING_EVENT:be2',
          }),
          cand({
            kind: 'TASK',
            dueAt: dueDay,
            ref: { type: 'TASK', id: 'manual' },
          }),
        ],
        opts,
      );
      expect(events.map((e) => e.ref.id).sort()).toEqual([
        'be1',
        'manual',
        'other',
      ]);
    });

    it('does not let a task cover another task', () => {
      const events = buildAnimalUpcomingEvents(
        [
          cand({
            kind: 'TASK',
            dueAt: dueDay,
            ref: { type: 'TASK', id: 'a' },
            sourceKey: 'CALVING_EVENT:c1',
            coversSourceKeys: ['CALVING_EVENT:c1'],
          }),
          cand({
            kind: 'TASK',
            dueAt: dueDay,
            ref: { type: 'TASK', id: 'b' },
            sourceKey: 'CALVING_EVENT:c1',
          }),
        ],
        opts,
      );
      expect(events).toHaveLength(2);
    });
  });

  it('carries label params and serialises dueAt as ISO', () => {
    const [event] = buildAnimalUpcomingEvents(
      [
        cand({
          dueAt: new Date('2026-10-12T06:00:00Z'),
          labelParams: { title: 'FMD vaccine' },
        }),
      ],
      opts,
    );
    expect(event).toMatchObject({
      dueAt: '2026-10-12T06:00:00.000Z',
      daysUntil: 1,
      labelParams: { title: 'FMD vaccine' },
    });
  });
});

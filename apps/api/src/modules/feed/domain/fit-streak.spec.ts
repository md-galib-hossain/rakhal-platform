import { FitDayRow, offTargetCows, streakDates } from './fit-streak';

const DATES = ['2026-09-26', '2026-09-25', '2026-09-24'];
const row = (
  cattleId: string,
  date: string,
  severity: FitDayRow['severity'] = 'BAD',
  estimated = false,
): FitDayRow => ({ cattleId, date, severity, estimated });

describe('streakDates', () => {
  it('lists the days ending at the given one, newest first, across a month boundary', () => {
    expect(streakDates('2026-10-01', 3)).toEqual([
      '2026-10-01',
      '2026-09-30',
      '2026-09-29',
    ]);
  });
});

describe('offTargetCows', () => {
  it('flags a cow that was warn/bad on every day', () => {
    const rows = [
      row('a', DATES[0], 'WARN'),
      row('a', DATES[1], 'BAD'),
      row('a', DATES[2], 'WARN'),
    ];
    expect(offTargetCows(rows, DATES)).toEqual(['a']);
  });

  it('does not flag two days out of three, or a day that was fine', () => {
    expect(
      offTargetCows([row('a', DATES[0]), row('a', DATES[1])], DATES),
    ).toEqual([]);
    expect(
      offTargetCows(
        [row('a', DATES[0]), row('a', DATES[1], 'OK'), row('a', DATES[2])],
        DATES,
      ),
    ).toEqual([]);
  });

  it('an estimated day never counts, so an estimated-only streak does not trigger', () => {
    const rows = DATES.map((d) => row('a', d, 'BAD', true));
    expect(offTargetCows(rows, DATES)).toEqual([]);
    const mixed = [
      row('b', DATES[0]),
      row('b', DATES[1], 'BAD', true),
      row('b', DATES[2]),
    ];
    expect(offTargetCows(mixed, DATES)).toEqual([]);
  });

  it('ignores days outside the window and judges each cow on her own', () => {
    const rows = [
      ...DATES.map((d) => row('a', d)),
      row('b', '2026-09-20'),
      row('b', DATES[0]),
    ];
    expect(offTargetCows(rows, DATES)).toEqual(['a']);
  });
});

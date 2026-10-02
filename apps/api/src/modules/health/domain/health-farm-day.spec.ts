import { farmDayEnd, farmDayStart } from './health-farm-day';

describe('farmDayStart', () => {
  it('Dhaka (UTC+6): the day begins at 18:00 UTC the evening before', () => {
    expect(farmDayStart('2026-10-02', 'Asia/Dhaka').toISOString()).toBe(
      '2026-10-01T18:00:00.000Z',
    );
  });

  it('UTC farm: the day begins at UTC midnight', () => {
    expect(farmDayStart('2026-10-02', 'UTC').toISOString()).toBe(
      '2026-10-02T00:00:00.000Z',
    );
  });

  it('a zone west of Greenwich begins its day after UTC midnight', () => {
    // New York is UTC-4 in October (daylight time)
    expect(farmDayStart('2026-10-02', 'America/New_York').toISOString()).toBe(
      '2026-10-02T04:00:00.000Z',
    );
  });

  it('lands on local midnight across a daylight-saving change', () => {
    // US clocks go back on 2026-11-01: that day starts at UTC-4, the next at UTC-5
    expect(farmDayStart('2026-11-01', 'America/New_York').toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    );
    expect(farmDayStart('2026-11-02', 'America/New_York').toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    );
  });
});

describe('farmDayEnd (exclusive upper bound for "due up to and including that day")', () => {
  it('is the start of the next farm day', () => {
    expect(farmDayEnd('2026-10-02', 'Asia/Dhaka').toISOString()).toBe(
      '2026-10-02T18:00:00.000Z',
    );
  });

  it('rolls over a month end', () => {
    expect(farmDayEnd('2026-10-31', 'Asia/Dhaka').toISOString()).toBe(
      '2026-10-31T18:00:00.000Z',
    );
    expect(farmDayEnd('2026-12-31', 'UTC').toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });

  it('a step at 23:30 Dhaka time on the day is inside it; 00:30 the next day is not', () => {
    const end = farmDayEnd('2026-10-02', 'Asia/Dhaka');
    const lateThatDay = new Date('2026-10-02T17:30:00.000Z'); // 23:30 Dhaka
    const earlyNextDay = new Date('2026-10-02T18:30:00.000Z'); // 00:30 Dhaka, 3 Oct
    expect(lateThatDay.getTime()).toBeLessThan(end.getTime());
    expect(earlyNextDay.getTime()).toBeGreaterThanOrEqual(end.getTime());
  });
});

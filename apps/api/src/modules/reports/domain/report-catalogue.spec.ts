import { groupedCatalogue, isKnownReport, REPORTS } from './report-catalogue';

describe('report-catalogue', () => {
  it('defines the 12 MVP reports + feed-cost', () => {
    expect(REPORTS).toHaveLength(13);
  });

  it('every report id is unique', () => {
    const ids = REPORTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('groups reports into the four categories in order', () => {
    const groups = groupedCatalogue();
    expect(groups.map((g) => g.category)).toEqual([
      'production',
      'reproduction',
      'health',
      'financial',
    ]);
    // Every report lands in exactly one group.
    const total = groups.reduce((acc, g) => acc + g.reports.length, 0);
    expect(total).toBe(REPORTS.length);
  });

  it('validates known vs unknown report ids', () => {
    expect(isKnownReport('rpt_daily_milk')).toBe(true);
    expect(isKnownReport('rpt_not_real')).toBe(false);
  });

  it('every report offers both pdf and csv', () => {
    for (const r of REPORTS) {
      expect(r.formats).toEqual(expect.arrayContaining(['pdf', 'csv']));
    }
  });
});

import {
  ESTIMATE_FALLBACK_GESTATION_AT_CHECK_DAYS,
  estimatePregnancyDates,
} from './pregnancy-estimate';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

describe('estimatePregnancyDates (RAKHAL-476)', () => {
  it('uses the breeding date when an AI is linked', () => {
    const r = estimatePregnancyDates({
      diagnosisDate: d('2026-10-01'),
      breedingDate: d('2026-08-27'),
    });
    expect(iso(r.conceptionDate)).toBe('2026-08-27');
    expect(iso(r.calculatedCalvingDate)).toBe('2027-06-03');
    expect(r.source).toBe('BREEDING');
  });

  it('derives conception from gestationDay when there is no breeding (never the check date)', () => {
    const r = estimatePregnancyDates({
      diagnosisDate: d('2026-10-01'),
      gestationDay: 60,
    });
    expect(iso(r.conceptionDate)).toBe('2026-08-02');
    expect(iso(r.calculatedCalvingDate)).toBe('2027-05-09');
    expect(r.source).toBe('GESTATION_DAY');
  });

  it('derives conception from expected calving (minus 280) when only that is known', () => {
    const r = estimatePregnancyDates({
      diagnosisDate: d('2026-10-01'),
      expectedCalvingDate: d('2027-03-20'),
    });
    expect(iso(r.conceptionDate)).toBe('2026-06-13');
    expect(r.source).toBe('EXPECTED_CALVING');
  });

  it('prefers gestationDay over expected calving', () => {
    const r = estimatePregnancyDates({
      diagnosisDate: d('2026-10-01'),
      gestationDay: 90,
      expectedCalvingDate: d('2027-03-20'),
    });
    expect(r.source).toBe('GESTATION_DAY');
    expect(iso(r.conceptionDate)).toBe('2026-07-03');
  });

  it('with no data at all falls back to check minus 90 days, never the check date', () => {
    const r = estimatePregnancyDates({ diagnosisDate: d('2026-10-01') });
    expect(ESTIMATE_FALLBACK_GESTATION_AT_CHECK_DAYS).toBe(90);
    expect(iso(r.conceptionDate)).toBe('2026-07-03');
    expect(r.source).toBe('FALLBACK');
  });
});

import {
  ageInDays,
  computeAdg,
  DAY_MS,
  stageForAge,
  weaningTargetDate,
} from './calf-stage';

describe('calf-stage domain', () => {
  const now = new Date('2026-03-01T00:00:00Z');

  describe('ageInDays', () => {
    it('counts whole days and never goes negative', () => {
      expect(ageInDays(new Date('2026-02-01T00:00:00Z'), now)).toBe(28);
      expect(ageInDays(new Date('2026-03-02T00:00:00Z'), now)).toBe(0);
    });
  });

  describe('stageForAge', () => {
    it('maps ages to stages at the boundaries', () => {
      expect(stageForAge(0)).toBe('newborn');
      expect(stageForAge(6)).toBe('newborn');
      expect(stageForAge(7)).toBe('young');
      expect(stageForAge(59)).toBe('young');
      expect(stageForAge(60)).toBe('pre_weaning');
      expect(stageForAge(89)).toBe('pre_weaning');
      expect(stageForAge(90)).toBe('post_weaning');
      expect(stageForAge(200)).toBe('post_weaning');
    });
  });

  describe('computeAdg', () => {
    it('computes (current - birth) / age', () => {
      expect(computeAdg(34, 51, 28)).toBe(0.61);
    });

    it('returns null when inputs are missing or age is zero', () => {
      expect(computeAdg(null, 51, 28)).toBeNull();
      expect(computeAdg(34, null, 28)).toBeNull();
      expect(computeAdg(34, 51, 0)).toBeNull();
    });
  });

  describe('weaningTargetDate', () => {
    it('defaults to birth + 60 days', () => {
      const dob = new Date('2026-01-01T00:00:00Z');
      expect(weaningTargetDate(dob).getTime()).toBe(
        dob.getTime() + 60 * DAY_MS,
      );
    });
  });
});

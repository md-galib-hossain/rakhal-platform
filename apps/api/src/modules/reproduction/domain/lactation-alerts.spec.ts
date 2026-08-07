import {
  detectDryOffApproaching,
  detectDryOffOverdue,
  detectLongLactationNotPregnant,
  detectLowPeakByDim,
  detectLowProductionDryOffReview,
  detectMissingSession,
  detectPlannedDryOffDue,
  detectSuddenDrop,
} from './lactation-alerts';
import { DimDataQuality } from './lactation-curve';

const ALL_COMPLETE: DimDataQuality[] =
  Array<DimDataQuality>(7).fill('complete');

describe('lactation-alerts', () => {
  describe('detectMissingSession', () => {
    it('fires when the day has no recorded session', () => {
      expect(detectMissingSession({ dataQuality: 'missing' })).toBe(true);
    });

    it('does not fire on incomplete or complete days', () => {
      expect(detectMissingSession({ dataQuality: 'incomplete' })).toBe(false);
      expect(detectMissingSession({ dataQuality: 'complete' })).toBe(false);
    });
  });

  describe('detectSuddenDrop', () => {
    it('fires when the drop meets the threshold and all days are complete', () => {
      const result = detectSuddenDrop({
        evaluatedDayYieldL: 7,
        evaluatedDayDataQuality: 'complete',
        baselineDaysDataQuality: ALL_COMPLETE,
        baselineAvgYieldL: 10,
        dropThresholdPct: 30,
      });
      expect(result).toEqual({ fired: true, dropPct: 30 });
    });

    it('does not fire below the threshold', () => {
      const result = detectSuddenDrop({
        evaluatedDayYieldL: 9,
        evaluatedDayDataQuality: 'complete',
        baselineDaysDataQuality: ALL_COMPLETE,
        baselineAvgYieldL: 10,
        dropThresholdPct: 30,
      });
      expect(result.fired).toBe(false);
      expect(result.dropPct).toBe(10);
    });

    it('never fires when the evaluated day is incomplete', () => {
      const result = detectSuddenDrop({
        evaluatedDayYieldL: 1,
        evaluatedDayDataQuality: 'incomplete',
        baselineDaysDataQuality: ALL_COMPLETE,
        baselineAvgYieldL: 10,
        dropThresholdPct: 30,
      });
      expect(result).toEqual({ fired: false, dropPct: null });
    });

    it('never fires when any baseline day is incomplete or missing', () => {
      const result = detectSuddenDrop({
        evaluatedDayYieldL: 1,
        evaluatedDayDataQuality: 'complete',
        baselineDaysDataQuality: [
          'complete',
          'complete',
          'missing',
          'complete',
          'complete',
          'complete',
          'complete',
        ] satisfies DimDataQuality[],
        baselineAvgYieldL: 10,
        dropThresholdPct: 30,
      });
      expect(result).toEqual({ fired: false, dropPct: null });
    });

    it('guards against a non-positive baseline average', () => {
      const result = detectSuddenDrop({
        evaluatedDayYieldL: 0,
        evaluatedDayDataQuality: 'complete',
        baselineDaysDataQuality: ALL_COMPLETE,
        baselineAvgYieldL: 0,
        dropThresholdPct: 30,
      });
      expect(result).toEqual({ fired: false, dropPct: null });
    });
  });

  describe('detectLowPeakByDim', () => {
    it('does not fire before the configured DIM', () => {
      expect(
        detectLowPeakByDim({
          currentDim: 40,
          peakMilkYield: null,
          lowPeakByDimDays: 60,
          minExpectedPeakYieldL: 8,
        }),
      ).toBe(false);
    });

    it('fires at/after the configured DIM with no recorded peak yet', () => {
      expect(
        detectLowPeakByDim({
          currentDim: 60,
          peakMilkYield: null,
          lowPeakByDimDays: 60,
          minExpectedPeakYieldL: 8,
        }),
      ).toBe(true);
    });

    it('fires when the recorded peak is below the minimum', () => {
      expect(
        detectLowPeakByDim({
          currentDim: 70,
          peakMilkYield: 6,
          lowPeakByDimDays: 60,
          minExpectedPeakYieldL: 8,
        }),
      ).toBe(true);
    });

    it('does not fire when the recorded peak meets the minimum', () => {
      expect(
        detectLowPeakByDim({
          currentDim: 70,
          peakMilkYield: 8,
          lowPeakByDimDays: 60,
          minExpectedPeakYieldL: 8,
        }),
      ).toBe(false);
    });
  });

  describe('detectLongLactationNotPregnant', () => {
    it('fires beyond the threshold with no active pregnancy', () => {
      expect(
        detectLongLactationNotPregnant({
          currentDim: 150,
          longLactationDimThresholdDays: 120,
          hasActivePregnancy: false,
        }),
      ).toBe(true);
    });

    it('does not fire when pregnant', () => {
      expect(
        detectLongLactationNotPregnant({
          currentDim: 150,
          longLactationDimThresholdDays: 120,
          hasActivePregnancy: true,
        }),
      ).toBe(false);
    });

    it('does not fire before the threshold', () => {
      expect(
        detectLongLactationNotPregnant({
          currentDim: 100,
          longLactationDimThresholdDays: 120,
          hasActivePregnancy: false,
        }),
      ).toBe(false);
    });
  });

  describe('detectDryOffApproaching', () => {
    it('fires within the lead window', () => {
      const now = new Date('2026-08-07T00:00:00.000Z');
      expect(
        detectDryOffApproaching({
          recommendedDryOffAt: new Date('2026-08-15T00:00:00.000Z'),
          now,
          leadDays: 14,
        }),
      ).toBe(true);
    });

    it('does not fire outside the lead window', () => {
      const now = new Date('2026-08-07T00:00:00.000Z');
      expect(
        detectDryOffApproaching({
          recommendedDryOffAt: new Date('2026-08-25T00:00:00.000Z'),
          now,
          leadDays: 14,
        }),
      ).toBe(false);
    });

    it('does not fire once the date has passed (that is overdue territory)', () => {
      const now = new Date('2026-08-07T00:00:00.000Z');
      expect(
        detectDryOffApproaching({
          recommendedDryOffAt: new Date('2026-08-01T00:00:00.000Z'),
          now,
          leadDays: 14,
        }),
      ).toBe(false);
    });

    it('does not fire with no projection', () => {
      expect(
        detectDryOffApproaching({
          recommendedDryOffAt: null,
          now: new Date(),
          leadDays: 14,
        }),
      ).toBe(false);
    });
  });

  describe('detectPlannedDryOffDue', () => {
    it('fires exactly on the planned date', () => {
      const now = new Date('2026-08-07T09:00:00.000Z');
      expect(
        detectPlannedDryOffDue({
          plannedDryOffAt: new Date('2026-08-07T00:00:00.000Z'),
          now,
        }),
      ).toBe(true);
    });

    it('does not fire on a different day', () => {
      const now = new Date('2026-08-07T00:00:00.000Z');
      expect(
        detectPlannedDryOffDue({
          plannedDryOffAt: new Date('2026-08-08T00:00:00.000Z'),
          now,
        }),
      ).toBe(false);
    });

    it('does not fire with no planned date', () => {
      expect(
        detectPlannedDryOffDue({ plannedDryOffAt: null, now: new Date() }),
      ).toBe(false);
    });
  });

  describe('detectDryOffOverdue', () => {
    it('fires once the recommended date has passed', () => {
      const now = new Date('2026-08-07T00:00:00.000Z');
      expect(
        detectDryOffOverdue({
          recommendedDryOffAt: new Date('2026-08-01T00:00:00.000Z'),
          now,
        }),
      ).toBe(true);
    });

    it('does not fire on the exact day', () => {
      const now = new Date('2026-08-07T00:00:00.000Z');
      expect(
        detectDryOffOverdue({
          recommendedDryOffAt: new Date('2026-08-07T00:00:00.000Z'),
          now,
        }),
      ).toBe(false);
    });

    it('does not fire in the future', () => {
      const now = new Date('2026-08-07T00:00:00.000Z');
      expect(
        detectDryOffOverdue({
          recommendedDryOffAt: new Date('2026-08-10T00:00:00.000Z'),
          now,
        }),
      ).toBe(false);
    });

    it('does not fire with no projection', () => {
      expect(
        detectDryOffOverdue({ recommendedDryOffAt: null, now: new Date() }),
      ).toBe(false);
    });
  });

  describe('detectLowProductionDryOffReview', () => {
    it('fires when every day in the trailing window is at/under the threshold', () => {
      expect(
        detectLowProductionDryOffReview({
          recentDailyYieldsL: [10, 8, 4, 3, 2],
          thresholdL: 5,
          consecutiveDaysRequired: 3,
        }),
      ).toBe(true);
    });

    it('does not fire when a day in the window exceeds the threshold', () => {
      expect(
        detectLowProductionDryOffReview({
          recentDailyYieldsL: [10, 8, 6, 3, 2],
          thresholdL: 5,
          consecutiveDaysRequired: 3,
        }),
      ).toBe(false);
    });

    it('does not fire without enough history', () => {
      expect(
        detectLowProductionDryOffReview({
          recentDailyYieldsL: [2, 1],
          thresholdL: 5,
          consecutiveDaysRequired: 3,
        }),
      ).toBe(false);
    });
  });
});

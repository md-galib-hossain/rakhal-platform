/**
 * RAKHAL-476: pure conception / calving estimate for a positive pregnancy
 * check. Priority (first match wins):
 *   1. linked breeding event: conception = breedingDate
 *   2. `gestationDay` recorded at the check: conception = check - gestationDay
 *   3. `expectedCalvingDate` known: conception = expected - 280
 *   4. nothing known: conception stays UNKNOWN (null) with no calving date
 *      (RAKHAL-482; was check - 90 d in RAKHAL-476). Never the check date
 *      itself: that put calving as late as the cow's gestation age at the check.
 */
export const ESTIMATE_GESTATION_DAYS = 280;

export type ConceptionEstimateSource =
  | 'BREEDING'
  | 'GESTATION_DAY'
  | 'EXPECTED_CALVING'
  | 'FALLBACK';

export interface PregnancyEstimateInput {
  diagnosisDate: Date;
  breedingDate?: Date | null;
  gestationDay?: number | null;
  expectedCalvingDate?: Date | null;
}

export type ConceptionConfidence = 'RECORDED' | 'ESTIMATED' | 'UNKNOWN';

export interface PregnancyEstimate {
  /** Null only when `confidence` is UNKNOWN. */
  conceptionDate: Date | null;
  /** conception + 280 d: the system's own estimate. */
  calculatedCalvingDate: Date | null;
  source: ConceptionEstimateSource;
  confidence: ConceptionConfidence;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

export function estimatePregnancyDates(
  input: PregnancyEstimateInput,
): PregnancyEstimate {
  let conceptionDate: Date | null;
  let source: ConceptionEstimateSource;
  if (input.breedingDate) {
    conceptionDate = input.breedingDate;
    source = 'BREEDING';
  } else if (input.gestationDay != null && input.gestationDay > 0) {
    conceptionDate = addDays(input.diagnosisDate, -input.gestationDay);
    source = 'GESTATION_DAY';
  } else if (input.expectedCalvingDate) {
    conceptionDate = addDays(
      input.expectedCalvingDate,
      -ESTIMATE_GESTATION_DAYS,
    );
    source = 'EXPECTED_CALVING';
  } else {
    conceptionDate = null;
    source = 'FALLBACK';
  }
  return {
    conceptionDate,
    calculatedCalvingDate: conceptionDate
      ? addDays(conceptionDate, ESTIMATE_GESTATION_DAYS)
      : null,
    source,
    confidence:
      source === 'BREEDING'
        ? 'RECORDED'
        : source === 'FALLBACK'
          ? 'UNKNOWN'
          : 'ESTIMATED',
  };
}

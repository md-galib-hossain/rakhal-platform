import { estimatePregnancyDates } from './pregnancy-estimate';

/**
 * RAKHAL-482: reproduction state as a pure fold over a cow's ACTIVE
 * reproduction facts, sorted by event date. Each fact is valid on its own
 * (a positive check with no AI, a calving with no pregnancy, a history "last
 * AI"), and the same facts give the same result in any insertion order.
 * No framework, no Prisma.
 */
export type FoldFactType =
  | 'BREEDING'
  | 'PREG_CHECK'
  | 'CALVING'
  | 'ABORTION'
  | 'HEAT';

export interface FoldFact {
  id: string;
  type: FoldFactType;
  at: Date;
  provenance: 'RECORDED' | 'HISTORICAL';
  /** BREEDING: false once return-to-heat or a negative check closed it (default true). */
  open?: boolean;
  /** BREEDING: it ended in a confirmed pregnancy (used to date conception when the check is not linked). */
  endedInPregnancy?: boolean;
  /** PREG_CHECK */
  result?: 'PREGNANT' | 'NOT_PREGNANT' | 'SUSPECTED';
  gestationDay?: number | null;
  expectedCalvingDate?: Date | null;
  /** PREG_CHECK: date of the breeding it is explicitly linked to. */
  breedingDate?: Date | null;
}

export interface FoldedPregnancy {
  checkedAt: Date;
  conceptionDate: Date | null;
  confidence: 'RECORDED' | 'ESTIMATED' | 'UNKNOWN';
  expectedCalvingDate: Date | null;
  /** The positive check was a history entry. */
  historical: boolean;
}

export interface FoldResult {
  hasActivePregnancy: boolean;
  pregnancy: FoldedPregnancy | null;
  /** A breeding still waiting for its pregnancy check. */
  pendingBreeding: { id: string; at: Date; historical: boolean } | null;
  lastBreedingAt: Date | null;
  lastCalvingAt: Date | null;
  lastCheckAt: Date | null;
  lastAbortionAt: Date | null;
}

const RANK: Record<FoldFactType, number> = {
  BREEDING: 0,
  HEAT: 1,
  PREG_CHECK: 2,
  CALVING: 3,
  ABORTION: 4,
};

/** Deterministic order: date, then a fixed type rank, then id. */
export function sortFacts(facts: readonly FoldFact[]): FoldFact[] {
  return [...facts].sort(
    (a, b) =>
      a.at.getTime() - b.at.getTime() ||
      RANK[a.type] - RANK[b.type] ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** A breeding that ended in a pregnancy counts when it is at most 150 days before the check. */
function withinWindow(breeding: Date | null, check: Date): Date | null {
  if (!breeding) return null;
  const days = (check.getTime() - breeding.getTime()) / 86400000;
  return days >= 0 && days <= 150 ? breeding : null;
}

export function foldReproduction(facts: readonly FoldFact[]): FoldResult {
  let pregnancy: FoldedPregnancy | null = null;
  let pending: FoldResult['pendingBreeding'] = null;
  let lastBreedingAt: Date | null = null;
  let lastPregnantBreedingAt: Date | null = null;
  let lastCalvingAt: Date | null = null;
  let lastCheckAt: Date | null = null;
  let lastAbortionAt: Date | null = null;

  for (const f of sortFacts(facts)) {
    switch (f.type) {
      case 'BREEDING':
        lastBreedingAt = f.at;
        if (f.endedInPregnancy) lastPregnantBreedingAt = f.at;
        // The newest breeding decides: a later closed one clears an older pending one.
        pending =
          f.open !== false
            ? { id: f.id, at: f.at, historical: f.provenance === 'HISTORICAL' }
            : null;
        break;
      case 'PREG_CHECK':
        lastCheckAt = f.at;
        if (f.result === 'PREGNANT' || f.result === undefined) {
          const est = estimatePregnancyDates({
            diagnosisDate: f.at,
            breedingDate:
              f.breedingDate ??
              pending?.at ??
              withinWindow(lastPregnantBreedingAt, f.at),
            gestationDay: f.gestationDay,
            expectedCalvingDate: f.expectedCalvingDate,
          });
          pregnancy = {
            checkedAt: f.at,
            conceptionDate: est.conceptionDate,
            confidence: est.confidence,
            expectedCalvingDate:
              f.expectedCalvingDate ?? est.calculatedCalvingDate,
            historical: f.provenance === 'HISTORICAL',
          };
          pending = null;
        } else if (f.result === 'NOT_PREGNANT') {
          pregnancy = null;
          pending = null;
        }
        // SUSPECTED: nothing changes, the breeding stays pending.
        break;
      case 'CALVING':
        lastCalvingAt = f.at;
        pregnancy = null;
        pending = null;
        break;
      case 'ABORTION':
        lastAbortionAt = f.at;
        pregnancy = null;
        pending = null;
        break;
      default:
        break; // HEAT does not change state by itself
    }
  }

  return {
    hasActivePregnancy: pregnancy !== null,
    pregnancy,
    pendingBreeding: pending,
    lastBreedingAt,
    lastCalvingAt,
    lastCheckAt,
    lastAbortionAt,
  };
}

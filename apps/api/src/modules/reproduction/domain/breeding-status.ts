import { BreedingStatus } from '@prisma/client';

/**
 * Pure derivation of `BreedingEvent.status` from the downstream facts of its
 * chain (RAKHAL-299/301). Today the five `BreedingStatus` values are
 * imperative stored flips scattered across `reproduction.service.ts`
 * (`:273/413/457/548/980/1362`) — this function is the single source of
 * truth an edit handler (RAKHAL-305) can call after any downstream mutation
 * to recompute the status instead of hand-patching it.
 *
 * Priority order, first match wins: `CALVED > ABORTED > PREGNANT > FAILED >
 * RETURNED_TO_HEAT > PENDING_CHECK`. A breeding that led to both a diagnosis
 * and a calving is `CALVED`, not `PREGNANT` — the most-progressed fact
 * always wins.
 */
export interface BreedingStatusFacts {
  /** At least one `CalvingEvent` traces back to this breeding (via its `Pregnancy`). */
  hasCalving: boolean;
  /** At least one `AbortionEvent` traces back to this breeding (via its `Pregnancy`). */
  hasAbortion: boolean;
  /** This breeding has a live (non-CALVED/ABORTED/FAILED) `Pregnancy`. */
  hasActivePregnancy: boolean;
  /** This breeding's most recent `PregnancyDiagnosis` result is `NOT_PREGNANT`. */
  hasFailedDiagnosis: boolean;
  /** RAKHAL-316: a `HeatEvent.returnedFromBreedingEventId` references this
   * breeding — farmer-confirmed return to heat, no diagnosis performed. */
  hasReturnedToHeat: boolean;
}

export function deriveBreedingStatus(
  facts: BreedingStatusFacts,
): BreedingStatus {
  if (facts.hasCalving) return BreedingStatus.CALVED;
  if (facts.hasAbortion) return BreedingStatus.ABORTED;
  if (facts.hasActivePregnancy) return BreedingStatus.PREGNANT;
  if (facts.hasFailedDiagnosis) return BreedingStatus.FAILED;
  if (facts.hasReturnedToHeat) return BreedingStatus.RETURNED_TO_HEAT;
  return BreedingStatus.PENDING_CHECK;
}

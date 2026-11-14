/**
 * Pure milk-eligibility domain helper (RAKHAL-278). No framework/Prisma deps so it
 * is trivially unit-testable, mirroring the `milk-disposition.ts` precedent
 * (RAKHAL-277).
 *
 * This is a related but *distinct* concern from `resolveMilkDisposition()`:
 * that function resolves a single **per-log-entry** classification (one
 * `MilkDisposition` value per log row) and, per its own documented v2 call,
 * deliberately collapses simultaneous restrictions into one winning value
 * (`WITHHELD` beats `COLOSTRUM`).
 *
 * `MilkEligibility` is an **animal-level** read-side view — "is this cow's
 * milk currently saleable, and why/why not" — for display purposes (e.g. a
 * cow detail page), and the v2 correction on *this* ticket is the opposite
 * lesson: a single winning `primaryStatus` is fine for precedence/routing,
 * but silently dropping a second true-but-not-winning restriction would lose
 * real information (a cow can be both in her colostrum window *and* under an
 * antibiotic withdrawal at the same time). `reasons[]` exists so neither
 * fact is ever lost, even though `primaryStatus` still picks one winner for
 * simple "can I sell this milk right now" UI logic.
 */

export type MilkEligibilityStatus =
  | 'SALEABLE'
  | 'WITHHELD'
  | 'COLOSTRUM'
  | 'DISCARD_REQUIRED';

export type MilkRestrictionReason =
  | 'COLOSTRUM_PERIOD'
  | 'MEDICINE_WITHDRAWAL'
  | 'MASTITIS'
  | 'VETERINARY_HOLD'
  | 'ABNORMAL_MILK'
  | 'OTHER';

export interface MilkEligibility {
  isSaleable: boolean;
  primaryStatus: MilkEligibilityStatus;
  reasons: MilkRestrictionReason[];
}

export interface DeriveMilkEligibilityInput {
  /** From `HealthService.activeMilkWithholdingCattleIds` (RAKHAL-276) — a pure read. */
  isWithheld: boolean;
  /** From the shared `isWithinColostrumWindow()` helper (RAKHAL-277's colostrum-window
   * check, extracted so this ticket doesn't re-implement or diverge from it). */
  isInColostrumWindow: boolean;
  /** From `AnimalHoldService.activeHoldsForCattle(farmId, cattleId, 'MILK_DISCARD')`
   * (RAKHAL-280) — no separate manual-flag mechanism. */
  hasDiscardRequiredHold: boolean;
}

/**
 * Derives a cow's current milk eligibility for display.
 *
 * Precedence for `primaryStatus` (ticket's explicit ask):
 * `DISCARD_REQUIRED` (active `AnimalHold` type `MILK_DISCARD`) >
 * `WITHHELD` (active `SafetyWithdrawal`) > `COLOSTRUM` (colostrum window) >
 * `SALEABLE`.
 *
 * `reasons[]` collects **every** applicable restriction, not just the winning
 * one — e.g. a cow both withheld and in her colostrum window gets
 * `primaryStatus: 'WITHHELD'`, `reasons: ['MEDICINE_WITHDRAWAL', 'COLOSTRUM_PERIOD']`.
 *
 * `MASTITIS`/`VETERINARY_HOLD`/`ABNORMAL_MILK` are reserved for future
 * finer-grained sourcing (e.g. a `HealthCondition`-aware withdrawal reason, or
 * reading `AnimalHold.reason` free text) — this function never produces them
 * since no input here backs them with real data yet. A discard-required hold
 * maps to the generic `OTHER` reason (the `AnimalHold` mechanism carries a
 * free-text `reason` field, not a structured category, so there's nothing
 * more specific to source from a plain boolean check).
 */
export function deriveMilkEligibility({
  isWithheld,
  isInColostrumWindow,
  hasDiscardRequiredHold,
}: DeriveMilkEligibilityInput): MilkEligibility {
  const reasons: MilkRestrictionReason[] = [];
  if (hasDiscardRequiredHold) reasons.push('OTHER');
  if (isWithheld) reasons.push('MEDICINE_WITHDRAWAL');
  if (isInColostrumWindow) reasons.push('COLOSTRUM_PERIOD');

  let primaryStatus: MilkEligibilityStatus;
  if (hasDiscardRequiredHold) {
    primaryStatus = 'DISCARD_REQUIRED';
  } else if (isWithheld) {
    primaryStatus = 'WITHHELD';
  } else if (isInColostrumWindow) {
    primaryStatus = 'COLOSTRUM';
  } else {
    primaryStatus = 'SALEABLE';
  }

  return {
    isSaleable: primaryStatus === 'SALEABLE',
    primaryStatus,
    reasons,
  };
}

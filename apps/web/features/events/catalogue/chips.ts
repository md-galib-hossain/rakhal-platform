import type { AnimalChip, AnimalFacts } from "../types";

/** Farm setting `lactationFreshDays` (owner Q1, default 21) — pass the real value once settings serve it. */
export const DEFAULT_FRESH_DAYS = 21;

const NOT_BREEDING_HEIFER = new Set(["WEANED_HEIFER", "GROWING_HEIFER"]);
const WEANED_STAGES = new Set(["WEANED_HEIFER", "WEANER_BULL"]);

/**
 * Derives the owner's category chips (all / male / female / cows / heifers / weaned / calves / pregnant /
 * milking / dry / fresh / open) plus Fattening from what `CattleDetail` already carries (RFE-153 fallback
 * until RAKHAL-479 serves flags). "All" is implicit and not returned. Rules: 03 §4.3 + 04 §3.
 */
export function deriveChips(facts: AnimalFacts, freshDays: number = DEFAULT_FRESH_DAYS): Set<AnimalChip> {
  const chips = new Set<AnimalChip>();
  const female = facts.gender === "FEMALE";
  chips.add(female ? "female" : "male");

  if (facts.animalCategory === "CALF") chips.add("calves");
  if (facts.animalCategory === "HEIFER") chips.add("heifers");
  if (facts.animalCategory === "COW") chips.add("cows");
  if (facts.lifecycleSubStage && WEANED_STAGES.has(facts.lifecycleSubStage)) chips.add("weaned");

  const pregnant = facts.reproductiveStatus === "PREGNANT";
  if (pregnant) chips.add("pregnant");

  const breedingAge =
    facts.animalCategory === "COW" ||
    (facts.animalCategory === "HEIFER" && !(facts.lifecycleSubStage && NOT_BREEDING_HEIFER.has(facts.lifecycleSubStage)));
  if (female && breedingAge && !pregnant && facts.reproductiveStatus !== "BRED_AWAITING_CONFIRMATION") chips.add("open");

  if (female && facts.productionStatus === "MILKING") {
    chips.add("milking");
    if (facts.dim != null && facts.dim <= freshDays) chips.add("fresh");
  }
  if (female && facts.productionStatus === "DRY") chips.add("dry");
  if (facts.purpose === "FATTENING") chips.add("fattening");
  return chips;
}

import { deriveChips } from "@/features/events/catalogue/chips";
import { eligibilityByKey } from "@/features/events/catalogue/eligibility";
import { EVENT_BY_KEY } from "@/features/events/catalogue/events";
import type { AnimalFacts, EventKey } from "@/features/events/types";

export const MAX_QUICK_ACTIONS = 3;

export interface QuickActionFacts extends AnimalFacts {
  deletedAt?: string | null;
  healthStatus?: string | null;
}

/** Table of 05-modal-redesign §3.4, first matching row wins. "Close case" and "Milk withhold" are not events (they are
 * case actions on the Health card), so a sick animal gets Treatment + Weight until those are wired into the header. */
function wanted(facts: QuickActionFacts): EventKey[] {
  const chips = deriveChips(facts);
  const sick = facts.healthStatus === "SICK" || facts.healthStatus === "IN_TREATMENT" || facts.healthStatus === "QUARANTINE";
  if (sick) return ["TREATMENT", "WEIGHT"];
  if (chips.has("calves")) return ["WEIGHT", "VACCINATION", "WEAN"];
  if (chips.has("pregnant") && facts.productionStatus === "DRY") return ["CALVING", "ILLNESS", "WEIGHT"];
  if (chips.has("pregnant")) return ["PREG_CHECK", "DRY_OFF", "VACCINATION"];
  if (facts.reproductiveStatus === "BRED_AWAITING_CONFIRMATION") return ["PREG_CHECK", "HEAT", "ILLNESS"];
  if (chips.has("open")) return ["HEAT", "SERVICE", "WEIGHT"];
  return ["WEIGHT", "VACCINATION", "ILLNESS"];
}

/**
 * Up to three state-driven shortcuts for the workspace header (RFE-171). Nothing for an animal that left the herd or
 * was deleted; an event the animal cannot take (hard block in the matrix) or the role cannot record is dropped.
 */
export function quickActionsFor(facts: QuickActionFacts, can: (permission: string) => boolean): EventKey[] {
  if (facts.deletedAt != null) return [];
  if (facts.herdStatus && facts.herdStatus !== "ACTIVE") return [];
  return wanted(facts)
    .filter((key) => can(EVENT_BY_KEY[key].permission) && eligibilityByKey(key, facts).status !== "block")
    .slice(0, MAX_QUICK_ACTIONS);
}

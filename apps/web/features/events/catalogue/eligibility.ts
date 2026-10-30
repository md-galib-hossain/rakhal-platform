import type { AnimalChip, AnimalFacts, Eligibility, EventDef, EventKey } from "../types";
import { deriveChips } from "./chips";
import { EVENT_BY_KEY, EVENT_CATALOGUE } from "./events";

/** Evaluation order: sex first so a bull asked for "Calving" reports "only for female", not the stage chip. */
const BLOCK_ORDER: AnimalChip[] = ["female", "male", "calves", "heifers", "cows", "pregnant", "open", "milking", "dry", "fattening"];
const PRODUCTION_CHIPS: AnimalChip[] = ["milking", "dry"];

/**
 * 04 §3 resolution of one event for one animal.
 *  - blocked: left the herd (only Note stays), `requiresAny` missing, `blockedBy`, or any active chip's cell is "—".
 *  - warn: an active chip's cell is "⚠". A milking/dry ⚠ is ignored when the pregnant/open cell is ✓, because
 *    that axis describes the real situation ("Gives birth" is fine for a milking cow that is pregnant).
 */
export function eligibilityFor(def: EventDef, facts: AnimalFacts, chips: Set<AnimalChip> = deriveChips(facts)): Eligibility {
  if (facts.herdStatus && facts.herdStatus !== "ACTIVE" && def.key !== "NOTE") {
    return { status: "block", reason: { key: "leftHerd" } };
  }
  if (def.requiresAny && !def.requiresAny.some((chip) => chips.has(chip))) {
    return { status: "block", reason: { key: "onlyFor", chips: def.requiresAny } };
  }
  const custom = def.blockedBy?.(facts);
  if (custom) return { status: "block", reason: custom };

  for (const chip of BLOCK_ORDER) {
    if (!chips.has(chip) || def.cells[chip] !== "block") continue;
    if (chip === "male" || chip === "female") {
      return { status: "block", reason: { key: "onlyFor", chips: [chip === "male" ? "female" : "male"] } };
    }
    return { status: "block", reason: { key: "notFor", chip } };
  }

  const reproductionDecides = [...chips].some((chip) => (chip === "pregnant" || chip === "open") && def.cells[chip] === "ok");
  const warned = BLOCK_ORDER.filter(
    (chip) => chips.has(chip) && def.cells[chip] === "warn" && !(reproductionDecides && PRODUCTION_CHIPS.includes(chip)),
  );
  return warned.length > 0 ? { status: "warn", chips: warned } : { status: "ok" };
}

export function eligibilityByKey(key: EventKey, facts: AnimalFacts, chips?: Set<AnimalChip>): Eligibility {
  return eligibilityFor(EVENT_BY_KEY[key], facts, chips);
}

/** Every catalogue entry with its resolution; the caller filters by permission and `status`. */
export function resolveCatalogue(facts: AnimalFacts, chips: Set<AnimalChip> = deriveChips(facts)) {
  return EVENT_CATALOGUE.map((def) => ({ def, eligibility: eligibilityFor(def, facts, chips) }));
}

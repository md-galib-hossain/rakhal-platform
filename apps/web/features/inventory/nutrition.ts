import { OPTIONAL_NUTRIENT_KEYS, type NutritionInput, type NutritionProfile } from "./types";
import type { NutritionFormInput } from "./schemas";

/** Every field optional while a farmer is still typing; the form schema enforces DM/CP/ME. */
export type NutritionDraft = Partial<NutritionFormInput>;

/** Drops empty optionals so an unmeasured nutrient reaches the backend as "absent" (stored null),
 * never as zero (ADR-026 D4). */
export function toNutritionInput(n: NutritionFormInput): NutritionInput {
  const out: NutritionInput = { dmPct: n.dmPct, cpPct: n.cpPct, meMjPerKgDm: n.meMjPerKgDm };
  for (const key of OPTIONAL_NUTRIENT_KEYS) {
    if (n[key] != null) out[key] = n[key];
  }
  out.nutritionSource = n.nutritionSource ?? "FARM_ESTIMATE";
  if (n.sourceRef) out.sourceRef = n.sourceRef;
  if (n.note) out.note = n.note;
  return out;
}

/** A stored profile → the editable draft (unmeasured nutrients stay undefined, not zero). */
export function profileToDraft(profile: NutritionProfile): NutritionDraft {
  const draft: NutritionDraft = {
    dmPct: profile.dmPct,
    cpPct: profile.cpPct,
    meMjPerKgDm: profile.meMjPerKgDm,
    nutritionSource: profile.nutritionSource,
    sourceRef: profile.sourceRef ?? undefined,
    note: profile.note ?? undefined,
  };
  for (const key of OPTIONAL_NUTRIENT_KEYS) draft[key] = profile[key] ?? undefined;
  return draft;
}

/** The measured values only — what "unchanged from the source" is compared against. */
function measuredValues(n: NutritionDraft): Record<string, number | undefined> {
  const out: Record<string, number | undefined> = { dmPct: n.dmPct, cpPct: n.cpPct, meMjPerKgDm: n.meMjPerKgDm };
  for (const key of OPTIONAL_NUTRIENT_KEYS) out[key] = n[key] ?? undefined;
  return out;
}

export function sameMeasured(a: NutritionDraft, b: NutritionDraft): boolean {
  const x = measuredValues(a);
  const y = measuredValues(b);
  return Object.keys(x).every((key) => x[key] === y[key]);
}

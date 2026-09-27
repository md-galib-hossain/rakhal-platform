import type { RequirementOverrideFormValues } from "@/features/feed/schemas";
import type { FeedRequirements, RequirementOverrideRow } from "@/features/feed/types";

/** The inputs a manager can set by hand (MILESTONE 28b). Same keys as the form and the PUT payload. */
export type EditableKey = Exclude<keyof RequirementOverrideFormValues, "note">;

/** A nutrient typed by hand: the form key, where its calculated value lives, and where a saved row keeps it. */
export interface InputRow {
  kind: "input";
  /** i18n key under `cattle.feeding.requirement.nutrients`. */
  nutrient: string;
  unit: string;
  formKey: EditableKey;
  reqKey: keyof FeedRequirements;
  rowKey: keyof RequirementOverrideRow;
}

/** A figure that follows from the typed ones — shown live, never typed. */
export interface DerivedRow {
  kind: "derived";
  nutrient: string;
  unit: string;
  reqKey: keyof FeedRequirements;
  /** The value while the form is open, from what is typed so far. `null` when it cannot be worked out yet. */
  live: (v: Record<EditableKey, number>, calculated: FeedRequirements) => number | null;
}

export type ProfileRow = InputRow | DerivedRow;

export interface ProfileSection {
  /** i18n key under `cattle.feeding.requirement.sections`. */
  key: "intake" | "protein" | "fibre" | "digestible" | "minerals";
  rows: ProfileRow[];
}

const input = (
  nutrient: string,
  unit: string,
  formKey: EditableKey,
  reqKey: keyof FeedRequirements,
  rowKey: keyof RequirementOverrideRow,
): InputRow => ({ kind: "input", nutrient, unit, formKey, reqKey, rowKey });

/** The whole nutrient profile, grouped the way a nutritionist reads it. Order = display order. */
export const PROFILE_SECTIONS: ProfileSection[] = [
  {
    key: "intake",
    rows: [
      input("dm", "kg", "dmKg", "dm_kg", "dm_kg"),
      input("me", "MJ", "meMj", "me_mj", "me_mj"),
      {
        kind: "derived",
        nutrient: "ne",
        unit: "Mcal",
        reqKey: "ne_mcal",
        // NEL is ME times a fixed farm efficiency, so it scales with the typed energy.
        live: (v, c) => (c.me_mj > 0 ? (v.meMj * c.ne_mcal) / c.me_mj : null),
      },
      {
        kind: "derived",
        nutrient: "energyDensity",
        unit: "MJ/kg DM",
        reqKey: "energy_density_mj_per_kg_dm",
        live: (v) => (v.dmKg > 0 ? v.meMj / v.dmKg : null),
      },
    ],
  },
  {
    key: "protein",
    rows: [
      input("cp", "kg", "cpKg", "cp_kg", "cp_kg"),
      {
        kind: "derived",
        nutrient: "cpPct",
        unit: "% DM",
        reqKey: "cp_pct_of_dm",
        live: (v) => (v.dmKg > 0 ? (v.cpKg / v.dmKg) * 100 : null),
      },
      input("rdp", "% CP", "rdpPct", "rdp_pct", "rdp_pct"),
      input("rup", "% CP", "rupPct", "rup_pct", "rup_pct"),
    ],
  },
  {
    key: "fibre",
    rows: [
      input("ndf", "kg", "ndfKg", "ndf_kg", "ndf_kg"),
      input("ndfMax", "kg", "ndfMaxKg", "ndf_max_kg", "ndf_max_kg"),
      input("adf", "kg", "adfKg", "adf_kg", "adf_kg"),
      input("fat", "kg", "fatKg", "fat_kg", "fat_kg"),
    ],
  },
  { key: "digestible", rows: [input("tdn", "kg", "tdnKg", "tdn_kg", "tdn_kg")] },
  {
    key: "minerals",
    rows: [
      input("ca", "kg", "calciumKg", "calcium_kg", "calcium_kg"),
      input("p", "kg", "phosphorusKg", "phosphorus_kg", "phosphorus_kg"),
      {
        kind: "derived",
        nutrient: "caPRatio",
        unit: ": 1",
        reqKey: "ca_p_ratio_target",
        live: (v) => (v.phosphorusKg > 0 ? v.calciumKg / v.phosphorusKg : null),
      },
    ],
  },
];

export const INPUT_ROWS: InputRow[] = PROFILE_SECTIONS.flatMap((s) => s.rows).filter(
  (r): r is InputRow => r.kind === "input",
);

/** Up to 2 decimals, no trailing zeros; a missing or non-finite value reads as a dash. */
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Number(n.toFixed(2)).toString();
}

/** A form-field string (what the input holds). */
export const asField = (n: number): string => String(Math.round(n * 100) / 100);

/** Percent difference of `manual` against `calculated`; `null` when either is missing or the base is 0. */
export function diffPct(manual: number | null | undefined, calculated: number | null | undefined): number | null {
  if (manual == null || calculated == null || !Number.isFinite(manual) || !(calculated !== 0)) return null;
  return ((manual - calculated) / calculated) * 100;
}

/**
 * The form's starting values: the values in force (or the last manual ones) where they exist, else today's
 * calculated figure. A row saved before 28b only has DM/CP/ME, so the rest come from the calculated profile.
 */
export function formDefaults(
  calculated: FeedRequirements,
  base: { row: RequirementOverrideRow | null; resolved: FeedRequirements | null },
): Record<EditableKey, string> {
  const out = {} as Record<EditableKey, string>;
  for (const r of INPUT_ROWS) {
    const fromRow = base.row ? (base.row[r.rowKey] as number | null) : null;
    // While manual is on, `resolved` already carries the values in force (with the pre-28b fallbacks applied).
    const fromResolved = base.row?.effective_to === null ? (base.resolved?.[r.reqKey] as number | null | undefined) : null;
    const v = fromRow ?? fromResolved ?? (calculated[r.reqKey] as number | null | undefined) ?? 0;
    out[r.formKey] = asField(v);
  }
  return out;
}

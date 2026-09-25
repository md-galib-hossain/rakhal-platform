/**
 * Tuning numbers for the dairy-cow requirement model (RAKHAL-408, PRD §12.8/§12.13).
 *
 * These used to be private `const`s inside `requirements.ts`. They are now data: a
 * Rakhal-Admin-owned preset that a farm can partially override, resolved at runtime by
 * `RequirementSettingsService` (RAKHAL-409) in the order
 * **farm changes -> active preset -> the launch defaults below**.
 *
 * Same convention as `aqr-events.ts` (PRD §19.4): the defaults here are LAUNCH defaults,
 * not the runtime source of truth — the engine never reads them directly once a preset is
 * active. The equation *shape* stays in code; only these numbers are editable.
 *
 * Every field carries a plain-English name because it surfaces in an API response, an
 * Admin form and a farm-facing settings sheet. Units live in {@link REQUIREMENT_SETTING_FIELDS},
 * never crammed into the identifier. Each field's doc comment keeps the original constant
 * name so the NRC-2001 lineage stays traceable.
 *
 * Deliberately NOT here: `MJ_PER_MCAL` (4.184) stays a plain const in `requirements.ts`.
 * It is a unit conversion, not a nutritional assumption — nobody should be able to edit it.
 *
 * The values still carry RD-015(a)'s caveat: documented NRC-2001-style approximations
 * awaiting a nutritionist sign-off.
 */

/** One band of the pregnancy dry-matter-intake table (was `PREGNANCY_DM_STAGES`). */
export interface PregnancyIntakeStage {
  /** Upper bound of the band, in days of gestation (inclusive). */
  untilDay: number;
  /** Target intake for the band, as a fraction of body weight (0.02 = 2%). */
  percentOfBodyWeight: number;
}

export interface RequirementSettings {
  // -- Energy ---------------------------------------------------------------
  /** `ME_MAINT_PER_KG075` — maintenance energy per kg of metabolic weight (BW^0.75). */
  maintenanceEnergyPerMetabolicKg: number;
  /** `ME_PER_LITRE_AT_4PCT` — production energy per litre of milk at 4% fat. */
  energyPerLitreMilk: number;
  /** `ME_PER_FAT_POINT` — energy added/removed per 1% milk fat above/below 4%. */
  energyPerMilkFatPercent: number;
  /** `NEL_EFFICIENCY` — efficiency of converting metabolisable energy to net energy for lactation. */
  netEnergyEfficiency: number;

  // -- Protein --------------------------------------------------------------
  /** `CP_MAINT_G_PER_KG075` — maintenance crude protein per kg of metabolic weight. */
  maintenanceProteinPerMetabolicKg: number;
  /** `CP_G_PER_LITRE` — crude protein per litre of milk produced. */
  proteinPerLitreMilk: number;
  /** `RDP_PCT_OF_CP` — rumen-degradable protein as a share of total crude protein. */
  degradableProteinShare: number;
  /** `RUP_PCT_OF_CP` — rumen-undegradable protein as a share of total crude protein. */
  undegradableProteinShare: number;

  // -- Intake ---------------------------------------------------------------
  /** `DMI_FCM_COEF` — intake driven by 4% fat-corrected milk. */
  intakeFromMilkFactor: number;
  /** `DMI_METABOLIC_COEF` — intake driven by metabolic body weight. */
  intakeFromBodyWeightFactor: number;
  /** `DMI_CURVE_K` — how sharply intake ramps up over the lactation. */
  intakeCurveSteepness: number;
  /** `DMI_CURVE_OFFSET` — weeks-of-lactation offset in the intake ramp. */
  intakeCurveOffset: number;
  /** `DEFAULT_DIM_WHEN_UNKNOWN` — days-in-milk assumed when the cow has no record. */
  defaultDaysInMilk: number;
  /** RAKHAL-454 — body weight assumed when a cow has no weight record at all (flagged `weight_estimated`). */
  defaultWeightKg: number;

  // -- Feeding-program alerts (RAKHAL-458) ------------------------------------
  /** How far below the requirement a program's dry-matter supply may fall before it is flagged (percent). */
  alertDryMatterBelowPct: number;
  /** How far above the requirement dry-matter supply may rise before it is flagged (percent). */
  alertDryMatterAbovePct: number;
  /** Crude-protein supply may fall this far below the requirement (percent). */
  alertProteinBelowPct: number;
  /** Crude-protein supply may rise this far above the requirement (percent). */
  alertProteinAbovePct: number;
  /** Energy supply may fall this far below the requirement (percent). */
  alertEnergyBelowPct: number;
  /** Energy supply may rise this far above the requirement (percent). */
  alertEnergyAbovePct: number;
  /** RAKHAL-459a: how many days ahead the Feeding Grid warns about dry-off, calving and peak milk. */
  lookaheadDays: number;

  // -- Pregnancy ------------------------------------------------------------
  /** `PREGNANCY_DM_STAGES` — intake-by-gestation-stage table, ordered by `untilDay` ascending. */
  pregnancyIntakeStages: PregnancyIntakeStage[];
  /** `GESTATION_FULL_TERM_DAY` — full-term gestation length. */
  pregnancyLengthDays: number;
  /** `GESTATION_PEAK_ME_MJ` — extra energy at full term. */
  pregnancyPeakEnergy: number;
  /** `GESTATION_PEAK_CP_KG` — extra crude protein at full term. */
  pregnancyPeakProtein: number;

  // -- Heifer ---------------------------------------------------------------
  /** `HEIFER_DMI_PCT_BW` — heifer intake as a fraction of body weight. */
  heiferIntakePercentOfBodyWeight: number;
  /** `HEIFER_GROWTH_ME_MJ` — extra energy for growth. */
  heiferGrowthEnergy: number;
  /** `HEIFER_GROWTH_CP_KG` — extra crude protein for growth. */
  heiferGrowthProtein: number;

  // -- Body condition -------------------------------------------------------
  /** `TARGET_BCS` — the body-condition score the model formulates toward. */
  targetBodyCondition: number;
  /** `ME_ADJUST_PCT_PER_QUARTER_BCS` — maintenance-energy change per 0.25 body-condition step. */
  energyAdjustPerBodyConditionStep: number;
  /** `DM_ADJUST_KG_PER_BCS_UNIT` — intake change per full body-condition point. */
  intakeAdjustPerBodyConditionPoint: number;

  // -- Minerals & fibre -----------------------------------------------------
  /** `TDN_FRACTION_OF_DMI` — total digestible nutrients as a share of intake. */
  tdnShareOfIntake: number;
  /** `ADF_FRACTION_OF_DMI` — minimum acid detergent fibre as a share of intake. */
  adfShareOfIntake: number;
  /** `NDF_MIN_FRACTION_OF_DMI` — minimum neutral detergent fibre as a share of intake. */
  ndfMinShareOfIntake: number;
  /** `NDF_MAX_FRACTION_OF_DMI` — maximum neutral detergent fibre before intake is depressed. */
  ndfMaxShareOfIntake: number;
  /** `FAT_FRACTION_OF_DMI` — dietary fat as a share of intake. */
  fatShareOfIntake: number;
  /** `CA_MAINT_G_PER_KG_BW` — maintenance calcium per kg of body weight. */
  calciumPerBodyWeightKg: number;
  /** `CA_G_PER_LITRE` — calcium per litre of milk produced. */
  calciumPerLitreMilk: number;
  /** `P_MAINT_G_PER_KG_BW` — maintenance phosphorus per kg of body weight. */
  phosphorusPerBodyWeightKg: number;
  /** `P_G_PER_LITRE` — phosphorus per litre of milk produced. */
  phosphorusPerLitreMilk: number;
  /** `CA_P_RATIO_TARGET` — target calcium-to-phosphorus ratio, by mass. */
  calciumToPhosphorusTarget: number;
}

/** A partial set of changes layered over a base — an absent field means "inherit". */
export type RequirementSettingsChanges = Partial<RequirementSettings>;

/**
 * The built-in launch defaults. Byte-identical to the constants that lived in
 * `requirements.ts` before RAKHAL-408, so extracting them changed no output.
 */
export const DEFAULT_REQUIREMENT_SETTINGS: RequirementSettings = {
  maintenanceEnergyPerMetabolicKg: 0.49,
  energyPerLitreMilk: 5.0,
  energyPerMilkFatPercent: 0.25,
  netEnergyEfficiency: 0.62,

  maintenanceProteinPerMetabolicKg: 3.8,
  proteinPerLitreMilk: 85,
  degradableProteinShare: 62,
  undegradableProteinShare: 38,

  intakeFromMilkFactor: 0.372,
  intakeFromBodyWeightFactor: 0.0968,
  intakeCurveSteepness: 0.192,
  intakeCurveOffset: 3.67,
  defaultDaysInMilk: 100,
  defaultWeightKg: 450,

  alertDryMatterBelowPct: 10,
  alertDryMatterAbovePct: 10,
  alertProteinBelowPct: 10,
  alertProteinAbovePct: 20,
  alertEnergyBelowPct: 10,
  alertEnergyAbovePct: 10,
  lookaheadDays: 14,

  pregnancyIntakeStages: [
    { untilDay: 90, percentOfBodyWeight: 0.02 },
    { untilDay: 180, percentOfBodyWeight: 0.021 },
    { untilDay: 240, percentOfBodyWeight: 0.022 },
    { untilDay: 285, percentOfBodyWeight: 0.023 },
  ],
  pregnancyLengthDays: 280,
  pregnancyPeakEnergy: 8.4,
  pregnancyPeakProtein: 0.5,

  heiferIntakePercentOfBodyWeight: 0.025,
  heiferGrowthEnergy: 6.0,
  heiferGrowthProtein: 0.15,

  targetBodyCondition: 3.0,
  energyAdjustPerBodyConditionStep: 0.03,
  intakeAdjustPerBodyConditionPoint: 0.375,

  tdnShareOfIntake: 0.68,
  adfShareOfIntake: 0.19,
  ndfMinShareOfIntake: 0.3,
  ndfMaxShareOfIntake: 0.4,
  fatShareOfIntake: 0.04,
  calciumPerBodyWeightKg: 0.031,
  calciumPerLitreMilk: 1.22,
  phosphorusPerBodyWeightKg: 0.024,
  phosphorusPerLitreMilk: 0.9,
  calciumToPhosphorusTarget: 2.0,
};

/** UI grouping — drives the section headings in both the Admin form and the farm sheet. */
export type RequirementSettingGroup =
  | 'energy'
  | 'protein'
  | 'intake'
  | 'alerts'
  | 'pregnancy'
  | 'heifer'
  | 'bodyCondition'
  | 'mineralsAndFibre';

export interface RequirementSettingField {
  group: RequirementSettingGroup;
  /** Plain-English label. The UI localises from a key built off the field name; this is the en fallback. */
  label: string;
  /** Unit shown as helper text. Empty for dimensionless factors. */
  unit: string;
  /** Inclusive bounds. A value outside these is rejected — no admin or farm can produce a negative or absurd requirement. */
  min: number;
  max: number;
}

/** The scalar fields, with everything the two editors need. `pregnancyIntakeStages` is a table and validated separately. */
export const REQUIREMENT_SETTING_FIELDS: Record<
  Exclude<keyof RequirementSettings, 'pregnancyIntakeStages'>,
  RequirementSettingField
> = {
  maintenanceEnergyPerMetabolicKg: {
    group: 'energy',
    label: 'Maintenance energy per metabolic kg',
    unit: 'MJ / kg^0.75',
    min: 0.1,
    max: 2,
  },
  energyPerLitreMilk: {
    group: 'energy',
    label: 'Energy per litre of milk',
    unit: 'MJ / L',
    min: 1,
    max: 15,
  },
  energyPerMilkFatPercent: {
    group: 'energy',
    label: 'Energy per 1% milk fat',
    unit: 'MJ / L per %',
    min: 0,
    max: 2,
  },
  netEnergyEfficiency: {
    group: 'energy',
    label: 'Net energy conversion efficiency',
    unit: '',
    min: 0.1,
    max: 1,
  },

  maintenanceProteinPerMetabolicKg: {
    group: 'protein',
    label: 'Maintenance protein per metabolic kg',
    unit: 'g / kg^0.75',
    min: 0.5,
    max: 15,
  },
  proteinPerLitreMilk: {
    group: 'protein',
    label: 'Protein per litre of milk',
    unit: 'g / L',
    min: 20,
    max: 200,
  },
  degradableProteinShare: {
    group: 'protein',
    label: 'Degradable protein share',
    unit: '% of crude protein',
    min: 0,
    max: 100,
  },
  undegradableProteinShare: {
    group: 'protein',
    label: 'Undegradable protein share',
    unit: '% of crude protein',
    min: 0,
    max: 100,
  },

  intakeFromMilkFactor: {
    group: 'intake',
    label: 'Intake from milk',
    unit: 'kg DM per kg FCM',
    min: 0.05,
    max: 1.5,
  },
  intakeFromBodyWeightFactor: {
    group: 'intake',
    label: 'Intake from body weight',
    unit: 'kg DM / kg^0.75',
    min: 0.01,
    max: 0.5,
  },
  intakeCurveSteepness: {
    group: 'intake',
    label: 'Intake curve steepness',
    unit: '',
    min: 0.01,
    max: 1,
  },
  intakeCurveOffset: {
    group: 'intake',
    label: 'Intake curve offset',
    unit: 'weeks',
    min: 0,
    max: 20,
  },
  defaultDaysInMilk: {
    group: 'intake',
    label: 'Assumed days in milk when unknown',
    unit: 'days',
    min: 1,
    max: 500,
  },
  defaultWeightKg: {
    group: 'intake',
    label: 'Assumed body weight when unweighed',
    unit: 'kg',
    min: 100,
    max: 1000,
  },

  alertDryMatterBelowPct: {
    group: 'alerts',
    label: 'Dry matter: allowed shortfall',
    unit: '%',
    min: 0,
    max: 100,
  },
  alertDryMatterAbovePct: {
    group: 'alerts',
    label: 'Dry matter: allowed excess',
    unit: '%',
    min: 0,
    max: 100,
  },
  alertProteinBelowPct: {
    group: 'alerts',
    label: 'Protein: allowed shortfall',
    unit: '%',
    min: 0,
    max: 100,
  },
  alertProteinAbovePct: {
    group: 'alerts',
    label: 'Protein: allowed excess',
    unit: '%',
    min: 0,
    max: 100,
  },
  alertEnergyBelowPct: {
    group: 'alerts',
    label: 'Energy: allowed shortfall',
    unit: '%',
    min: 0,
    max: 100,
  },
  alertEnergyAbovePct: {
    group: 'alerts',
    label: 'Energy: allowed excess',
    unit: '%',
    min: 0,
    max: 100,
  },
  lookaheadDays: {
    group: 'alerts',
    label: 'Look-ahead: warn this many days before dry-off, calving or peak',
    unit: 'days',
    min: 1,
    max: 60,
  },

  pregnancyLengthDays: {
    group: 'pregnancy',
    label: 'Full-term gestation length',
    unit: 'days',
    min: 200,
    max: 320,
  },
  pregnancyPeakEnergy: {
    group: 'pregnancy',
    label: 'Extra energy at full term',
    unit: 'MJ / day',
    min: 0,
    max: 40,
  },
  pregnancyPeakProtein: {
    group: 'pregnancy',
    label: 'Extra protein at full term',
    unit: 'kg / day',
    min: 0,
    max: 3,
  },

  heiferIntakePercentOfBodyWeight: {
    group: 'heifer',
    label: 'Heifer intake',
    unit: 'fraction of body weight',
    min: 0.005,
    max: 0.06,
  },
  heiferGrowthEnergy: {
    group: 'heifer',
    label: 'Extra energy for growth',
    unit: 'MJ / day',
    min: 0,
    max: 40,
  },
  heiferGrowthProtein: {
    group: 'heifer',
    label: 'Extra protein for growth',
    unit: 'kg / day',
    min: 0,
    max: 3,
  },

  targetBodyCondition: {
    group: 'bodyCondition',
    label: 'Target body condition score',
    unit: '1-5 scale',
    min: 1,
    max: 5,
  },
  energyAdjustPerBodyConditionStep: {
    group: 'bodyCondition',
    label: 'Energy change per 0.25 condition step',
    unit: 'fraction of maintenance',
    min: 0,
    max: 0.5,
  },
  intakeAdjustPerBodyConditionPoint: {
    group: 'bodyCondition',
    label: 'Intake change per condition point',
    unit: 'kg DM',
    min: 0,
    max: 3,
  },

  tdnShareOfIntake: {
    group: 'mineralsAndFibre',
    label: 'Total digestible nutrients',
    unit: 'fraction of intake',
    min: 0.1,
    max: 1,
  },
  adfShareOfIntake: {
    group: 'mineralsAndFibre',
    label: 'Minimum acid detergent fibre',
    unit: 'fraction of intake',
    min: 0,
    max: 1,
  },
  ndfMinShareOfIntake: {
    group: 'mineralsAndFibre',
    label: 'Minimum neutral detergent fibre',
    unit: 'fraction of intake',
    min: 0,
    max: 1,
  },
  ndfMaxShareOfIntake: {
    group: 'mineralsAndFibre',
    label: 'Maximum neutral detergent fibre',
    unit: 'fraction of intake',
    min: 0,
    max: 1,
  },
  fatShareOfIntake: {
    group: 'mineralsAndFibre',
    label: 'Dietary fat',
    unit: 'fraction of intake',
    min: 0,
    max: 0.3,
  },
  calciumPerBodyWeightKg: {
    group: 'mineralsAndFibre',
    label: 'Maintenance calcium per kg body weight',
    unit: 'g / kg',
    min: 0,
    max: 1,
  },
  calciumPerLitreMilk: {
    group: 'mineralsAndFibre',
    label: 'Calcium per litre of milk',
    unit: 'g / L',
    min: 0,
    max: 10,
  },
  phosphorusPerBodyWeightKg: {
    group: 'mineralsAndFibre',
    label: 'Maintenance phosphorus per kg body weight',
    unit: 'g / kg',
    min: 0,
    max: 1,
  },
  phosphorusPerLitreMilk: {
    group: 'mineralsAndFibre',
    label: 'Phosphorus per litre of milk',
    unit: 'g / L',
    min: 0,
    max: 10,
  },
  calciumToPhosphorusTarget: {
    group: 'mineralsAndFibre',
    label: 'Target calcium-to-phosphorus ratio',
    unit: ': 1',
    min: 0.5,
    max: 6,
  },
};

/** Every editable field name, scalars plus the stage table. */
export const REQUIREMENT_SETTING_KEYS = [
  ...(Object.keys(REQUIREMENT_SETTING_FIELDS) as Array<
    keyof RequirementSettings
  >),
  'pregnancyIntakeStages' as const,
];

const MAX_PREGNANCY_STAGES = 12;

/** A single rejected field, reported back to the caller so a form can highlight it. */
export interface RequirementSettingIssue {
  field: string;
  message: string;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Validate the pregnancy stage table: shape, bounds, ascending days, ordered coverage. */
function validateStages(value: unknown): RequirementSettingIssue[] {
  const field = 'pregnancyIntakeStages';
  if (!Array.isArray(value)) {
    return [{ field, message: 'must be a list of stages' }];
  }
  if (value.length === 0) {
    return [{ field, message: 'must have at least one stage' }];
  }
  if (value.length > MAX_PREGNANCY_STAGES) {
    return [
      { field, message: `must have at most ${MAX_PREGNANCY_STAGES} stages` },
    ];
  }

  const issues: RequirementSettingIssue[] = [];
  let previousDay = 0;

  value.forEach((raw, index) => {
    const at = `${field}[${index}]`;
    if (typeof raw !== 'object' || raw === null) {
      issues.push({ field: at, message: 'must be an object' });
      return;
    }
    const stage = raw as Partial<PregnancyIntakeStage>;

    if (!isFiniteNumber(stage.untilDay) || stage.untilDay <= 0) {
      issues.push({ field: `${at}.untilDay`, message: 'must be above 0' });
    } else if (stage.untilDay > 320) {
      issues.push({ field: `${at}.untilDay`, message: 'must be at most 320' });
    } else if (stage.untilDay <= previousDay) {
      issues.push({
        field: `${at}.untilDay`,
        message: 'stages must be ordered by ascending day',
      });
    } else {
      previousDay = stage.untilDay;
    }

    if (
      !isFiniteNumber(stage.percentOfBodyWeight) ||
      stage.percentOfBodyWeight <= 0 ||
      stage.percentOfBodyWeight > 0.1
    ) {
      issues.push({
        field: `${at}.percentOfBodyWeight`,
        message: 'must be a fraction of body weight between 0 and 0.1',
      });
    }
  });

  return issues;
}

/**
 * Check a partial set of changes. Returns every problem found rather than throwing on the
 * first, so a form can mark all bad fields at once — same idea as `permission-matrix.ts`'s
 * `invalidKeys()`. Unknown fields are reported, not silently dropped: an admin who
 * misspells a field must find out, and a stored preset from a newer engine reaching an
 * older one is a real situation worth surfacing.
 */
export function validateSettings(changes: unknown): RequirementSettingIssue[] {
  if (
    typeof changes !== 'object' ||
    changes === null ||
    Array.isArray(changes)
  ) {
    return [{ field: '', message: 'must be an object' }];
  }

  const issues: RequirementSettingIssue[] = [];
  const known = new Set<string>(REQUIREMENT_SETTING_KEYS as string[]);

  for (const [field, value] of Object.entries(changes)) {
    if (!known.has(field)) {
      issues.push({ field, message: 'is not a requirement setting' });
      continue;
    }
    if (value === undefined) continue;

    if (field === 'pregnancyIntakeStages') {
      issues.push(...validateStages(value));
      continue;
    }

    const spec =
      REQUIREMENT_SETTING_FIELDS[
        field as keyof typeof REQUIREMENT_SETTING_FIELDS
      ];
    if (!isFiniteNumber(value)) {
      issues.push({ field, message: 'must be a number' });
    } else if (value < spec.min || value > spec.max) {
      issues.push({
        field,
        message:
          `must be between ${spec.min} and ${spec.max} ${spec.unit}`.trim(),
      });
    }
  }

  return issues;
}

/**
 * Layer `changes` over `base`. Absent fields inherit. The stage table is replaced whole
 * rather than merged element-wise — a partially-merged band table would silently produce a
 * nonsensical curve, and the editor always submits the full table.
 *
 * Unknown fields in `changes` are ignored here (validation is the place that rejects them),
 * so a stored preset written by a newer engine degrades to the fields this build knows
 * rather than crashing.
 */
export function mergeSettings(
  base: RequirementSettings,
  changes: RequirementSettingsChanges | null | undefined,
): RequirementSettings {
  if (!changes) return base;

  const merged: RequirementSettings = {
    ...base,
    pregnancyIntakeStages: base.pregnancyIntakeStages.map((s) => ({ ...s })),
  };

  for (const key of REQUIREMENT_SETTING_KEYS) {
    const value = (changes as Record<string, unknown>)[key];
    if (value === undefined || value === null) continue;

    if (key === 'pregnancyIntakeStages') {
      merged.pregnancyIntakeStages = (value as PregnancyIntakeStage[]).map(
        (s) => ({
          untilDay: s.untilDay,
          percentOfBodyWeight: s.percentOfBodyWeight,
        }),
      );
    } else if (isFiniteNumber(value)) {
      (merged as unknown as Record<string, number>)[key] = value;
    }
  }

  return merged;
}

/**
 * Read an untrusted stored payload (a Prisma `Json` column) into a usable settings object.
 * Invalid fields are dropped, not fatal: a malformed preset must degrade to the built-in
 * defaults rather than take the whole formulator down. Callers that need to *report*
 * problems — the Admin and farm write paths — call {@link validateSettings} first.
 */
export function parseSettings(
  stored: unknown,
  base: RequirementSettings = DEFAULT_REQUIREMENT_SETTINGS,
): RequirementSettings {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return base;
  }

  const rejected = new Set(
    validateSettings(stored).map((i) => i.field.split(/[.[]/)[0]),
  );
  const clean: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(stored)) {
    if (!rejected.has(field)) clean[field] = value;
  }

  return mergeSettings(base, clean);
}

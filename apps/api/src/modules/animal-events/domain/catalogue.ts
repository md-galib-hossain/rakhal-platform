/**
 * MILESTONE 31 Events Core (RAKHAL-478): the code catalogue of animal event
 * types and their chip eligibility. Pure: no framework, no Prisma, no imports
 * from other domain modules. Spec: docs/epic-events-core/04-event-model-and-flows.md §3.
 *
 * Type keys mirror the Prisma `AnimalEventType` enum (kept as string literals
 * so this file stays dependency-free).
 */

export const ANIMAL_EVENT_TYPES = [
  'HEAT',
  'BREEDING',
  'PREG_CHECK',
  'CALVING',
  'ABORTION',
  'DRY_OFF',
  'ILLNESS',
  'TREATMENT',
  'VACCINATION',
  'DEWORMING',
  'WEIGHT',
  'BCS',
  'WEANING',
  'CASTRATION',
  'ENTER_FATTENING',
  'LEAVE_FATTENING',
  'MOVE',
  'SOLD',
  'DIED',
  'CULLED',
  'NOTE',
  'HOOF_TRIM',
  'DEHORN',
  'CUSTOM',
] as const;
export type AnimalEventTypeKey = (typeof ANIMAL_EVENT_TYPES)[number];

export type EventGroup =
  | 'REPRODUCTION'
  | 'HEALTH'
  | 'GROWTH'
  | 'MOVEMENT'
  | 'OTHER';

/** Category chips an event is matched against (04 §3). */
export const EVENT_CHIPS = [
  'FEMALE',
  'MALE',
  'CALF',
  'HEIFER',
  'COW',
  'PREGNANT',
  'OPEN',
  'MILKING',
  'DRY',
  'FATTENING',
] as const;
export type EventChip = (typeof EVENT_CHIPS)[number];

/** LISTED = shown; WARN = under "Show all" with a warning; BLOCK = not available. */
export type ChipEligibility = 'LISTED' | 'WARN' | 'BLOCK';

export interface EventTypeDefinition {
  type: AnimalEventTypeKey;
  group: EventGroup;
  labelKey: string;
  /** Typed detail table (04 §2), or null when fields live in `AnimalEvent.data`. */
  detailTable: string | null;
  /** Per-chip eligibility. */
  appliesTo: Record<EventChip, ChipEligibility>;
  /** Always-blocked conditions: wrong sex etc. (04 §3 "Always blocked"). */
  hardRules: string[];
  /** Existing permission the write path requires (RAKHAL-481 enforces it). */
  permission: string;
  /** History entries (past, no stock/finance/AQR side effects) are accepted. */
  allowsHistorical: boolean;
  /** Follow-up rule keys this type can trigger (RAKHAL-484). */
  followUps: string[];
  /**
   * RAKHAL-480: the animal must belong to this chip (per-animal eligibility
   * only; `appliesTo` stays the picker listing). LEAVE_FATTENING needs FATTENING.
   */
  requiresChip?: EventChip;
}

const CODE: Record<string, ChipEligibility> = {
  L: 'LISTED',
  W: 'WARN',
  '-': 'BLOCK',
};

/** Ten letters in `EVENT_CHIPS` order: L = listed, W = warn, - = blocked. */
function chips(row: string): Record<EventChip, ChipEligibility> {
  if (row.length !== EVENT_CHIPS.length) {
    throw new Error(`eligibility row must have ${EVENT_CHIPS.length} cells`);
  }
  const out = {} as Record<EventChip, ChipEligibility>;
  EVENT_CHIPS.forEach((chip, i) => {
    out[chip] = CODE[row[i]];
  });
  return out;
}

const ALL = 'LLLLLLLLLL';
const FEMALE_REPRO = ['FEMALE_ONLY', 'NOT_BEFORE_BIRTH', 'NOT_FUTURE'];
const COMMON = ['NOT_BEFORE_BIRTH', 'NOT_FUTURE', 'NOT_AFTER_EXIT'];

function def(
  type: AnimalEventTypeKey,
  group: EventGroup,
  detailTable: string | null,
  row: string,
  permission: string,
  opts: Partial<
    Pick<
      EventTypeDefinition,
      'hardRules' | 'allowsHistorical' | 'followUps' | 'requiresChip'
    >
  > = {},
): EventTypeDefinition {
  return {
    type,
    group,
    labelKey: `animalEvents.types.${type}`,
    detailTable,
    appliesTo: chips(row),
    hardRules: opts.hardRules ?? COMMON,
    permission,
    allowsHistorical: opts.allowsHistorical ?? true,
    followUps: opts.followUps ?? [],
    ...(opts.requiresChip ? { requiresChip: opts.requiresChip } : {}),
  };
}

//                                   Female Male Calf Heifer Cow Preg Open Milk Dry Fatt
export const EVENT_CATALOGUE: readonly EventTypeDefinition[] = [
  def('HEAT', 'REPRODUCTION', 'HeatEvent', 'L--LLWLLLW', 'reproduction.heat', {
    hardRules: FEMALE_REPRO,
    followUps: ['HEAT_WATCH_AFTER_HEAT'],
  }),
  def(
    'BREEDING',
    'REPRODUCTION',
    'BreedingEvent',
    'L--LLWLLLW',
    'reproduction.create',
    { hardRules: FEMALE_REPRO, followUps: ['PREG_CHECK_AFTER_BREEDING'] },
  ),
  def(
    'PREG_CHECK',
    'REPRODUCTION',
    'PregnancyDiagnosis',
    'L--LLLLLLW',
    'reproduction.create',
    { hardRules: FEMALE_REPRO },
  ),
  def(
    'CALVING',
    'REPRODUCTION',
    'CalvingEvent',
    'L--LLLWWLW',
    'reproduction.create',
    { hardRules: FEMALE_REPRO },
  ),
  def(
    'ABORTION',
    'REPRODUCTION',
    'AbortionEvent',
    'L--LLLWWWW',
    'reproduction.create',
    { hardRules: FEMALE_REPRO },
  ),
  def(
    'DRY_OFF',
    'REPRODUCTION',
    'DryPeriod',
    'L---LLLL-W',
    'reproduction.create',
    { hardRules: FEMALE_REPRO },
  ),
  def('ILLNESS', 'HEALTH', 'HealthCase', ALL, 'healthcare.report-sickness'),
  def('TREATMENT', 'HEALTH', 'TreatmentLog', ALL, 'healthcare.log-treatment'),
  def('VACCINATION', 'HEALTH', 'TreatmentLog', ALL, 'healthcare.log-treatment'),
  def('DEWORMING', 'HEALTH', 'TreatmentLog', ALL, 'healthcare.log-treatment'),
  def('WEIGHT', 'GROWTH', 'WeightRecord', ALL, 'cattle.update'),
  def('BCS', 'GROWTH', 'BodyConditionScore', 'LLWLLLLLLL', 'cattle.bcs'),
  def('WEANING', 'GROWTH', 'CalfWeaningRecord', 'LLL-------', 'calf.update'),
  def('CASTRATION', 'GROWTH', null, '-LL------L', 'cattle.update', {
    hardRules: ['MALE_ONLY', ...COMMON],
  }),
  def('ENTER_FATTENING', 'GROWTH', null, 'LLWLLWLWL-', 'cattle.update'),
  def('LEAVE_FATTENING', 'GROWTH', null, '---------L', 'cattle.update', {
    requiresChip: 'FATTENING',
  }),
  def('MOVE', 'MOVEMENT', null, ALL, 'cattle.update'),
  def('SOLD', 'MOVEMENT', 'CattleDisposition', ALL, 'cattle.dispose', {
    allowsHistorical: false,
  }),
  def('DIED', 'MOVEMENT', 'MortalityRecord', ALL, 'cattle.dispose', {
    allowsHistorical: false,
  }),
  def('CULLED', 'MOVEMENT', 'CattleDisposition', ALL, 'cattle.dispose', {
    allowsHistorical: false,
  }),
  def('NOTE', 'OTHER', null, ALL, 'cattle.update'),
  def('HOOF_TRIM', 'HEALTH', null, ALL, 'cattle.update'),
  def('DEHORN', 'HEALTH', null, ALL, 'cattle.update'),
  def('CUSTOM', 'OTHER', null, ALL, 'cattle.update'),
];

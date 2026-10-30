import type { AnimalEventTypeKey } from './catalogue';

/**
 * RAKHAL-484: the follow-up rules ("automation"). Pure and code-defined; each
 * farm can switch a rule off or change its offset (`FollowUpRuleSetting`).
 * A rule turns an event into a due date; the engine turns that into a Task
 * (or, for a SUGGESTION, only a hint in the form's "What happens next").
 */
export type FollowUpRuleKey =
  | 'BREEDING_TO_PREG_CHECK'
  | 'PREG_POSITIVE_TO_DRY_OFF'
  | 'PREG_POSITIVE_TO_CALVING_WATCH'
  | 'CALVING_TO_VWP_END'
  | 'SUSPECTED_TO_RECHECK'
  | 'VACCINATION_NEXT_DOSE'
  | 'HEAT_TO_BREED_SUGGESTION';

/** What a rule needs to know about the event that triggered it. */
export interface RuleEvent {
  type: AnimalEventTypeKey;
  eventAt: Date;
  payload: Record<string, unknown>;
  /** PREG_CHECK outcome. */
  result?: 'PREGNANT' | 'NOT_PREGNANT' | 'SUSPECTED';
  /** Expected calving date once a pregnancy is known. */
  expectedCalvingDate?: Date | null;
}

/** Farm settings the default offsets come from. */
export interface RuleDefaults {
  pregnancyCheckDays: number;
  vwpDays: number;
  dryPeriodDays: number;
  closeUpDays: number;
}

export interface FollowUpRule {
  key: FollowUpRuleKey;
  title: string;
  kind: 'TASK' | 'SUGGESTION';
  defaultOn: boolean;
  trigger: AnimalEventTypeKey;
  /** Event types that satisfy the follow-up (it closes itself, even if early). */
  completesOn: AnimalEventTypeKey[];
  /** Offset in days used when the farm sets none. Null = the rule has no offset. */
  defaultOffsetDays(d: RuleDefaults): number | null;
  /** True when this event should trigger the rule. */
  matches(e: RuleEvent): boolean;
  /** Due date, or null when it cannot be worked out. */
  due(e: RuleEvent, offsetDays: number | null): Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const plus = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);
const positive = (e: RuleEvent) =>
  e.result === 'PREGNANT' || e.result === undefined;

export const FOLLOW_UP_RULES: readonly FollowUpRule[] = [
  {
    key: 'BREEDING_TO_PREG_CHECK',
    title: 'Pregnancy check',
    kind: 'TASK',
    defaultOn: true,
    trigger: 'BREEDING',
    completesOn: ['PREG_CHECK'],
    defaultOffsetDays: (d) => d.pregnancyCheckDays,
    matches: () => true,
    due: (e, o) => plus(e.eventAt, o ?? 35),
  },
  {
    key: 'PREG_POSITIVE_TO_DRY_OFF',
    title: 'Dry off',
    kind: 'TASK',
    defaultOn: true,
    trigger: 'PREG_CHECK',
    completesOn: ['DRY_OFF', 'CALVING'],
    defaultOffsetDays: (d) => d.dryPeriodDays,
    matches: (e) => positive(e) && Boolean(e.expectedCalvingDate),
    due: (e, o) =>
      e.expectedCalvingDate ? plus(e.expectedCalvingDate, -(o ?? 60)) : null,
  },
  {
    key: 'PREG_POSITIVE_TO_CALVING_WATCH',
    title: 'Calving watch',
    kind: 'TASK',
    defaultOn: true,
    trigger: 'PREG_CHECK',
    completesOn: ['CALVING'],
    defaultOffsetDays: (d) => d.closeUpDays,
    matches: (e) => positive(e) && Boolean(e.expectedCalvingDate),
    due: (e, o) =>
      e.expectedCalvingDate ? plus(e.expectedCalvingDate, -(o ?? 21)) : null,
  },
  {
    key: 'CALVING_TO_VWP_END',
    title: 'Voluntary waiting period ends: ready to breed',
    kind: 'TASK',
    defaultOn: true,
    trigger: 'CALVING',
    completesOn: ['BREEDING'],
    defaultOffsetDays: (d) => d.vwpDays,
    matches: () => true,
    due: (e, o) => plus(e.eventAt, o ?? 60),
  },
  {
    key: 'SUSPECTED_TO_RECHECK',
    title: 'Pregnancy recheck',
    kind: 'TASK',
    defaultOn: true,
    trigger: 'PREG_CHECK',
    completesOn: ['PREG_CHECK'],
    defaultOffsetDays: () => 10,
    matches: (e) => e.result === 'SUSPECTED',
    due: (e, o) => plus(e.eventAt, o ?? 10),
  },
  {
    key: 'VACCINATION_NEXT_DOSE',
    title: 'Next vaccine dose',
    kind: 'TASK',
    defaultOn: true,
    trigger: 'VACCINATION',
    completesOn: ['VACCINATION'],
    defaultOffsetDays: () => null,
    matches: (e) => Number(e.payload.nextDoseDays) > 0,
    due: (e) => plus(e.eventAt, Number(e.payload.nextDoseDays)),
  },
  {
    key: 'HEAT_TO_BREED_SUGGESTION',
    title: 'Breed in the next 12–18 hours',
    kind: 'SUGGESTION',
    defaultOn: true,
    trigger: 'HEAT',
    completesOn: ['BREEDING'],
    defaultOffsetDays: () => 0.5,
    matches: () => true,
    due: (e, o) => plus(e.eventAt, o ?? 0.5),
  },
];

export const ruleByKey = (key: string): FollowUpRule | undefined =>
  FOLLOW_UP_RULES.find((r) => r.key === key);

export interface FollowUpOverride {
  enabled?: boolean;
  offsetDays?: number | null;
}

export interface FollowUpPlanItem {
  ruleKey: FollowUpRuleKey;
  title: string;
  kind: 'TASK' | 'SUGGESTION';
  dueDate: Date;
  defaultOn: boolean;
  /** Task rule whose due date has already passed: never created (hub §3.6). */
  pastDue: boolean;
}

/**
 * The follow-ups an event produces. `overrides` are the farm's settings;
 * `now` decides which are already past due.
 */
export function planFollowUps(
  event: RuleEvent,
  defaults: RuleDefaults,
  overrides: Partial<Record<string, FollowUpOverride>>,
  now: Date,
): FollowUpPlanItem[] {
  const out: FollowUpPlanItem[] = [];
  for (const rule of FOLLOW_UP_RULES) {
    if (rule.trigger !== event.type || !rule.matches(event)) continue;
    const o = overrides[rule.key];
    if (o?.enabled === false) continue;
    const offset = o?.offsetDays ?? rule.defaultOffsetDays(defaults);
    const dueDate = rule.due(event, offset);
    if (!dueDate) continue;
    out.push({
      ruleKey: rule.key,
      title: rule.title,
      kind: rule.kind,
      dueDate,
      defaultOn: rule.defaultOn,
      pastDue: rule.kind === 'TASK' && dueDate.getTime() < now.getTime(),
    });
  }
  return out;
}

/** Rule keys whose open follow-ups this event type satisfies. */
export const rulesCompletedBy = (type: AnimalEventTypeKey): FollowUpRuleKey[] =>
  FOLLOW_UP_RULES.filter((r) => r.completesOn.includes(type)).map((r) => r.key);

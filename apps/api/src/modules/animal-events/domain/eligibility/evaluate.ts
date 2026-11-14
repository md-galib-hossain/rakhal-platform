import {
  ChipEligibility,
  EVENT_CHIPS,
  EventChip,
  EventTypeDefinition,
} from '../catalogue';
import {
  AnimalFacts,
  CategoryContext,
  CattleCategory,
  categoriesOf,
} from './categories';

export interface Finding {
  code: string;
  severity: 'BLOCK' | 'WARN';
}

export interface EligibilityResult {
  type: string;
  eligible: boolean;
  /** LISTED = offered; WARN = allowed with a warning; BLOCK = impossible. */
  level: ChipEligibility;
  findings: Finding[];
}

export interface EvaluateInput {
  facts: AnimalFacts;
  ctx: CategoryContext;
  /** Event date (defaults to `ctx.now`). */
  date?: Date;
  /** Animal has left the active herd. */
  leftHerd?: boolean;
}

const isChip = (c: CattleCategory): c is EventChip =>
  (EVENT_CHIPS as readonly string[]).includes(c);

/**
 * Per-animal eligibility of one event type (04 §3): hard rules (wrong sex,
 * future date, before birth, left the herd) BLOCK; otherwise the animal's chips
 * are looked up in the type's `appliesTo` row, where any BLOCK blocks and any
 * WARN warns.
 */
export function evaluateEligibility(
  def: EventTypeDefinition,
  input: EvaluateInput,
): EligibilityResult {
  const { facts, ctx } = input;
  const date = input.date ?? ctx.now;
  const findings: Finding[] = [];
  const block = (code: string) => findings.push({ code, severity: 'BLOCK' });

  if (def.hardRules.includes('FEMALE_ONLY') && facts.gender !== 'FEMALE')
    block('FEMALE_ONLY');
  if (def.hardRules.includes('MALE_ONLY') && facts.gender === 'FEMALE')
    block('MALE_ONLY');
  if (
    def.hardRules.includes('NOT_FUTURE') &&
    date.getTime() > ctx.now.getTime()
  )
    block('DATE_IN_FUTURE');
  if (
    def.hardRules.includes('NOT_BEFORE_BIRTH') &&
    facts.dateOfBirth &&
    date.getTime() < facts.dateOfBirth.getTime()
  )
    block('DATE_BEFORE_BIRTH');
  if (def.hardRules.includes('NOT_AFTER_EXIT') && input.leftHerd)
    block('ANIMAL_LEFT_HERD');

  const chips = categoriesOf(facts, ctx).filter(isChip);
  let level: ChipEligibility = 'LISTED';
  if (def.requiresChip) {
    if (!chips.includes(def.requiresChip)) {
      level = 'BLOCK';
      block(`REQUIRES_${def.requiresChip}`);
    }
  } else {
    for (const chip of chips) {
      const v = def.appliesTo[chip];
      if (v === 'BLOCK') {
        level = 'BLOCK';
        findings.push({ code: `NOT_FOR_${chip}`, severity: 'BLOCK' });
      } else if (v === 'WARN' && level !== 'BLOCK') {
        level = 'WARN';
        findings.push({ code: `UNUSUAL_FOR_${chip}`, severity: 'WARN' });
      }
    }
  }
  if (findings.some((f) => f.severity === 'BLOCK')) level = 'BLOCK';
  return {
    type: def.type,
    eligible: level !== 'BLOCK',
    level,
    findings,
  };
}

import {
  ChipEligibility,
  EVENT_CHIPS,
  EventChip,
  EventGroup,
  EventTypeDefinition,
} from './catalogue';

/**
 * RAKHAL-486: farm-defined event types ("Hoof bath", "Ear tag replaced").
 * Pure validation of a type definition and of a payload against its fields,
 * plus the bridge to the catalogue's `EventTypeDefinition` shape.
 */
export const CUSTOM_GROUPS: EventGroup[] = [
  'HEALTH',
  'REPRODUCTION',
  'GROWTH',
  'MOVEMENT',
  'OTHER',
];

export interface CustomField {
  key: string;
  label: string;
  kind: 'number' | 'text' | 'select';
  unit?: string;
  options?: string[];
  required?: boolean;
}

export const MAX_CUSTOM_FIELDS = 20;
export const MAX_PAYLOAD_BYTES = 4096;
const KEY = /^[a-z][a-zA-Z0-9_]{0,39}$/;

/** Returns a list of human-readable problems; empty = valid. */
export function validateFields(fields: unknown): string[] {
  if (!Array.isArray(fields)) return ['fields must be a list'];
  if (fields.length > MAX_CUSTOM_FIELDS)
    return [`at most ${MAX_CUSTOM_FIELDS} fields`];
  const problems: string[] = [];
  const seen = new Set<string>();
  fields.forEach((f: Partial<CustomField>, i) => {
    if (!f || typeof f.key !== 'string' || !KEY.test(f.key))
      problems.push(`fields[${i}].key must match ${KEY}`);
    else if (seen.has(f.key)) problems.push(`fields[${i}].key is repeated`);
    else seen.add(f.key);
    if (!f?.label || typeof f.label !== 'string' || f.label.length > 60)
      problems.push(`fields[${i}].label is required (max 60)`);
    if (!f?.kind || !['number', 'text', 'select'].includes(f.kind))
      problems.push(`fields[${i}].kind must be number, text or select`);
    if (
      f?.kind === 'select' &&
      (!Array.isArray(f.options) || f.options.length < 1)
    )
      problems.push(`fields[${i}].options is required for a select`);
  });
  return problems;
}

/** Chips → eligibility; anything missing is LISTED. */
export function normalizeAppliesTo(
  raw: unknown,
): Record<EventChip, ChipEligibility> | null {
  const out = {} as Record<EventChip, ChipEligibility>;
  const given = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  for (const chip of EVENT_CHIPS) {
    const v = given[chip] ?? 'LISTED';
    if (v !== 'LISTED' && v !== 'WARN' && v !== 'BLOCK') return null;
    out[chip] = v;
  }
  return out;
}

/** Validate an event payload against the type's fields. */
export function validateCustomPayload(
  fields: CustomField[],
  payload: Record<string, unknown>,
): string[] {
  const problems: string[] = [];
  if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES)
    problems.push('payload exceeds 4 KB');
  for (const f of fields) {
    const v = payload[f.key];
    if (v === undefined || v === null || v === '') {
      if (f.required) problems.push(`${f.key} is required`);
      continue;
    }
    if (f.kind === 'number' && typeof v !== 'number')
      problems.push(`${f.key} must be a number`);
    if (f.kind === 'text' && typeof v !== 'string')
      problems.push(`${f.key} must be text`);
    if (
      f.kind === 'select' &&
      !(typeof v === 'string' && (f.options ?? []).includes(v))
    )
      problems.push(`${f.key} must be one of ${(f.options ?? []).join(', ')}`);
  }
  for (const k of Object.keys(payload)) {
    if (!fields.some((f) => f.key === k)) problems.push(`${k} is not a field`);
  }
  return problems;
}

export interface CustomTypeRow {
  id: string;
  name: string;
  group: string;
  appliesTo: unknown;
  fields: unknown;
  followUpDays: number | null;
}

/** The catalogue-shaped definition for a custom type (for eligibility and the types list). */
export function toDefinition(row: CustomTypeRow): EventTypeDefinition {
  return {
    type: 'CUSTOM',
    group: row.group as EventGroup,
    labelKey: row.name,
    detailTable: null,
    appliesTo:
      normalizeAppliesTo(row.appliesTo) ??
      (normalizeAppliesTo({}) as Record<EventChip, ChipEligibility>),
    hardRules: ['NOT_BEFORE_BIRTH', 'NOT_FUTURE', 'NOT_AFTER_EXIT'],
    permission: 'cattle.update',
    allowsHistorical: true,
    followUps: [],
  };
}

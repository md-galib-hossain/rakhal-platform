import type { CattleListItem } from "@/features/cattle/types";
import { EVENT_CATALOGUE } from "../catalogue/events";
import { eligibilityFor } from "../catalogue/eligibility";
import { FORM_DEFS, toEventAt } from "../forms/definitions";
import type { FormDef, FormValues } from "../forms/types";
import type { AnimalFacts, Eligibility, EventDef, EventKey } from "../types";

/** The server accepts at most 100 animals per `POST /animal-events/bulk` (RAKHAL-489). */
export const BULK_CHUNK = 100;

/** Events whose value differs per animal: the form shows one input per ticked animal (04 §6). */
export const VALUE_FIELD: Partial<Record<EventKey, { field: string; kind: "number" | "choice" }>> = {
  WEIGHT: { field: "weightKg", kind: "number" },
  BCS: { field: "score", kind: "number" },
  PREG_CHECK: { field: "result", kind: "choice" },
};

export function toFacts(item: CattleListItem): AnimalFacts {
  return {
    gender: item.gender,
    animalCategory: item.animalCategory,
    lifecycleSubStage: item.lifecycleSubStage,
    reproductiveStatus: item.reproductiveStatus,
    productionStatus: item.productionStatus === "MILKING" || item.productionStatus === "DRY" ? item.productionStatus : null,
    dim: item.dim,
    herdStatus: item.herdStatus,
  };
}

/** Bulk-capable events the role may record and the screen can build a form for (Reminder has its own flow, RFE-164). */
export function bulkEvents(can: (permission: string) => boolean): EventDef[] {
  return EVENT_CATALOGUE.filter((def) => def.bulk && FORM_DEFS[def.key] && can(def.permission));
}

export interface BulkSplit {
  valid: CattleListItem[];
  blocked: { item: CattleListItem; eligibility: Extract<Eligibility, { status: "block" }> }[];
}

export function splitByEligibility(def: EventDef, items: CattleListItem[]): BulkSplit {
  const split: BulkSplit = { valid: [], blocked: [] };
  for (const item of items) {
    const eligibility = eligibilityFor(def, toFacts(item));
    if (eligibility.status === "block") split.blocked.push({ item, eligibility });
    else split.valid.push(item);
  }
  return split;
}

/** The shared part of the form: the per-animal value field is entered in the grid instead. */
export function sharedDef(def: FormDef): FormDef {
  const value = VALUE_FIELD[def.key];
  if (!value) return def;
  return { ...def, fields: def.fields.filter((field) => field.name !== value.field) };
}

export function chunk<T>(rows: T[], size: number = BULK_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export interface BulkBody {
  type: string;
  eventAt: string;
  provenance: "RECORDED" | "HISTORICAL";
  notes?: string;
  payload: Record<string, unknown>;
  values?: Record<string, Record<string, unknown>>;
  cattleIds: string[];
  mode: "skipIneligible";
}

/** Grid inputs arrive as text; empty or out-of-range rows are left out (the server reports them `VALUES_MISSING`). */
export function cleanValues(def: FormDef, raw: Record<string, string>, ids: string[]) {
  const spec = VALUE_FIELD[def.key];
  const field = def.fields.find((f) => f.name === spec?.field);
  const values: Record<string, Record<string, unknown>> = {};
  const missing: string[] = [];
  const invalid: string[] = [];
  if (!spec || !field) return { values, missing, invalid };
  for (const id of ids) {
    const text = (raw[id] ?? "").trim();
    if (!text) {
      missing.push(id);
      continue;
    }
    if (spec.kind === "number") {
      const n = Number(text);
      if (Number.isNaN(n) || (field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) {
        invalid.push(id);
        continue;
      }
      values[id] = { [spec.field]: n };
    } else {
      values[id] = { [spec.field]: text };
    }
  }
  return { values, missing, invalid };
}

function buildHeader(def: FormDef, shared: FormValues, when: { date: string; time?: string; historical: boolean }) {
  let payload: Record<string, unknown> = {};
  let notes: string | undefined;
  for (const field of def.fields) {
    const value = shared[field.name];
    if (value === undefined || value === "" || value === null || (typeof value === "number" && Number.isNaN(value))) continue;
    if (field.kind === "bool" && value === false) continue;
    const typed = field.kind === "number" ? Number(value) : typeof value === "string" ? value.trim() : value;
    if (field.target === "notes") notes = typed as string;
    else payload[field.name] = typed;
  }
  if (def.transform) payload = def.transform(payload);
  return {
    type: def.backendType,
    eventAt: toEventAt(when.date, def.showTime ? when.time : undefined),
    provenance: when.historical ? ("HISTORICAL" as const) : ("RECORDED" as const),
    ...(notes ? { notes } : {}),
    payload,
  };
}

/** Request bodies, one per chunk of 100 animals. Shared fields reuse the single-event form's `payload` shape. */
export function buildBulkBodies(
  def: FormDef,
  shared: FormValues,
  when: { date: string; time?: string; historical: boolean },
  ids: string[],
  values?: Record<string, Record<string, unknown>>,
): BulkBody[] {
  const header = buildHeader(def, shared, when);
  return chunk(ids).map((part) => ({
    ...header,
    cattleIds: part,
    mode: "skipIneligible" as const,
    ...(values ? { values: Object.fromEntries(part.filter((id) => values[id]).map((id) => [id, values[id]])) } : {}),
  }));
}

export interface BulkRowResult {
  cattleId: string;
  tagNumber: string;
  status: "CREATED" | "ELIGIBLE" | "SKIPPED" | "BLOCKED";
  eventId?: string;
  reason?: string;
}

export interface BulkResponse {
  dryRun: boolean;
  batchId: string | null;
  requested: number;
  saved: number;
  skipped: number;
  results: BulkRowResult[];
}

export interface BulkSummary {
  requested: number;
  saved: number;
  /** Eligible in a dry run (would be saved). */
  eligible: number;
  skipped: BulkRowResult[];
  batchIds: string[];
}

/** Folds the per-chunk responses into one summary for the confirm and result steps. */
export function summarise(responses: BulkResponse[]): BulkSummary {
  const summary: BulkSummary = { requested: 0, saved: 0, eligible: 0, skipped: [], batchIds: [] };
  for (const response of responses) {
    summary.requested += response.requested;
    summary.saved += response.saved;
    if (response.batchId) summary.batchIds.push(response.batchId);
    for (const row of response.results) {
      if (row.status === "ELIGIBLE") summary.eligible += 1;
      else if (row.status === "SKIPPED" || row.status === "BLOCKED") summary.skipped.push(row);
    }
  }
  return summary;
}

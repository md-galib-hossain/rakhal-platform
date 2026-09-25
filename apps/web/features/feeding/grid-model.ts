/**
 * Feeding Grid model — the ONE row shape every cow uses, whether she is on a feed plan, a TMR / concentrate
 * shortcut, or fed ad hoc. A row is a list of **feed lines** (plan lines pre-filled from the program, plus
 * anything the farmer adds); stock caps are computed here so the UI never lets a total exceed inventory.
 * Pure functions only — no React — so the rules are unit-testable.
 */
import type { FeedGridCow, FeedGridDraft, FeedGridSource, FeedGridSourceType } from "../feed/types";
import type {
  FeedGridDraftPlanFields,
  FeedGridProgramCowFields,
  FeedGridSection,
  ProgramGridEntry,
} from "../feed/plans-types";

export type GridCow = Omit<FeedGridCow, "drafts"> &
  FeedGridProgramCowFields & { drafts: (FeedGridDraft & Partial<FeedGridDraftPlanFields>)[] };

/** Kept as an alias: `AdjustPlanActions` names a section's cows `ProgramCow`. */
export type ProgramCow = GridCow;

export interface RowSource {
  sourceType: FeedGridSourceType;
  itemId: string;
}

/** One feed line on a cow's row. `planLineId` set = pre-filled from her program; unset = added by hand. */
export interface RowLine {
  key: string;
  planLineId?: string;
  /** Plan-line name; hand-added lines resolve their name from the source instead. */
  name?: string;
  /** `null` = a plan line with no batch made yet — cannot be fed until one exists. */
  source: RowSource | null;
  kg: string;
}

export interface Density {
  dm_pct: number;
  cp_pct: number;
  me_mj_per_kg_dm: number;
}

export interface StockInfo {
  label: string;
  /** Nutrition of the lot the next feeding draws; unknown for a prepared batch not on any plan. */
  density?: Density | null;
  /** Kg on hand; `null` = cannot be computed (a feed item with no kg-per-unit) — the server still checks. */
  availableKg: number | null;
}

export const sourceKey = (s: RowSource) => `${s.sourceType}:${s.itemId}`;

export const parseKg = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

let lineSeq = 0;
export const newLineKey = () => `l${Date.now().toString(36)}${(lineSeq++).toString(36)}`;

function draftSource(d: FeedGridDraft): RowSource | null {
  const itemId = d.source_type === "FEED_ITEM" ? d.feed_item_id : d.feed_stock_id;
  return itemId ? { sourceType: d.source_type, itemId } : null;
}

function toRowSource(s: FeedGridSource | null | undefined): RowSource | null {
  if (!s) return null;
  const itemId = s.source_type === "FEED_ITEM" ? s.feed_item_id : s.feed_stock_id;
  return itemId ? { sourceType: s.source_type, itemId } : null;
}

/**
 * A cow's opening lines. A saved draft for a plan line wins over the plan's per-session kg; drafts that match no plan
 * line (hand-added, or a line an edited plan no longer has) come back as extra lines so nothing staged is lost.
 * A cow with no program and no saved draft starts empty — nothing is pre-filled from a previous day.
 */
export function buildInitialLines(cow: GridCow, section: FeedGridSection | undefined): RowLine[] {
  const lines: RowLine[] = [];
  const planLineIds = new Set<string>();

  if (section) {
    for (const pl of section.lines) {
      planLineIds.add(pl.line_id);
      const draft = cow.drafts.find((d) => d.plan_line_id === pl.line_id);
      lines.push({
        key: `p:${pl.line_id}`,
        planLineId: pl.line_id,
        name: pl.name,
        source: toRowSource(pl.source),
        kg: String(draft ? draft.offered_kg : (cow.planned_kg_by_line[pl.line_id] ?? pl.prefill_kg)),
      });
    }
  }

  for (const d of cow.drafts) {
    if (d.plan_line_id && planLineIds.has(d.plan_line_id)) continue;
    const source = draftSource(d);
    if (source) lines.push({ key: `d:${d.id}`, source, kg: String(d.offered_kg) });
  }
  return lines;
}

export function initialRefusal(cow: GridCow): string {
  const total = cow.drafts.reduce((s, d) => s + (d.refusal_kg ?? 0), 0);
  return total > 0 ? String(total) : "";
}

export const cowTotalKg = (lines: RowLine[]) => lines.reduce((s, l) => s + (l.source ? parseKg(l.kg) : 0), 0);

/** Σ kg per source across the SELECTED cows only — that is exactly what a save/confirm would draw. */
export function usageBySource(lines: Record<string, RowLine[]>, selectedIds: string[]): Map<string, number> {
  const usage = new Map<string, number>();
  for (const id of selectedIds) {
    for (const l of lines[id] ?? []) {
      if (!l.source) continue;
      const k = sourceKey(l.source);
      usage.set(k, (usage.get(k) ?? 0) + parseKg(l.kg));
    }
  }
  return usage;
}

/**
 * The most kg this line may hold: on-hand minus what every OTHER selected line already draws from the same source.
 * `null` = uncapped (stock unknown). A line on an unselected row has no share in `used` yet, so its own kg is not added
 * back.
 */
export function maxKgForLine(
  info: StockInfo | undefined,
  used: number,
  ownKg: number,
  rowSelected: boolean,
): number | null {
  if (!info || info.availableKg == null) return null;
  const others = used - (rowSelected ? ownKg : 0);
  return Math.max(0, Math.floor((info.availableKg - others) * 100) / 100);
}

/**
 * Re-applies every source's stock cap across the ticked cows in row order: the first cows get their full kg, the rest
 * get whatever is left (possibly 0). Used after a bulk apply, where one click can ask for more than the inventory has.
 * Returns the new lines and how many lines were reduced.
 */
export function enforceStockCaps(
  lines: Record<string, RowLine[]>,
  orderedSelectedIds: string[],
  stock: Map<string, StockInfo>,
): { lines: Record<string, RowLine[]>; reduced: number } {
  const left = new Map<string, number>();
  let reduced = 0;
  const next = { ...lines };
  for (const id of orderedSelectedIds) {
    next[id] = (lines[id] ?? []).map((l) => {
      if (!l.source) return l;
      const key = sourceKey(l.source);
      const avail = stock.get(key)?.availableKg;
      if (avail == null) return l;
      const remaining = left.get(key) ?? avail;
      const want = parseKg(l.kg);
      const give = Math.min(want, Math.max(0, Math.floor(remaining * 100) / 100));
      left.set(key, remaining - give);
      if (give < want) {
        reduced += 1;
        return { ...l, kg: give > 0 ? String(give) : "0" };
      }
      return l;
    });
  }
  return { lines: next, reduced };
}

/** True when any ticked line asks for more than its source has (a stock change since it was typed, say). */
export function hasOverStock(
  lines: Record<string, RowLine[]>,
  selectedIds: string[],
  stock: Map<string, StockInfo>,
): boolean {
  const used = usageBySource(lines, selectedIds);
  for (const [key, kg] of used) {
    const avail = stock.get(key)?.availableKg;
    if (avail != null && kg > avail + 0.001) return true;
  }
  return false;
}

/** Clamp a typed value to `max`; `capped` tells the UI to show the "only N kg in stock" hint. */
export function clampKg(raw: string, max: number | null): { value: string; capped: boolean } {
  if (max == null || raw.trim() === "") return { value: raw, capped: false };
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= max) return { value: raw, capped: false };
  return { value: String(max), capped: true };
}

/** Lines → the multi-line payload shape `/feed/grid/{draft,confirm}` takes. Lines with no batch or 0 kg are dropped. */
export function toEntry(cattleId: string, lines: RowLine[], refusal: string): ProgramGridEntry | null {
  const out: ProgramGridEntry["lines"] = [];
  for (const l of lines) {
    const kg = parseKg(l.kg);
    if (kg <= 0 || !l.source) continue;
    out.push({
      planLineId: l.planLineId,
      sourceType: l.source.sourceType,
      feedItemId: l.source.sourceType === "FEED_ITEM" ? l.source.itemId : undefined,
      feedStockId: l.source.sourceType === "FEED_STOCK" ? l.source.itemId : undefined,
      offeredKg: kg,
    });
  }
  if (out.length === 0) return null;
  const refusalKg = parseKg(refusal);
  return { cattleId, refusalKg: refusalKg > 0 ? refusalKg : undefined, lines: out };
}

// ---- live fit ------------------------------------------------------------------------------------------------
// Mirrors the backend's `domain/program-fit.ts` (RAKHAL-458): delta = supply / requirement − 1, inside the band = ok,
// up to twice the band = warn, beyond = bad. The server's fit is for the plan as written; this one follows the kg
// typed in the row so the pill never contradicts the numbers next to it.

export interface FitBands {
  dmBelowPct: number;
  dmAbovePct: number;
  cpBelowPct: number;
  cpAbovePct: number;
  meBelowPct: number;
  meAbovePct: number;
}

/** Used until the farm's requirement settings load (the backend's own defaults). */
export const DEFAULT_FIT_BANDS: FitBands = {
  dmBelowPct: 10,
  dmAbovePct: 10,
  cpBelowPct: 10,
  cpAbovePct: 20,
  meBelowPct: 10,
  meAbovePct: 10,
};

export function bandsFromEffective(effective: Record<string, unknown> | undefined): FitBands {
  const n = (k: string, d: number) => (typeof effective?.[k] === "number" ? (effective[k] as number) : d);
  return {
    dmBelowPct: n("alertDryMatterBelowPct", DEFAULT_FIT_BANDS.dmBelowPct),
    dmAbovePct: n("alertDryMatterAbovePct", DEFAULT_FIT_BANDS.dmAbovePct),
    cpBelowPct: n("alertProteinBelowPct", DEFAULT_FIT_BANDS.cpBelowPct),
    cpAbovePct: n("alertProteinAbovePct", DEFAULT_FIT_BANDS.cpAbovePct),
    meBelowPct: n("alertEnergyBelowPct", DEFAULT_FIT_BANDS.meBelowPct),
    meAbovePct: n("alertEnergyAbovePct", DEFAULT_FIT_BANDS.meAbovePct),
  };
}

type Severity = "ok" | "warn" | "bad";
const RANK: Record<Severity, number> = { ok: 0, warn: 1, bad: 2 };
const round1 = (v: number) => Math.round(v * 10) / 10;

function classify(supply: number, requirement: number, below: number, above: number) {
  if (!(requirement > 0)) return { delta_pct: null as number | null, severity: "ok" as Severity };
  const delta = round1((supply / requirement - 1) * 100);
  let severity: Severity = "ok";
  if (delta < -below) severity = -delta <= below * 2 ? "warn" : "bad";
  else if (delta > above) severity = delta <= above * 2 ? "warn" : "bad";
  return { delta_pct: delta, severity };
}

/**
 * What the row's lines supply to the cow per DAY. The grid edits one session's kg, so the day's supply is that × the
 * farm's active sessions (the plan pre-fills daily kg ÷ sessions). `complete` is false when a fed line has no known
 * nutrition — the totals are then a floor and the fit is marked estimated.
 */
export function liveSupply(lines: RowLine[], density: (key: string) => Density | null | undefined, sessions: number) {
  let dm = 0;
  let cp = 0;
  let me = 0;
  let complete = true;
  for (const l of lines) {
    const kg = parseKg(l.kg);
    if (kg <= 0 || !l.source) continue;
    const d = density(sourceKey(l.source));
    if (!d) {
      complete = false;
      continue;
    }
    const dmKg = kg * Math.max(1, sessions) * (d.dm_pct / 100);
    dm += dmKg;
    cp += dmKg * (d.cp_pct / 100);
    me += dmKg * d.me_mj_per_kg_dm;
  }
  return { dm_kg: dm, cp_kg: cp, me_mj: me, complete };
}

export function liveFit(
  supply: { dm_kg: number; cp_kg: number; me_mj: number; complete: boolean },
  requirement: { dm_kg: number; cp_kg: number; me_mj: number },
  bands: FitBands,
  serverEstimated: boolean,
) {
  const dm = classify(supply.dm_kg, requirement.dm_kg, bands.dmBelowPct, bands.dmAbovePct);
  const cp = classify(supply.cp_kg, requirement.cp_kg, bands.cpBelowPct, bands.cpAbovePct);
  const me = classify(supply.me_mj, requirement.me_mj, bands.meBelowPct, bands.meAbovePct);
  const severity = [dm, cp, me].reduce<Severity>((w, n) => (RANK[n.severity] > RANK[w] ? n.severity : w), "ok");
  return { severity, estimated: serverEstimated || !supply.complete, dm, cp, me };
}

/**
 * How much of her daily requirement the row's lines cover, 0–100 per nutrient. `overall` is the LIMITING nutrient (the
 * lowest of DM / CP / ME) so the bar only fills once every need is met; nothing fed = 0. `null` when she has no
 * requirement to measure against.
 */
export function requirementProgress(
  supply: { dm_kg: number; cp_kg: number; me_mj: number },
  requirement: { dm_kg: number; cp_kg: number; me_mj: number } | null,
) {
  if (!requirement) return null;
  const pct = (s: number, r: number) => (r > 0 ? Math.min(100, Math.max(0, (s / r) * 100)) : null);
  const dm = pct(supply.dm_kg, requirement.dm_kg);
  const cp = pct(supply.cp_kg, requirement.cp_kg);
  const me = pct(supply.me_mj, requirement.me_mj);
  const known = [dm, cp, me].filter((v): v is number => v != null);
  if (known.length === 0) return null;
  return { dm, cp, me, overall: Math.min(...known) };
}

/** Rows ordered by program (plans in the backend's section order), then cows on no program. Stable within a group. */
export function orderCows(cows: GridCow[], sections: FeedGridSection[]): GridCow[] {
  const rank = new Map(sections.map((s, i) => [s.id, i]));
  return [...cows].sort((a, b) => {
    const ra = a.program_section_id ? (rank.get(a.program_section_id) ?? sections.length) : sections.length + 1;
    const rb = b.program_section_id ? (rank.get(b.program_section_id) ?? sections.length) : sections.length + 1;
    return ra - rb;
  });
}

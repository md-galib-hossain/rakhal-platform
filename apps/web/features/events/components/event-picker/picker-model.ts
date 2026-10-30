import { deriveChips } from "../../catalogue/chips";
import { eligibilityFor } from "../../catalogue/eligibility";
import { EVENT_CATALOGUE } from "../../catalogue/events";
import { EVENT_GROUPS, EVENT_KEYS, type AnimalFacts, type Eligibility, type EventDef, type EventGroup, type EventKey } from "../../types";

export interface PickerText {
  label: string;
  hint: string;
  /** Comma-separated English + Bangla synonyms; they live in the catalogue i18n, not in code (03 §4.1). */
  synonyms: string;
}

export interface PickerEntry {
  def: EventDef;
  eligibility: Eligibility;
  text: PickerText;
}

export interface PickerModel {
  suggested: PickerEntry[];
  recent: PickerEntry[];
  groups: { group: EventGroup; entries: PickerEntry[] }[];
  /** Greyed entries with a reason: shown when a search matches them, or under "Show all events". */
  unavailable: PickerEntry[];
}

const MAX_SUGGESTED = 3;
const MAX_RECENT = 5;

export function normalize(value: string): string {
  return value.normalize("NFC").toLowerCase().trim();
}

/** Every whitespace-separated token must appear in the label or a synonym (works for Bangla: no stemming). */
export function matchesQuery(text: PickerText, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const haystack = normalize(`${text.label}, ${text.synonyms}`);
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

function groupEntries(entries: PickerEntry[]): PickerModel["groups"] {
  return EVENT_GROUPS.map((group) => ({ group, entries: entries.filter((entry) => entry.def.group === group) })).filter(
    (group) => group.entries.length > 0,
  );
}

/**
 * Builds what the picker shows (03 §4.1, 04 §3):
 *  - events the role may not record are never present;
 *  - browse mode lists eligible (✓) events only, after Suggested and Recent; "Show all" adds ⚠ events and greyed blocked ones;
 *  - search mode finds ✓ and ⚠ events normally and puts blocked matches greyed at the bottom with their reason.
 */
export function buildPickerModel({
  facts,
  can,
  textFor,
  query,
  showAll,
  suggestedKeys,
  recentKeys,
}: {
  facts: AnimalFacts;
  can: (permission: string) => boolean;
  textFor: (key: EventKey) => PickerText;
  query: string;
  showAll: boolean;
  suggestedKeys: EventKey[];
  recentKeys: EventKey[];
}): PickerModel {
  const chips = deriveChips(facts);
  const entries: PickerEntry[] = EVENT_CATALOGUE.filter((def) => can(def.permission)).map((def) => ({
    def,
    eligibility: eligibilityFor(def, facts, chips),
    text: textFor(def.key),
  }));

  if (query.trim()) {
    const hits = entries.filter((entry) => matchesQuery(entry.text, query));
    return {
      suggested: [],
      recent: [],
      groups: groupEntries(hits.filter((entry) => entry.eligibility.status !== "block")),
      unavailable: hits.filter((entry) => entry.eligibility.status === "block"),
    };
  }

  const byKey = new Map(entries.map((entry) => [entry.def.key, entry]));
  const suggested = suggestedKeys
    .map((key) => byKey.get(key))
    .filter((entry): entry is PickerEntry => Boolean(entry) && entry!.eligibility.status !== "block")
    .slice(0, MAX_SUGGESTED);
  const suggestedSet = new Set(suggested.map((entry) => entry.def.key));
  const recent = recentKeys
    .map((key) => byKey.get(key))
    .filter((entry): entry is PickerEntry => Boolean(entry) && entry!.eligibility.status === "ok" && !suggestedSet.has(entry!.def.key))
    .slice(0, MAX_RECENT);
  const listed = entries.filter((entry) => entry.eligibility.status === "ok" || (showAll && entry.eligibility.status === "warn"));
  return {
    suggested,
    recent,
    groups: groupEntries(listed),
    unavailable: showAll ? entries.filter((entry) => entry.eligibility.status === "block") : [],
  };
}

/** Upcoming-event kinds that map to a recordable event (Suggested for her). */
const KIND_TO_EVENT: Record<string, EventKey> = {
  PREGNANCY_CHECK: "PREG_CHECK",
  DRY_OFF: "DRY_OFF",
  CALVING: "CALVING",
  HEALTH_STEP: "TREATMENT",
  PREVENTIVE_STEP: "VACCINATION",
  WEANING: "WEAN",
};

export function suggestedFromUpcoming(events: { kind: string; actionable: boolean }[]): EventKey[] {
  const keys: EventKey[] = [];
  for (const event of events) {
    const key = event.actionable ? KIND_TO_EVENT[event.kind] : undefined;
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

// ---- Recent (per browser; only event keys are stored) ----------------------------------------------------------

const RECENT_STORAGE_KEY = "rakhal.events.recent.v1";

export function loadRecent(): EventKey[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((key): key is EventKey => (EVENT_KEYS as readonly string[]).includes(key as string)) : [];
  } catch {
    return [];
  }
}

export function pushRecent(key: EventKey): void {
  try {
    const next = [key, ...loadRecent().filter((existing) => existing !== key)].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private window, blocked): the picker simply has no Recent group.
  }
}

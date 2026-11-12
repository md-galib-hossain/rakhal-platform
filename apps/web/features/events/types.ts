/**
 * MILESTONE 31 "Events Core" (RFE-153) — client-side event catalogue types. Until the backend serves
 * `GET /animal-events/types` (RAKHAL-486) the catalogue lives in `catalogue/events.ts`; the matrix there
 * mirrors `docs/epic-events-core/04-event-model-and-flows.md` §3.
 */

/** The 12 owner categories plus Fattening (04 §3). */
export const ANIMAL_CHIPS = [
  "female",
  "male",
  "calves",
  "weaned",
  "heifers",
  "cows",
  "pregnant",
  "open",
  "milking",
  "dry",
  "fresh",
  "fattening",
] as const;
export type AnimalChip = (typeof ANIMAL_CHIPS)[number];

/** Everything the chips are derived from — a subset of `CattleDetail`/`CattleListItem`. */
export interface AnimalFacts {
  gender: "MALE" | "FEMALE" | "CASTRATED_MALE";
  animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
  lifecycleSubStage?: string | null;
  reproductiveStatus?: string | null;
  productionStatus?: "MILKING" | "DRY" | null;
  dim?: number | null;
  herdStatus?: "ACTIVE" | "SOLD" | "CULLED" | "DECEASED";
  /** Not served yet (RAKHAL-478 adds `purpose`); `FATTENING` turns the Fattening chip on. */
  purpose?: string | null;
}

export const EVENT_KEYS = [
  "HEAT",
  "SERVICE",
  "PREG_CHECK",
  "CALVING",
  "ABORTION",
  "DRY_OFF",
  "ILLNESS",
  "TREATMENT",
  "VACCINATION",
  "DEWORMING",
  "WEIGHT",
  "BCS",
  "WEAN",
  "CASTRATE",
  "ENTER_FATTENING",
  "LEAVE_FATTENING",
  "MOVE",
  "SELL",
  "DEATH",
  "CULL",
  "NOTE",
  "REMINDER",
] as const;
export type EventKey = (typeof EVENT_KEYS)[number];

export const EVENT_GROUPS = ["reproduction", "health", "milk", "growth", "movement", "custom"] as const;
export type EventGroup = (typeof EVENT_GROUPS)[number];

/** ✓ listed · ⚠ listed under "Show all" with a warning · — blocked (04 §3). */
export type Cell = "ok" | "warn" | "block";

export type EligibilityReason =
  | { key: "notFor"; chip: AnimalChip }
  | { key: "onlyFor"; chips: AnimalChip[] }
  | { key: "alreadyCastrated" }
  | { key: "notFattening" }
  | { key: "alreadyFattening" }
  | { key: "leftHerd" };

export interface EventDef {
  key: EventKey;
  group: EventGroup;
  /** lucide icon name, resolved by the picker. */
  icon: string;
  /** `resource.action`; the picker hides events the role may not record. */
  permission: string;
  bulk: boolean;
  /** Per-chip cell of the 04 §3 matrix. Chips not listed do not constrain. */
  cells: Partial<Record<AnimalChip, Cell>>;
  /** Animal must carry at least one of these chips (e.g. Wean → calves). */
  requiresAny?: AnimalChip[];
  /** Extra hard block beyond the matrix. */
  blockedBy?: (facts: AnimalFacts) => EligibilityReason | null;
}

export type Eligibility =
  | { status: "ok" }
  | { status: "warn"; chips: AnimalChip[] }
  | { status: "block"; reason: EligibilityReason };

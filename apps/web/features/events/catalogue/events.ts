import type { AnimalChip, Cell, EventDef, EventKey } from "../types";

/** Matrix column order — 04 §3: Female, Male, Calf, Heifer, Cow, Pregnant, Open, Milking, Dry, Fattening. */
const COLUMNS: AnimalChip[] = ["female", "male", "calves", "heifers", "cows", "pregnant", "open", "milking", "dry", "fattening"];
const CODE: Record<string, Cell> = { "+": "ok", "~": "warn", "-": "block" };

/** One char per COLUMNS entry: `+` listed, `~` listed under "Show all" with a warning, `-` blocked. */
function row(codes: string): Partial<Record<AnimalChip, Cell>> {
  if (codes.length !== COLUMNS.length) throw new Error(`catalogue row "${codes}" must have ${COLUMNS.length} cells`);
  const cells: Partial<Record<AnimalChip, Cell>> = {};
  COLUMNS.forEach((chip, i) => {
    cells[chip] = CODE[codes[i]];
  });
  return cells;
}

const ALL_OK = "++++++++++";

export const EVENT_CATALOGUE: EventDef[] = [
  { key: "HEAT", group: "reproduction", icon: "Heart", permission: "reproduction.heat", bulk: false, cells: row("+--++~+++~") },
  { key: "SERVICE", group: "reproduction", icon: "Syringe", permission: "reproduction.create", bulk: false, cells: row("+--++~+++~") },
  { key: "PREG_CHECK", group: "reproduction", icon: "Stethoscope", permission: "reproduction.create", bulk: true, cells: row("+--++++++~") },
  { key: "CALVING", group: "reproduction", icon: "Baby", permission: "reproduction.create", bulk: false, cells: row("+--+++~~+~") },
  { key: "ABORTION", group: "reproduction", icon: "AlertTriangle", permission: "reproduction.create", bulk: false, cells: row("+--+++~~~~") },
  { key: "DRY_OFF", group: "milk", icon: "PauseCircle", permission: "reproduction.update", bulk: false, cells: row("+---++++-~") },
  { key: "ILLNESS", group: "health", icon: "Stethoscope", permission: "healthcare.update", bulk: true, cells: row(ALL_OK) },
  { key: "TREATMENT", group: "health", icon: "Stethoscope", permission: "healthcare.update", bulk: true, cells: row(ALL_OK) },
  { key: "VACCINATION", group: "health", icon: "Syringe", permission: "healthcare.update", bulk: true, cells: row(ALL_OK) },
  { key: "DEWORMING", group: "health", icon: "Pill", permission: "healthcare.update", bulk: true, cells: row(ALL_OK) },
  { key: "WEIGHT", group: "growth", icon: "Scale", permission: "cattle.update", bulk: true, cells: row(ALL_OK) },
  { key: "BCS", group: "growth", icon: "Gauge", permission: "cattle.bcs", bulk: true, cells: row("++~+++++++") },
  { key: "WEAN", group: "growth", icon: "Milk", permission: "cattle.update", bulk: true, cells: row("+++-------"), requiresAny: ["calves"] },
  {
    key: "CASTRATE",
    group: "health",
    icon: "Scissors",
    permission: "cattle.update",
    bulk: false,
    cells: row("-++------+"),
    requiresAny: ["male"],
    blockedBy: (f) => (f.gender === "CASTRATED_MALE" ? { key: "alreadyCastrated" } : null),
  },
  {
    key: "ENTER_FATTENING",
    group: "movement",
    icon: "TrendingUp",
    permission: "cattle.update",
    bulk: true,
    cells: row("++~++~+~+-"),
    blockedBy: (f) => (f.purpose === "FATTENING" ? { key: "alreadyFattening" } : null),
  },
  {
    key: "LEAVE_FATTENING",
    group: "movement",
    icon: "TrendingDown",
    permission: "cattle.update",
    bulk: true,
    cells: {},
    blockedBy: (f) => (f.purpose === "FATTENING" ? null : { key: "notFattening" }),
  },
  { key: "MOVE", group: "movement", icon: "ArrowLeftRight", permission: "cattle.update", bulk: true, cells: row(ALL_OK) },
  { key: "SELL", group: "movement", icon: "Banknote", permission: "cattle.dispose", bulk: false, cells: row(ALL_OK) },
  { key: "DEATH", group: "movement", icon: "Skull", permission: "cattle.dispose", bulk: false, cells: row(ALL_OK) },
  { key: "CULL", group: "movement", icon: "XCircle", permission: "cattle.dispose", bulk: false, cells: row(ALL_OK) },
  { key: "NOTE", group: "custom", icon: "StickyNote", permission: "cattle.update", bulk: true, cells: row(ALL_OK) },
  { key: "REMINDER", group: "custom", icon: "AlarmClock", permission: "cattle.update", bulk: true, cells: row(ALL_OK) },
];

export const EVENT_BY_KEY: Record<EventKey, EventDef> = Object.fromEntries(
  EVENT_CATALOGUE.map((def) => [def.key, def]),
) as Record<EventKey, EventDef>;

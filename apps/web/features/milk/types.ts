/**
 * Mirrors `rakhal-backend/src/modules/milk/application/services/milk.service.ts` response shapes
 * exactly (read directly from the service, not the aspirational `Rakhal_API.md` §6 — e.g.
 * `logTable` returns a flat object, not a cursor page; `sessionsStatus`/`sessionConfig` are real,
 * not invented; `anomalies` IS cursor-paginated as of RD-058). `/milk/quality` (API §6) is
 * skipped — V1.5, backend not built.
 */
import type { CursorPage } from "@/types/api";

export const MILK_SESSIONS = ["MORNING", "NOON", "EVENING", "NIGHT"] as const;
export type MilkSession = (typeof MILK_SESSIONS)[number];

export type SessionStatus = "submitted" | "pending" | "not_configured";
export type MilkTankType = "SELLABLE" | "WITHHOLDING";

export const MILK_TREND_RANGES = ["7d", "30d", "3m", "6m", "1y", "lifetime"] as const;
export type MilkTrendRange = (typeof MILK_TREND_RANGES)[number];

export interface MilkOverviewResponse {
  date: string;
  today: { totalL: number; sellableL: number; withholdingL: number; calfL: number };
  yesterday: { totalL: number };
  sameDayLastWeek: { totalL: number };
  sameDayLastYear: { totalL: number };
  /** Finance/Settings cost-per-litre wiring isn't built yet — always `null` on the real backend. */
  costPerLitreToday: number | null;
  marketValueToday: number | null;
  sessionsStatus: Record<string, SessionStatus>;
  trendRange: MilkTrendRange;
  trend: Array<{ date: string; totalL: number }>;
}

export interface MilkLogRow {
  cattleId: string;
  name: string | null;
  tag: string;
  shed: string | null;
  avgYield7d: number | null;
  prevDayYieldL: number | null;
  productionStatus: string;
  withholding: boolean;
  log: {
    morningL: number | null;
    noonL: number | null;
    eveningL: number | null;
    nightL: number | null;
    totalL: number;
    tank: MilkTankType;
    tankLocked: boolean;
    /** Specific `MilkTank.id` already saved for this cow today, if any (header default or a
     * row override) — null when no session entry named one yet, falls back to the derived
     * SELLABLE/WITHHOLDING type at submit time. */
    tankId: string | null;
    anomalyFlag: boolean;
    /** Sessions already `submitted` for this cow today — their tank volume has
     * already moved, so re-saving one now reconciles the balance instead of a
     * plain overwrite. */
    submittedSessions: MilkSession[];
    /** RAKHAL-277's per-entry `disposition`, keyed by session — only populated for
     * sessions that already have a logged `MilkLogEntry` (mirrors `milk.service.ts`'s
     * `logTable()`: `Object.fromEntries(cowEntries.map((e) => [e.session, e.disposition]))`). */
    dispositions: Partial<Record<MilkSession, MilkDisposition>>;
  };
}

export interface MilkLogTableResponse {
  date: string;
  sessionConfig: MilkSession[];
  entries: MilkLogRow[];
}

/** One calendar day's status (RAKHAL-434). `before_farm`/`future` are never colorable as a miss. */
export type EntryCalendarDayStatus = "complete" | "partial" | "missing" | "future" | "before_farm";

export interface EntryCalendarDay {
  date: string;
  status: EntryCalendarDayStatus;
}

/** `GET /milk/log/calendar?month=YYYY-MM` result. */
export interface EntryCalendarResult {
  month: string;
  days: EntryCalendarDay[];
}

export interface SaveMilkLogEntry {
  cattleId: string;
  yieldL: number;
  anomalyNote?: string;
  /** Specific `MilkTank.id` this cow's collection goes into (header default or a row
   * override) — omitted falls back to the backend's SELLABLE/WITHHOLDING type default. */
  tankId?: string;
  /** Optional note when overwriting a session already submitted — the tank balance
   * reconciles automatically either way, this is just an audit trail. */
  editReason?: string;
}

export interface SaveMilkLogInput {
  date: string;
  session: MilkSession;
  entries: SaveMilkLogEntry[];
}

export interface SaveMilkLogResponse {
  saved: number;
  anomaliesFlagged: number;
  sessionTotalL: number;
}

export interface SubmitMilkInput {
  date: string;
  session: MilkSession;
}

export interface SubmitMilkResponse {
  date: string;
  session: MilkSession;
  totalCowsLogged: number;
  sellableTotalL: number;
  withholdingTotalL: number;
  mainTankUpdated: boolean;
  withholdingTankUpdated: boolean;
  activityLogCreated: boolean;
  anomalies: Array<{ cattleId: string; name: string; yieldL: number }>;
}

export interface MilkAnomaly {
  id: string;
  cattleId: string;
  name: string | null;
  tag: string;
  date: string;
  session: MilkSession;
  yieldL: number;
  avg7dL: number | null;
  dropPct: number | null;
  workerNote: string | null;
  reviewed: boolean;
}

/** `GET /milk/anomalies` — cursor-paginated (RD-058: an unbounded `findMany` used to load every
 * flagged row for the farm in one response). Mirrors the shared `CursorPage<T>` envelope every
 * other cursor list in this codebase returns. */
export type MilkAnomaliesResponse = CursorPage<MilkAnomaly>;

export interface ReviewAnomalyInput {
  action: string;
  notes?: string;
}

/** `morning`/`noon`/`evening`/`night` — lowercase, matches the backend's
 * `FarmModuleSettings.milkActiveSessions` storage + `UpdateMilkSessionsDto`. */
export type MilkSessionKey = "morning" | "noon" | "evening" | "night";

export interface UpdateMilkSessionsInput {
  active_sessions: MilkSessionKey[];
}

export interface UpdateMilkSessionsResponse {
  active_sessions: MilkSessionKey[];
}

export interface MilkImportRow {
  row: number;
  date: string | null;
  tag: string | null;
  status: "ready" | "error";
  error?: string;
}

/** `POST /milk/import/preview` response — cached server-side under `importSessionId` (30 min TTL). */
export interface MilkImportPreview {
  importSessionId: string;
  total: number;
  ready: number;
  errors: number;
  rows: MilkImportRow[];
}

/** `POST /milk/import/confirm` response. */
export interface MilkImportConfirmResult {
  imported: number;
  skipped: number;
  failedGroups: number;
}

export interface ExportMilkLogInput {
  from: string;
  to: string;
  cattleIds?: string[];
}

/**
 * RAKHAL-277/278 (backend `MilkDisposition` + `MilkEligibility`) — now wired. Confirmed by reading
 * the backend source directly (not guessed): `GET /milk/log` (`logTable()`) now includes
 * `log.dispositions` (per-session map, see `MilkLogRow` above) and `GET /milk/cattle/:id/eligibility`
 * (`MilkController.eligibility` → `MilkService.getMilkEligibility`) returns `MilkEligibility` below.
 */
export const MILK_DISPOSITIONS = [
  "SALEABLE",
  "WITHHELD",
  "COLOSTRUM",
  "CALF_FEED",
  "DISCARDED",
  "HOUSEHOLD_USE",
] as const;
export type MilkDisposition = (typeof MILK_DISPOSITIONS)[number];

export type MilkEligibilityStatus = "SALEABLE" | "WITHHELD" | "COLOSTRUM" | "DISCARD_REQUIRED";

export type MilkRestrictionReason =
  | "COLOSTRUM_PERIOD"
  | "MEDICINE_WITHDRAWAL"
  | "MASTITIS"
  | "VETERINARY_HOLD"
  | "ABNORMAL_MILK"
  | "OTHER";

export interface MilkEligibility {
  isSaleable: boolean;
  primaryStatus: MilkEligibilityStatus;
  reasons: MilkRestrictionReason[];
}

/**
 * RAKHAL-282/293-F — milk quality testing (lab/device composition readings, distinct from the
 * daily-yield `MilkLogEntry` above). Mirrors `MilkQualityTest` (Prisma model,
 * `rakhal-backend/prisma/schemas/milk/milk.prisma`) and `MilkQualityService` exactly, verified by
 * reading the backend source (routes + DTOs + service), not guessed. `POST/GET /milk/quality-tests`
 * (+ `GET /milk/quality-tests/latest`) are `milk.quality.create`/`milk.quality.read`-gated — not
 * yet in the aspirational `Rakhal_API.md` §6.
 */
export const MILK_QUALITY_TEST_SOURCES = ["LAB", "DEVICE", "MANUAL"] as const;
export type MilkQualityTestSource = (typeof MILK_QUALITY_TEST_SOURCES)[number];

export interface MilkQualityTest {
  id: string;
  cattleId: string;
  lactationId: string;
  sampleDate: string;
  fatPct: number;
  proteinPct: number;
  lactosePct: number | null;
  /** Cells per mL. */
  somaticCellCount: number | null;
  /** mg/dL. */
  milkUreaNitrogen: number | null;
  source: MilkQualityTestSource;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMilkQualityTestInput {
  cattleId: string;
  lactationId: string;
  sampleDate: string;
  fatPct: number;
  proteinPct: number;
  lactosePct?: number;
  somaticCellCount?: number;
  milkUreaNitrogen?: number;
  source: MilkQualityTestSource;
  notes?: string;
}

export interface ListMilkQualityTestsParams {
  cattleId?: string;
  lactationId?: string;
  cursor?: string;
  limit?: number;
}

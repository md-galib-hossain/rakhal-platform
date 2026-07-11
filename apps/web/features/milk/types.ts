/**
 * Mirrors `rakhal-backend/src/modules/milk/application/services/milk.service.ts` response shapes
 * exactly (read directly from the service, not the aspirational `Rakhal_API.md` §6 — e.g.
 * `logTable`/`anomalies` return flat objects, not cursor pages; `sessionsStatus`/`sessionConfig`
 * are real, not invented). `/milk/quality` (API §6) is skipped — V1.5, backend not built.
 */

export const MILK_SESSIONS = ["MORNING", "NOON", "EVENING", "NIGHT"] as const;
export type MilkSession = (typeof MILK_SESSIONS)[number];

export type SessionStatus = "submitted" | "pending" | "not_configured";
export type MilkTankType = "SELLABLE" | "WITHHOLDING";

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
  trend30Days: Array<{ date: string; totalL: number }>;
}

export interface MilkLogRow {
  cattleId: string;
  name: string | null;
  tag: string;
  shed: string | null;
  avgYield7d: number | null;
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
    anomalyFlag: boolean;
  };
}

export interface MilkLogTableResponse {
  date: string;
  sessionConfig: MilkSession[];
  entries: MilkLogRow[];
}

export interface SaveMilkLogEntry {
  cattleId: string;
  yieldL: number;
  anomalyNote?: string;
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

export interface MilkAnomaliesResponse {
  anomalies: MilkAnomaly[];
}

export interface ReviewAnomalyInput {
  action: string;
  notes?: string;
}

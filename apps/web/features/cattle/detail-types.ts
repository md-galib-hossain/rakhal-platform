/**
 * RFE-023 — Cattle detail page (5 tabs). Types mirror the real backend services directly
 * (`cattle-detail.service.ts#overview/pedigree/cattleFinance`, `reproduction.service.ts#summary`,
 * `health.service.ts#getCattleHealthSummary`) — verified live via Swagger, not the aspirational
 * `Rakhal_API.md` §4/§5/§9/§12, which don't document these per-animal aggregation shapes at all.
 */

import type { CattleGender } from "./types";

// ---- Overview (Tab 1) ------------------------------------------------------

export interface BcsRecord {
  date: string;
  score: number;
}

export interface WeightHistoryRecord {
  date: string;
  weight_kg: number;
}

/** `GET /cattle/:id/weight/history` — day/week/month/year toggle for the Overview weight chart. */
export type WeightHistoryPeriod = "day" | "week" | "month" | "year";

export interface WeightHistoryPoint {
  date: string;
  weightKg: number;
}

export interface WeightHistoryResponse {
  period: WeightHistoryPeriod;
  points: WeightHistoryPoint[];
}

export interface LactationCurvePoint {
  dim: number;
  yield_l: number;
}

export interface LifetimeYieldPoint {
  year: number;
  total_l: number;
}

export interface RecentMilkRecord {
  date: string;
  morning_l: number;
  noon_l: number;
  evening_l: number;
  night_l: number;
  total_l: number;
}

export interface CattleOverview {
  aqr_score: number | null;
  aqr_change_pct: number | null;
  avg_daily_yield_7d: number;
  yield_change_pct: number | null;
  last_weight_kg: number | null;
  weight_change_pct: number | null;
  bcs_records: BcsRecord[];
  weight_history: WeightHistoryRecord[];
  lactation_curve: LactationCurvePoint[];
  lifetime_yield: LifetimeYieldPoint[];
  recent_milk_records: RecentMilkRecord[];
}

// ---- Reproduction (Tab 2) ---------------------------------------------------

/** `GET /cattle/:id/reproduction-summary` — female cattle only; the backend 400s for male/castrated
 * (`getFemaleCattle`), so the UI must gate the query on `gender === "FEMALE"`, not just render the
 * error state. */
export interface ReproductionSummary {
  cattle: { id: string; tagNumber: string };
  status: string;
  currentLactation: number;
  dim: number | null;
  totalCalvings: number;
  totalPregnancies: number;
  totalAbortions: number;
  conceptionRate: number | null;
  servicesPerConception: number | null;
  averageCalvingInterval: number | null;
  expectedCalvingDate: string | null;
  daysPregnant: number | null;
  lastBreeding: string | null;
  daysOpen: number | null;
  gestationLength: number | null;
}

/** One row of `GET /reproduction/calving-events?cattleId=` (cursor list). */
export interface CalvingEventRow {
  id: string;
  calvingDate: string;
  calvingNumber: number;
  calvingEase: string;
  calfCount: number;
  calfBirths: { id: string; gender: CattleGender; birthWeight: number | null }[];
}

// ---- Health (Tab 3) ---------------------------------------------------------

export interface HealthCaseRow {
  id: string;
  caseCode: string;
  diagnosis: string;
  diagnosisType: string;
  priority: string;
  status: string;
  startDate: string;
  progressPercentage: number;
  currentStep: number;
  totalSteps: number;
  tasks: { id: string; dueDateTime: string; taskType: string }[];
}

export interface TreatmentLogRow {
  id: string;
  medicineName: string | null;
  route: string | null;
  doseAmount: number | null;
  doseUnit: string | null;
  administeredAt: string;
  notes: string | null;
}

export interface SafetyWithdrawalRow {
  id: string;
  milkWithdrawalUntil: string | null;
  meatWithdrawalUntil: string | null;
  status: string;
}

export interface MortalityRecord {
  deathDate: string;
  primaryCauseOfDeath: string;
}

export interface HealthSummary {
  activeCases: HealthCaseRow[];
  ongoingTreatment: boolean;
  treatmentHistory: TreatmentLogRow[];
  safetyWithdrawalWarning: boolean;
  activeWithdrawals: SafetyWithdrawalRow[];
  mortalityStatus: MortalityRecord | null;
}

// ---- Finance (Tab 4) ---------------------------------------------------------

export interface CattleFinanceMonth {
  month: string;
  income: number;
  cost: number;
}

export interface CattleFinance {
  period: string;
  total_income: number;
  total_cost: number;
  net_profit: number;
  expense_breakdown: { feed: number; health: number; breeding: number; others: number };
  income_breakdown: { milk_sales: number; calf_sales: number };
  monthly_chart: CattleFinanceMonth[];
}

// ---- Pedigree (Tab 5) ---------------------------------------------------------

export interface PedigreeNode {
  id: string | null;
  name: string | null;
  tag: string | null;
  gender: string;
  farm_name?: string | null;
  is_external?: boolean;
  dam?: PedigreeNode | null;
  sire?: (PedigreeNode & { is_external?: boolean }) | null;
}

export interface PedigreeSibling extends PedigreeNode {
  relation: "full_sibling" | "half_sibling";
}

export interface PedigreeOffspring {
  id: string;
  name: string | null;
  tag: string;
  gender: CattleGender;
  birth_date: string | null;
  farm_name?: string | null;
}

export interface CattlePedigree {
  self: PedigreeNode;
  dam: PedigreeNode | null;
  sire: (PedigreeNode & { is_external: boolean }) | null;
  siblings: PedigreeSibling[];
  offspring: PedigreeOffspring[];
}

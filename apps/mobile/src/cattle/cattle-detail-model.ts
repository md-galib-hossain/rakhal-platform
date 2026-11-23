/**
 * Cattle detail model (WP9 & Animal Workspace). Pure: node --test imports this file.
 *
 * Populated by live `/profile`, `/overview`, `/reproduction-summary`, `/health-summary`,
 * `/pedigree`, `/finance`, `/events`, and `/upcoming-events`, or offline from the cached row.
 * Defensive parsing: every field is checked and invalid values fall back to null/defaults.
 */
import type { CattleListItem } from './cattle-model.ts';
import { ageInMonths } from './cattle-model.ts';

// ---- Overview Types ----
export interface RecentMilkRecord {
  date: string;
  morning_l: number;
  noon_l: number;
  evening_l: number;
  night_l: number;
  total_l: number;
}

export interface BcsRecord {
  date: string;
  score: number;
}

export interface WeightHistoryRecord {
  date: string;
  weight_kg: number;
}

export interface CattleOverviewData {
  aqr_score: number | null;
  avg_daily_yield_7d: number | null;
  last_weight_kg: number | null;
  recent_milk_records: RecentMilkRecord[];
  weight_history: WeightHistoryRecord[];
  bcs_records: BcsRecord[];
}

// ---- Reproduction Types ----
export interface ReproductionSummaryData {
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

// ---- Health Types ----
export interface HealthCaseItem {
  id: string;
  caseCode: string;
  note: string | null;
  condition: string | null;
  careType: string;
  priority: string;
  status: string;
  startDate: string;
  currentStep: number;
  totalSteps: number;
}

export interface ActiveWithdrawalItem {
  id: string;
  kind: 'milk' | 'meat';
  until: string;
  daysLeft: number;
}

export interface HealthSummaryData {
  activeCases: HealthCaseItem[];
  ongoingTreatment: boolean;
  activeWithdrawals: ActiveWithdrawalItem[];
  safetyWithdrawalWarning: boolean;
}

// ---- Pedigree Types ----
export interface PedigreeNode {
  id: string | null;
  name: string | null;
  tag: string | null;
  gender?: string | null;
  farm_name?: string | null;
  is_external?: boolean;
}

export interface PedigreeOffspringItem {
  id: string;
  name: string | null;
  tag: string;
  gender: string;
  birth_date: string | null;
  farm_name?: string | null;
}

export interface PedigreeData {
  self: PedigreeNode;
  dam: PedigreeNode | null;
  sire: PedigreeNode | null;
  siblings: PedigreeNode[];
  offspring: PedigreeOffspringItem[];
}

// ---- Finance Types ----
export interface FinanceMonthPoint {
  month: string;
  income: number;
  cost: number;
}

export interface FinanceData {
  period: string;
  total_income: number;
  total_cost: number;
  net_profit: number;
  expense_breakdown: { feed: number; health: number; breeding: number; others: number };
  income_breakdown: { milk_sales: number; calf_sales: number };
  monthly_chart: FinanceMonthPoint[];
}

// ---- Feed Requirement Types ----
export interface FeedRequirementProfile {
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  ne_mcal: number;
  energy_density_mj_per_kg_dm: number;
  cp_pct_of_dm: number;
  rdp_pct: number;
  rup_pct: number;
}

// ---- Timeline Types ----
export interface TimelineEventItem {
  id: string;
  type: string;
  eventAt: string;
  title: string | null;
  notes: string | null;
  group: 'REPRODUCTION' | 'HEALTH' | 'GROWTH' | 'MOVEMENT' | 'OTHER';
  recordedById: string | null;
  recordedByName: string | null;
  status: string; // e.g. ACTIVE, VOIDED
  payload?: Record<string, unknown> | null;
}

// ---- Upcoming Event Types ----
export interface UpcomingEventItem {
  id: string;
  kind: string;
  title: string;
  urgency: string;
  actionable: boolean;
  daysUntil: number;
  dueAt: string;
}

// ---- Phase Bar Types ----
export type PhaseKey = 'calved' | 'vwp' | 'bred' | 'check' | 'due';

export interface PhaseMarker {
  key: PhaseKey;
  pct: number;
  recorded: boolean;
  date: string;
  fromToday: number;
  gap: number | null;
}

export interface PhaseBar {
  markers: PhaseMarker[];
  todayPct: number | null;
}

// ---- Unified Detail Interface ----
export interface CattleDetail {
  id: string;
  tagNumber: string;
  name: string | null;
  breedName: string | null;
  gender: string | null;
  animalCategory: string | null;
  dateOfBirth: string | null;
  age: { years: number; months: number } | null;
  shedName: string | null;
  herdStatus: string | null;
  productionStatus: string | null;
  healthStatus: string | null;
  reproductiveStatus: string | null;
  motherLabel: string | null;
  fatherLabel: string | null;
  childrenCount: number | null;
  /** From /overview; null offline or when the overview could not be loaded. */
  avgDailyYield7d: number | null;
  lastWeightKg: number | null;
  aqrScore: number | null;
  updatedAt: string | null;

  // Extended Workspace Data
  dim?: number | null;
  lactationStage?: string | null;
  sourceType?: string | null;
  hasMilkHold?: boolean;
  overview?: CattleOverviewData | null;
  reproduction?: ReproductionSummaryData | null;
  health?: HealthSummaryData | null;
  pedigree?: PedigreeData | null;
  finance?: FinanceData | null;
  feedRequirement?: FeedRequirementProfile | null;
  timelineEvents?: TimelineEventItem[];
  upcomingEvents?: UpcomingEventItem[];
}

// ---- Helpers ----
function rec(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function bool(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}
function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function animalLabel(value: unknown): string | null {
  const animal = rec(value);
  if (!animal) return null;
  const tag = str(animal.tagNumber);
  const name = str(animal.name);
  return tag && name ? `${tag} · ${name}` : (tag ?? name);
}

export function ageFrom(dateOfBirth: string | null, now: number): { years: number; months: number } | null {
  const total = ageInMonths(dateOfBirth, now);
  return total === null ? null : { years: Math.floor(total / 12), months: total % 12 };
}

function readAge(value: unknown, dateOfBirth: string | null, now: number): CattleDetail['age'] {
  const age = rec(value);
  const years = age ? num(age.years) : null;
  const months = age ? num(age.months) : null;
  return years !== null && months !== null ? { years, months } : ageFrom(dateOfBirth, now);
}

export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso);
  const a = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dt = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const dt = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

// ---- Parsers ----
export function parseProfile(raw: unknown, now: number): CattleDetail | null {
  const p = rec(raw);
  const id = p ? str(p.id) : null;
  if (!p || !id) return null;
  const dateOfBirth = str(p.dateOfBirth);
  const repro = rec(p.reproductionProfile);
  const dim = num(p.dim) ?? num(repro?.dim);

  return {
    id,
    tagNumber: str(p.tagNumber) ?? '',
    name: str(p.name),
    breedName: str(rec(p.breed)?.name),
    gender: str(p.gender),
    animalCategory: str(p.animalCategory),
    dateOfBirth,
    age: readAge(p.age, dateOfBirth, now),
    shedName: str(rec(p.shed)?.name),
    herdStatus: str(p.herdStatus),
    productionStatus: str(p.productionStatus),
    healthStatus: str(p.healthStatus),
    reproductiveStatus: str(p.reproductiveStatus) ?? str(repro?.reproductiveStatus),
    motherLabel: animalLabel(p.mother),
    fatherLabel: animalLabel(p.father),
    childrenCount: num(p.childrenCount),
    avgDailyYield7d: null,
    lastWeightKg: num(p.lastWeightKg),
    aqrScore: num(p.aqrScore),
    updatedAt: str(p.updatedAt),
    dim,
    lactationStage: str(p.lactationStage),
    sourceType: str(p.sourceType),
    hasMilkHold: false,
  };
}

export function parseOverview(raw: unknown): CattleOverviewData | null {
  const o = rec(raw);
  if (!o) return null;

  const recent_milk_records: RecentMilkRecord[] = arr(o.recent_milk_records).map((item) => {
    const r = rec(item);
    return {
      date: (str(r?.date) ?? '').slice(0, 10),
      morning_l: num(r?.morning_l) ?? 0,
      noon_l: num(r?.noon_l) ?? 0,
      evening_l: num(r?.evening_l) ?? 0,
      night_l: num(r?.night_l) ?? 0,
      total_l: num(r?.total_l) ?? 0,
    };
  }).filter((r) => Boolean(r.date));

  const weight_history: WeightHistoryRecord[] = arr(o.weight_history).map((item) => {
    const r = rec(item);
    return {
      date: (str(r?.date) ?? '').slice(0, 10),
      weight_kg: num(r?.weight_kg) ?? 0,
    };
  }).filter((r) => Boolean(r.date));

  const bcs_records: BcsRecord[] = arr(o.bcs_records).map((item) => {
    const r = rec(item);
    return {
      date: (str(r?.date) ?? '').slice(0, 10),
      score: num(r?.score) ?? 0,
    };
  }).filter((r) => Boolean(r.date));

  return {
    aqr_score: num(o.aqr_score),
    avg_daily_yield_7d: num(o.avg_daily_yield_7d),
    last_weight_kg: num(o.last_weight_kg),
    recent_milk_records,
    weight_history,
    bcs_records,
  };
}

export function withOverview(detail: CattleDetail, raw: unknown): CattleDetail {
  const overview = parseOverview(raw);
  if (!overview) return detail;
  return {
    ...detail,
    overview,
    avgDailyYield7d: overview.avg_daily_yield_7d ?? detail.avgDailyYield7d,
    lastWeightKg: overview.last_weight_kg ?? detail.lastWeightKg,
    aqrScore: overview.aqr_score ?? detail.aqrScore,
  };
}

export function parseReproductionSummary(raw: unknown): ReproductionSummaryData | null {
  const r = rec(raw);
  if (!r) return null;
  return {
    status: str(r.status) ?? 'OPEN',
    currentLactation: num(r.currentLactation) ?? 0,
    dim: num(r.dim),
    totalCalvings: num(r.totalCalvings) ?? 0,
    totalPregnancies: num(r.totalPregnancies) ?? 0,
    totalAbortions: num(r.totalAbortions) ?? 0,
    conceptionRate: num(r.conceptionRate),
    servicesPerConception: num(r.servicesPerConception),
    averageCalvingInterval: num(r.averageCalvingInterval),
    expectedCalvingDate: str(r.expectedCalvingDate),
    daysPregnant: num(r.daysPregnant),
    lastBreeding: str(r.lastBreeding),
    daysOpen: num(r.daysOpen),
    gestationLength: num(r.gestationLength),
  };
}

export function parseHealthSummary(raw: unknown, today = todayIso()): HealthSummaryData | null {
  const h = rec(raw);
  if (!h) return null;

  const activeCases: HealthCaseItem[] = arr(h.activeCases).map((item) => {
    const c = rec(item);
    return {
      id: str(c?.id) ?? '',
      caseCode: str(c?.caseCode) ?? '',
      note: str(c?.note),
      condition: str(c?.condition),
      careType: str(c?.careType) ?? 'CURATIVE',
      priority: str(c?.priority) ?? 'MEDIUM',
      status: str(c?.status) ?? 'OPEN',
      startDate: str(c?.startDate) ?? '',
      currentStep: num(c?.currentStep) ?? 1,
      totalSteps: num(c?.totalSteps) ?? 1,
    };
  }).filter((c) => Boolean(c.id));

  const activeWithdrawals: ActiveWithdrawalItem[] = [];
  for (const item of arr(h.activeWithdrawals)) {
    const w = rec(item);
    if (!w) continue;
    const milk = str(w.milkWithdrawalUntil)?.slice(0, 10);
    const meat = str(w.meatWithdrawalUntil)?.slice(0, 10);
    if (milk && milk >= today) {
      const daysLeft = Math.round((Date.parse(milk) - Date.parse(today)) / 86_400_000);
      activeWithdrawals.push({ id: `${str(w.id)}-milk`, kind: 'milk', until: milk, daysLeft: Math.max(0, daysLeft) });
    }
    if (meat && meat >= today) {
      const daysLeft = Math.round((Date.parse(meat) - Date.parse(today)) / 86_400_000);
      activeWithdrawals.push({ id: `${str(w.id)}-meat`, kind: 'meat', until: meat, daysLeft: Math.max(0, daysLeft) });
    }
  }

  return {
    activeCases,
    ongoingTreatment: bool(h.ongoingTreatment),
    activeWithdrawals,
    safetyWithdrawalWarning: bool(h.safetyWithdrawalWarning) || activeWithdrawals.length > 0,
  };
}

export function parsePedigreeNode(raw: unknown): PedigreeNode | null {
  const p = rec(raw);
  if (!p) return null;
  return {
    id: str(p.id),
    name: str(p.name),
    tag: str(p.tag) ?? str(p.tagNumber),
    gender: str(p.gender),
    farm_name: str(p.farm_name),
    is_external: bool(p.is_external),
  };
}

export function parsePedigree(raw: unknown): PedigreeData | null {
  const p = rec(raw);
  if (!p) return null;
  const self = parsePedigreeNode(p.self) ?? { id: null, name: null, tag: null };
  const dam = parsePedigreeNode(p.dam);
  const sire = parsePedigreeNode(p.sire);

  const siblings: PedigreeNode[] = arr(p.siblings).map(parsePedigreeNode).filter((s): s is PedigreeNode => s !== null);
  const offspring: PedigreeOffspringItem[] = arr(p.offspring).map((item) => {
    const o = rec(item);
    return {
      id: str(o?.id) ?? '',
      name: str(o?.name),
      tag: str(o?.tag) ?? '',
      gender: str(o?.gender) ?? 'FEMALE',
      birth_date: str(o?.birth_date),
      farm_name: str(o?.farm_name),
    };
  }).filter((o) => Boolean(o.id));

  return { self, dam, sire, siblings, offspring };
}

export function parseFinance(raw: unknown): FinanceData | null {
  const f = rec(raw);
  if (!f) return null;

  const expense = rec(f.expense_breakdown) ?? {};
  const income = rec(f.income_breakdown) ?? {};

  const monthly_chart: FinanceMonthPoint[] = arr(f.monthly_chart).map((item) => {
    const m = rec(item);
    return {
      month: str(m?.month) ?? '',
      income: num(m?.income) ?? 0,
      cost: num(m?.cost) ?? 0,
    };
  }).filter((m) => Boolean(m.month));

  return {
    period: str(f.period) ?? '',
    total_income: num(f.total_income) ?? 0,
    total_cost: num(f.total_cost) ?? 0,
    net_profit: num(f.net_profit) ?? 0,
    expense_breakdown: {
      feed: num(expense.feed) ?? 0,
      health: num(expense.health) ?? 0,
      breeding: num(expense.breeding) ?? 0,
      others: num(expense.others) ?? 0,
    },
    income_breakdown: {
      milk_sales: num(income.milk_sales) ?? 0,
      calf_sales: num(income.calf_sales) ?? 0,
    },
    monthly_chart,
  };
}

export function parseFeedRequirement(raw: unknown): FeedRequirementProfile | null {
  const r = rec(raw);
  if (!r) return null;
  // May be wrapped in { resolved: { requirements: ... } } or directly { requirements: ... }
  const reqObj = rec(rec(r.resolved)?.requirements) ?? rec(r.requirements) ?? rec(r.calculated) ?? r;
  if (!reqObj || typeof reqObj.dm_kg !== 'number') return null;

  return {
    dm_kg: num(reqObj.dm_kg) ?? 0,
    cp_kg: num(reqObj.cp_kg) ?? 0,
    me_mj: num(reqObj.me_mj) ?? 0,
    ne_mcal: num(reqObj.ne_mcal) ?? 0,
    energy_density_mj_per_kg_dm: num(reqObj.energy_density_mj_per_kg_dm) ?? 0,
    cp_pct_of_dm: num(reqObj.cp_pct_of_dm) ?? 0,
    rdp_pct: num(reqObj.rdp_pct) ?? 0,
    rup_pct: num(reqObj.rup_pct) ?? 0,
  };
}

export function parseTimelineEvents(raw: unknown): TimelineEventItem[] {
  const data = rec(raw)?.items ?? raw;
  return arr(data).map((item) => {
    const e = rec(item);
    const type = str(e?.type) ?? 'OTHER';
    let group: TimelineEventItem['group'] = 'OTHER';
    if (['HEAT', 'BREEDING', 'SERVICE', 'PREG_CHECK', 'CALVING', 'DRY_OFF', 'ABORTION'].includes(type)) group = 'REPRODUCTION';
    else if (['ILLNESS', 'TREATMENT', 'VACCINATION', 'DEWORMING'].includes(type)) group = 'HEALTH';
    else if (['WEIGHT', 'BCS', 'WEAN', 'CASTRATE'].includes(type)) group = 'GROWTH';
    else if (['MOVEMENT', 'MOVE', 'PEN_CHANGE', 'SHED_CHANGE'].includes(type)) group = 'MOVEMENT';

    return {
      id: str(e?.id) ?? '',
      type,
      eventAt: str(e?.eventAt) ?? str(e?.date) ?? '',
      title: str(e?.title) ?? humanize(type),
      notes: str(e?.notes),
      group,
      recordedById: str(e?.recordedById) ?? str(e?.recorded_by_id),
      recordedByName: str(rec(e?.recordedBy)?.name) ?? str(e?.recordedByName),
      status: str(e?.status) ?? 'ACTIVE',
      payload: rec(e?.payload),
    };
  }).filter((e) => Boolean(e.id));
}

export function parseUpcomingEvents(raw: unknown): UpcomingEventItem[] {
  const r = rec(raw);
  const data = r?.events ?? rec(r?.data)?.events ?? raw;
  return arr(data).map((item, idx) => {
    const e = rec(item);
    return {
      id: str(e?.id) ?? `${str(e?.kind) ?? 'task'}-${idx}`,
      kind: str(e?.kind) ?? 'TASK',
      title: str(e?.title) ?? 'Upcoming task',
      urgency: str(e?.urgency) ?? 'NORMAL',
      actionable: bool(e?.actionable ?? true),
      daysUntil: num(e?.daysUntil) ?? 0,
      dueAt: str(e?.dueAt) ?? '',
    };
  });
}

export function fromCacheItem(item: CattleListItem, now: number): CattleDetail {
  return {
    id: item.id,
    tagNumber: item.tagNumber,
    name: item.name,
    breedName: item.breedName,
    gender: item.gender,
    animalCategory: item.animalCategory,
    dateOfBirth: item.dateOfBirth,
    age: ageFrom(item.dateOfBirth, now),
    shedName: item.shedName ?? null,
    herdStatus: item.herdStatus,
    productionStatus: item.productionStatus,
    healthStatus: item.healthStatus,
    reproductiveStatus: item.reproductiveStatus,
    motherLabel: null,
    fatherLabel: null,
    childrenCount: null,
    avgDailyYield7d: null,
    lastWeightKg: item.lastWeightKg ?? null,
    aqrScore: item.aqrScore ?? null,
    updatedAt: item.updatedAt,
    dim: null,
    lactationStage: item.lactationStage ?? null,
    sourceType: null,
    hasMilkHold: false,
  };
}

// ---- Overview Calculations ----
export const DEFAULT_VWP_DAYS = 60;
const PD_CHECK_AFTER_SERVICE = 35;
const GESTATION_DAYS = 283;
const LACTATION_SPAN = 365;

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function buildPhaseBar(input: {
  today: string;
  dim: number | null;
  lastBreeding: string | null;
  expectedCalvingDate: string | null;
  pregnant: boolean;
  vwpDays?: number;
}): PhaseBar | null {
  const { today, dim, lastBreeding, expectedCalvingDate, pregnant } = input;
  const vwp = input.vwpDays ?? DEFAULT_VWP_DAYS;
  const calvingDate = dim != null ? addDaysIso(today, -dim) : null;
  const served = lastBreeding?.slice(0, 10) ?? null;
  const anchor = calvingDate ?? served;
  if (!anchor) return null;
  const bredDate = served && served >= anchor ? served : null;
  const dueDate = pregnant && expectedCalvingDate ? expectedCalvingDate.slice(0, 10) : bredDate ? addDaysIso(bredDate, GESTATION_DAYS) : null;
  const span = Math.max(dueDate ? dayDiff(anchor, dueDate) : LACTATION_SPAN, dayDiff(anchor, today), 1);
  const at = (date: string) => clamp((dayDiff(anchor, date) / span) * 100);

  const markers: PhaseMarker[] = [];
  const ahead = (date: string) => dayDiff(today, date);
  if (calvingDate) {
    markers.push({ key: 'calved', pct: 0, recorded: true, date: calvingDate, fromToday: ahead(calvingDate), gap: null });
    const vwpEnd = addDaysIso(calvingDate, vwp);
    markers.push({ key: 'vwp', pct: at(vwpEnd), recorded: vwpEnd <= today, date: vwpEnd, fromToday: ahead(vwpEnd), gap: vwp });
  }
  if (bredDate) {
    markers.push({ key: 'bred', pct: at(bredDate), recorded: true, date: bredDate, fromToday: ahead(bredDate), gap: calvingDate ? dayDiff(calvingDate, bredDate) : null });
    const check = addDaysIso(bredDate, PD_CHECK_AFTER_SERVICE);
    markers.push({ key: 'check', pct: at(check), recorded: pregnant || check <= today, date: check, fromToday: ahead(check), gap: PD_CHECK_AFTER_SERVICE });
  }
  if (dueDate) {
    markers.push({ key: 'due', pct: at(dueDate), recorded: false, date: dueDate, fromToday: ahead(dueDate), gap: bredDate ? dayDiff(bredDate, dueDate) : GESTATION_DAYS });
  }
  return { markers, todayPct: calvingDate ? at(today) : null };
}

export function calvingsShown(totalCalvings: number | null | undefined, dim: number | null): number {
  return Math.max(totalCalvings ?? 0, dim != null ? 1 : 0);
}

export function milkFigures(records: { date: string; total_l: number }[], today: string) {
  const normToday = today.slice(0, 10);
  const byDate = new Map<string, number>();
  for (const r of records) {
    const d = r.date.slice(0, 10);
    if (!d) continue;
    byDate.set(d, (byDate.get(d) ?? 0) + (Number.isFinite(r.total_l) ? r.total_l : 0));
  }
  const weekStart = addDaysIso(normToday, -6);
  let weekTotal = 0;
  for (const [d, total] of byDate.entries()) {
    if (d >= weekStart && d <= normToday) {
      weekTotal += total;
    }
  }
  const series: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDaysIso(normToday, -i);
    series.push(byDate.get(d) ?? 0);
  }
  return {
    series,
    today: byDate.get(normToday) ?? null,
    weekTotal,
    hasData: records.length > 0,
  };
}

export function weightTrend(history: { date: string; weight_kg: number }[], today: string) {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const series = sorted.map((p) => p.weight_kg);
  if (sorted.length < 2) return { series, delta30: null as number | null };
  const last = sorted[sorted.length - 1];
  const from = addDaysIso(today, -30);
  const base = sorted.find((p) => p.date >= from && p !== last) ?? sorted[sorted.length - 2];
  return { series, delta30: Math.round(((last?.weight_kg ?? 0) - (base?.weight_kg ?? 0)) * 10) / 10 };
}

export function overviewCards(cattle: { gender: string | null; animalCategory: string | null; productionStatus: string | null }) {
  const female = cattle.gender === 'FEMALE';
  return {
    reproduction: female && (cattle.animalCategory === 'HEIFER' || cattle.animalCategory === 'COW'),
    milk: female && (cattle.animalCategory === 'COW' || cattle.productionStatus != null),
  };
}

export function humanize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

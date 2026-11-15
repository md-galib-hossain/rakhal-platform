/**
 * Cattle detail model (WP9). Pure: node --test imports this file.
 *
 * Two sources fill one shape: the live `GET /cattle/{id}/profile` (camelCase) plus `/overview` (snake_case), or, offline,
 * the cached list row (fewer fields; the rest stay null and the screen leaves them out). Parsing is defensive: the
 * OpenAPI file does not describe these two payloads, so every field is checked and a missing or odd one becomes null.
 */
import type { CattleListItem } from './cattle-model.ts';
import { ageInMonths } from './cattle-model.ts';

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
}

function rec(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

/** The server's own age (`{ years, months }`) when valid, else computed from the date of birth. */
function readAge(value: unknown, dateOfBirth: string | null, now: number): CattleDetail['age'] {
  const age = rec(value);
  const years = age ? num(age.years) : null;
  const months = age ? num(age.months) : null;
  return years !== null && months !== null ? { years, months } : ageFrom(dateOfBirth, now);
}

/** Parse the `data` of `/cattle/{id}/profile`; null when it has no id. */
export function parseProfile(raw: unknown, now: number): CattleDetail | null {
  const p = rec(raw);
  const id = p ? str(p.id) : null;
  if (!p || !id) return null;
  const dateOfBirth = str(p.dateOfBirth);
  const repro = rec(p.reproductionProfile);
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
  };
}

/** Merge `/overview` (snake_case) into a profile-based detail; an unreadable overview changes nothing. */
export function withOverview(detail: CattleDetail, raw: unknown): CattleDetail {
  const o = rec(raw);
  if (!o) return detail;
  return {
    ...detail,
    avgDailyYield7d: num(o.avg_daily_yield_7d) ?? detail.avgDailyYield7d,
    lastWeightKg: num(o.last_weight_kg) ?? detail.lastWeightKg,
    aqrScore: num(o.aqr_score) ?? detail.aqrScore,
  };
}

/** The offline fallback: what the cached list row knows. */
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
    shedName: null,
    herdStatus: item.herdStatus,
    productionStatus: item.productionStatus,
    healthStatus: item.healthStatus,
    reproductiveStatus: item.reproductiveStatus,
    motherLabel: null,
    fatherLabel: null,
    childrenCount: null,
    avgDailyYield7d: null,
    lastWeightKg: null,
    aqrScore: null,
    updatedAt: item.updatedAt,
  };
}

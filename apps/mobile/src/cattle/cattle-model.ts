/**
 * Cattle list model (WP9). Pure: node --test imports this file (no React, no React Native).
 *
 * Turns a cached row (what `readCache('cattle')` returns, see `buildPullSpecs` in offline/pull.ts) into a typed
 * `CattleListItem`, and decides which ONE status the list badge shows. The server sends enum strings; an unknown
 * value is kept as text (shown humanized) so a new server status never hides an animal or crashes a screen.
 */
import type { MessageKey } from '../i18n/messages.ts';
import type { HerdState, StatusTone } from '../components/display/status-style.ts';

export interface CattleNextEvent {
  kind: string;
  title?: string | null;
  urgency: string | null;
  actionable?: boolean;
  daysUntil: number | null;
  dueAt: string | null;
  labelKey: string | null;
  labelParams?: Record<string, unknown> | null;
  upcomingEventCount?: number;
}

export interface CattleListItem {
  id: string;
  tagNumber: string;
  name: string | null;
  gender: string | null;
  herdStatus: string | null;
  shedId: string | null;
  shedName: string | null;
  productionStatus: string | null;
  healthStatus: string | null;
  animalCategory: string | null;
  reproductiveStatus: string | null;
  dateOfBirth: string | null;
  breedName: string | null;
  aqrScore: number | null;
  lastWeightKg: number | null;
  lactationStage: string | null;
  nextEvent: CattleNextEvent | null;
  updatedAt: string | null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseNextEvent(value: unknown): CattleNextEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const ev = value as Record<string, unknown>;
  const kind = text(ev.kind) ?? 'TASK';
  const labelParams = typeof ev.labelParams === 'object' && ev.labelParams !== null ? (ev.labelParams as Record<string, unknown>) : null;
  const rawTitle = text(ev.title) ?? (labelParams ? text(labelParams.title) : null);
  const upcomingCount = num(ev.upcomingEventCount) ?? num(ev.upcoming_event_count);
  return {
    kind,
    title: rawTitle,
    urgency: text(ev.urgency),
    actionable: ev.actionable !== false,
    daysUntil: num(ev.daysUntil),
    dueAt: text(ev.dueAt),
    labelKey: text(ev.labelKey),
    labelParams,
    ...(upcomingCount !== null ? { upcomingEventCount: upcomingCount } : {}),
  };
}

/** One cached row to a list item; null when the row has no id (never shown, never a crash). */
export function toCattleItem(row: Record<string, unknown>): CattleListItem | null {
  const id = text(row.id);
  if (!id) return null;
  const nextEvent = parseNextEvent(row.nextEvent ?? row.next_event);
  if (nextEvent && nextEvent.upcomingEventCount === undefined) {
    const topCount = num(row.upcoming_event_count) ?? num(row.upcomingEventCount);
    if (topCount !== null) {
      nextEvent.upcomingEventCount = topCount;
    }
  }
  return {
    id,
    tagNumber: text(row.tagNumber) ?? '',
    name: text(row.name),
    gender: text(row.gender),
    herdStatus: text(row.herdStatus),
    shedId: text(row.shedId),
    shedName: text(row.shedName),
    productionStatus: text(row.productionStatus),
    healthStatus: text(row.healthStatus),
    animalCategory: text(row.animalCategory),
    reproductiveStatus: text(row.reproductiveStatus),
    dateOfBirth: text(row.dateOfBirth),
    breedName: text(row.breedName),
    aqrScore: num(row.aqrScore),
    lastWeightKg: num(row.lastWeightKg),
    lactationStage: text(row.lactationStage),
    nextEvent,
    updatedAt: text(row.updatedAt),
  };
}

export function toCattleItems(rows: readonly Record<string, unknown>[]): CattleListItem[] {
  const items: CattleListItem[] = [];
  for (const row of rows) {
    const item = toCattleItem(row);
    if (item) items.push(item);
  }
  return items;
}

/** The badge: a known label key, or a raw server word shown as is (humanized). */
export type BadgeSpec = ({ herdState: HerdState } | { tone: StatusTone }) & { labelKey: MessageKey | null; raw: string | null };

const HERD_EXIT: Record<string, MessageKey> = {
  SOLD: 'cattle.status.sold',
  CULLED: 'cattle.status.culled',
  DECEASED: 'cattle.status.deceased',
};

/**
 * One status per animal for the list. Priority: left the herd, then sick (needs action), then milking / dry, then
 * pregnant / bred, then "healthy" as a quiet fallback. The detail screen shows every dimension separately.
 */
export function primaryBadge(item: Pick<CattleListItem, 'herdStatus' | 'healthStatus' | 'productionStatus' | 'reproductiveStatus'>): BadgeSpec {
  const exit = item.herdStatus && item.herdStatus !== 'ACTIVE' ? item.herdStatus : null;
  if (exit) {
    const key = HERD_EXIT[exit];
    return { tone: 'neutral', labelKey: key ?? null, raw: key ? null : exit };
  }
  if (item.healthStatus === 'SICK') return { herdState: 'sick', labelKey: 'cattle.status.sick', raw: null };
  if (item.healthStatus === 'IN_TREATMENT') return { tone: 'warning', labelKey: 'cattle.status.inTreatment', raw: null };
  if (item.productionStatus === 'MILKING') return { herdState: 'milking', labelKey: 'cattle.status.milking', raw: null };
  if (item.productionStatus === 'DRY') return { herdState: 'dry', labelKey: 'cattle.status.dry', raw: null };
  if (item.reproductiveStatus === 'PREGNANT') return { herdState: 'pregnant', labelKey: 'cattle.status.pregnant', raw: null };
  if (item.reproductiveStatus === 'BRED_AWAITING_CONFIRMATION') {
    return { herdState: 'insemination', labelKey: 'cattle.status.bred', raw: null };
  }
  return { tone: 'success', labelKey: 'cattle.status.healthy', raw: null };
}

/** Single-dimension badges for the detail screen (each dimension has its own row); null = nothing to show. */
export function productionBadge(status: string | null): BadgeSpec | null {
  if (status === 'MILKING') return { herdState: 'milking', labelKey: 'cattle.status.milking', raw: null };
  if (status === 'DRY') return { herdState: 'dry', labelKey: 'cattle.status.dry', raw: null };
  return status ? { tone: 'neutral', labelKey: null, raw: status } : null;
}

export function healthBadge(status: string | null): BadgeSpec | null {
  if (status === 'HEALTHY') return { tone: 'success', labelKey: 'cattle.status.healthy', raw: null };
  if (status === 'SICK') return { herdState: 'sick', labelKey: 'cattle.status.sick', raw: null };
  if (status === 'IN_TREATMENT') return { tone: 'warning', labelKey: 'cattle.status.inTreatment', raw: null };
  return status ? { tone: 'neutral', labelKey: null, raw: status } : null;
}

export function reproBadge(status: string | null): BadgeSpec | null {
  if (status === 'PREGNANT') return { herdState: 'pregnant', labelKey: 'cattle.repro.pregnant', raw: null };
  if (status === 'BRED_AWAITING_CONFIRMATION') return { herdState: 'insemination', labelKey: 'cattle.repro.bred', raw: null };
  if (status === 'OPEN') return { tone: 'warning', labelKey: 'cattle.repro.open', raw: null };
  if (status === 'POSTPARTUM_WAITING') return { tone: 'info', labelKey: 'cattle.repro.postpartum', raw: null };
  if (status === 'NOT_ELIGIBLE') return { tone: 'neutral', labelKey: 'cattle.repro.notEligible', raw: null };
  return status ? { tone: 'neutral', labelKey: null, raw: status } : null;
}

export function lactationBadge(stage: string | null): BadgeSpec | null {
  if (stage === 'FRESH') return { herdState: 'fresh', labelKey: 'cattle.lactation.fresh', raw: null };
  if (stage === 'EARLY') return { tone: 'success', labelKey: 'cattle.lactation.early', raw: null };
  if (stage === 'MID') return { tone: 'info', labelKey: 'cattle.lactation.mid', raw: null };
  if (stage === 'LATE') return { tone: 'warning', labelKey: 'cattle.lactation.late', raw: null };
  if (stage === 'DRY_PERIOD') return { herdState: 'dry', labelKey: 'cattle.lactation.dryPeriod', raw: null };
  return stage ? { tone: 'neutral', labelKey: null, raw: stage } : null;
}

export interface CattleHighlightsData {
  totalActive: number;
  avgHerdAqr: number | null;
  breedingReadyCount: number;
  milkingCount: number;
}

export function computeCattleHighlights(items: readonly CattleListItem[]): CattleHighlightsData {
  const active = items.filter((c) => c.herdStatus === 'ACTIVE' || !c.herdStatus);
  const totalActive = active.length;

  const scored = items.filter((c) => c.aqrScore !== null && c.aqrScore !== undefined);
  const avgHerdAqr =
    scored.length > 0
      ? Math.round((scored.reduce((sum, c) => sum + (c.aqrScore ?? 0), 0) / scored.length) * 10) / 10
      : null;

  const breedingReadyCount = items.filter(
    (c) =>
      c.gender === 'FEMALE' &&
      (c.reproductiveStatus === 'OPEN' || c.reproductiveStatus === 'POSTPARTUM_WAITING'),
  ).length;

  const milkingCount = items.filter((c) => c.productionStatus === 'MILKING').length;

  return {
    totalActive,
    avgHerdAqr,
    breedingReadyCount,
    milkingCount,
  };
}

export const CATTLE_CATEGORY_CHIP_KEYS = [
  'ALL',
  'COW',
  'HEIFER',
  'CALF',
  'WEANED',
  'MALE',
  'FEMALE',
  'PREGNANT',
  'MILKING',
  'DRY',
  'FRESH',
  'OPEN',
  'SICK',
] as const;

export type CattleCategoryChipKey = (typeof CATTLE_CATEGORY_CHIP_KEYS)[number];

export function matchesCategoryChip(item: CattleListItem, key: CattleCategoryChipKey): boolean {
  switch (key) {
    case 'ALL':
      return true;
    case 'COW':
      return item.animalCategory === 'COW';
    case 'HEIFER':
      return item.animalCategory === 'HEIFER';
    case 'CALF':
      return item.animalCategory === 'CALF';
    case 'WEANED':
      return item.animalCategory === 'WEANED';
    case 'MALE':
      return item.gender === 'MALE' || item.gender === 'CASTRATED_MALE';
    case 'FEMALE':
      return item.gender === 'FEMALE';
    case 'PREGNANT':
      return item.reproductiveStatus === 'PREGNANT';
    case 'MILKING':
      return item.productionStatus === 'MILKING';
    case 'DRY':
      return item.productionStatus === 'DRY';
    case 'FRESH':
      return item.lactationStage === 'FRESH';
    case 'OPEN':
      return item.reproductiveStatus === 'OPEN';
    case 'SICK':
      return item.healthStatus === 'SICK' || item.healthStatus === 'IN_TREATMENT' || item.healthStatus === 'QUARANTINE';
    default:
      return true;
  }
}

export function computeCategoryCounts(items: readonly CattleListItem[]): Record<CattleCategoryChipKey, number> {
  const counts = {
    ALL: 0,
    COW: 0,
    HEIFER: 0,
    CALF: 0,
    WEANED: 0,
    MALE: 0,
    FEMALE: 0,
    PREGNANT: 0,
    MILKING: 0,
    DRY: 0,
    FRESH: 0,
    OPEN: 0,
    SICK: 0,
  };
  for (const item of items) {
    for (const k of CATTLE_CATEGORY_CHIP_KEYS) {
      if (matchesCategoryChip(item, k)) {
        counts[k] += 1;
      }
    }
  }
  return counts;
}

const CATEGORY_KEYS: Record<string, MessageKey> = {
  CALF: 'cattle.category.calf',
  HEIFER: 'cattle.category.heifer',
  COW: 'cattle.category.cow',
  BULL: 'cattle.category.bull',
  STEER: 'cattle.category.steer',
};

export function categoryKey(category: string | null): MessageKey | null {
  return category ? (CATEGORY_KEYS[category] ?? null) : null;
}

const GENDER_KEYS: Record<string, MessageKey> = {
  FEMALE: 'cattle.gender.female',
  MALE: 'cattle.gender.male',
  CASTRATED_MALE: 'cattle.gender.castrated',
};

export function genderKey(gender: string | null): MessageKey | null {
  return gender ? (GENDER_KEYS[gender] ?? null) : null;
}

/** "SOME_NEW_VALUE" to "Some new value": shown only for a server word the app has no translation for yet. */
export function humanize(raw: string): string {
  const spaced = raw.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Title line: the tag is the farmer's handle on an animal; the name (if any) follows it. */
export function cattleTitle(item: Pick<CattleListItem, 'tagNumber' | 'name'>): string {
  if (item.tagNumber && item.name) return `${item.tagNumber} · ${item.name}`;
  return item.tagNumber || item.name || '';
}

/** Whole months between a date of birth and `now`; null for a missing or future date. */
export function ageInMonths(dateOfBirth: string | null, now: number): number | null {
  if (!dateOfBirth) return null;
  const born = Date.parse(dateOfBirth);
  if (!Number.isFinite(born) || born > now) return null;
  const a = new Date(born);
  const b = new Date(now);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/** "last updated" is stale after this long without a successful sync (the pull runs on every foreground and reconnect). */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function isStale(lastSyncedAt: number | null, now: number): boolean {
  return lastSyncedAt === null || now - lastSyncedAt > STALE_AFTER_MS;
}

export function eventKindMessageKey(kind: string): MessageKey | null {
  switch (kind) {
    case 'CALVING':
      return 'cattle.upcoming.calving';
    case 'PREGNANCY_CHECK':
      return 'cattle.upcoming.pregnancyCheck';
    case 'DRY_OFF':
      return 'cattle.upcoming.dryOff';
    case 'HEALTH_STEP':
      return 'cattle.upcoming.healthStep';
    case 'PREVENTIVE_STEP':
      return 'cattle.upcoming.preventiveStep';
    case 'VACCINATION':
      return 'cattle.upcoming.vaccination';
    case 'DEWORMING':
      return 'cattle.upcoming.deworming';
    case 'WITHDRAWAL_END':
      return 'cattle.upcoming.withdrawalEnd';
    case 'WEANING':
      return 'cattle.upcoming.weaning';
    case 'TASK':
      return 'cattle.upcoming.task';
    default:
      return null;
  }
}

export function formatNextEventTitle(
  ev: CattleNextEvent,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  if (ev.title?.trim()) {
    return ev.title.trim();
  }
  const key = eventKindMessageKey(ev.kind);
  return key ? t(key) : humanize(ev.kind);
}

export function formatNextEventDue(
  daysUntil: number | null | undefined,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
  formatNumber: (n: number) => string,
): { text: string; urgency: 'destructive' | 'warning' | 'info' | 'muted' } | null {
  if (daysUntil === null || daysUntil === undefined) return null;
  if (daysUntil < 0) {
    return {
      text: t('cattle.upcoming.overdueDays', { count: formatNumber(-daysUntil) }),
      urgency: 'destructive',
    };
  }
  if (daysUntil === 0) {
    return {
      text: t('cattle.upcoming.today'),
      urgency: 'warning',
    };
  }
  if (daysUntil === 1) {
    return {
      text: t('cattle.upcoming.tomorrow'),
      urgency: 'warning',
    };
  }
  return {
    text: t('cattle.upcoming.inDays', { count: formatNumber(daysUntil) }),
    urgency: 'info',
  };
}

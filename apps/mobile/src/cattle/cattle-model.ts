/**
 * Cattle list model (WP9). Pure: node --test imports this file (no React, no React Native).
 *
 * Turns a cached row (what `readCache('cattle')` returns, see `buildPullSpecs` in offline/pull.ts) into a typed
 * `CattleListItem`, and decides which ONE status the list badge shows. The server sends enum strings; an unknown
 * value is kept as text (shown humanized) so a new server status never hides an animal or crashes a screen.
 */
import type { MessageKey } from '../i18n/messages.ts';
import type { HerdState, StatusTone } from '../components/display/status-style.ts';

export interface CattleListItem {
  id: string;
  tagNumber: string;
  name: string | null;
  gender: string | null;
  herdStatus: string | null;
  shedId: string | null;
  productionStatus: string | null;
  healthStatus: string | null;
  animalCategory: string | null;
  reproductiveStatus: string | null;
  dateOfBirth: string | null;
  breedName: string | null;
  updatedAt: string | null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** One cached row to a list item; null when the row has no id (never shown, never a crash). */
export function toCattleItem(row: Record<string, unknown>): CattleListItem | null {
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    tagNumber: text(row.tagNumber) ?? '',
    name: text(row.name),
    gender: text(row.gender),
    herdStatus: text(row.herdStatus),
    shedId: text(row.shedId),
    productionStatus: text(row.productionStatus),
    healthStatus: text(row.healthStatus),
    animalCategory: text(row.animalCategory),
    reproductiveStatus: text(row.reproductiveStatus),
    dateOfBirth: text(row.dateOfBirth),
    breedName: text(row.breedName),
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
  if (status === 'OPEN') return { tone: 'neutral', labelKey: 'cattle.repro.open', raw: null };
  if (status === 'POSTPARTUM_WAITING') return { tone: 'neutral', labelKey: 'cattle.repro.postpartum', raw: null };
  if (status === 'NOT_ELIGIBLE') return { tone: 'neutral', labelKey: 'cattle.repro.notEligible', raw: null };
  return status ? { tone: 'neutral', labelKey: null, raw: status } : null;
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

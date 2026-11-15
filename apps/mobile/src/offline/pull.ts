import type { SqlDb } from './sql-db.ts';

export type CacheEntity = 'cattle' | 'sheds' | 'milkTanks' | 'tasks';

export interface ProjectedRow {
  id: string;
  /** Lower-case text the local search matches against. */
  search: string;
  data: Record<string, unknown>;
}

export interface PullSpec {
  entity: CacheEntity;
  path: string;
  query?: Record<string, string | number | boolean>;
  /** Cursor pagination (`meta.hasNextPage` / `meta.endCursor`); false for routes that return everything. */
  paged: boolean;
  /** Keep only what the offline screens read. Return null to skip a malformed or removed row. */
  project(row: Record<string, unknown>): ProjectedRow | null;
}

/** The part of `ApiClient` the pull needs, so tests can pass a fake. */
export interface ApiGetter {
  get<T>(path: string, options?: { query?: Record<string, string | number | boolean | null | undefined> }): Promise<{
    data: T;
    meta?: Record<string, unknown>;
  }>;
}

const PAGE_LIMIT = 100;
/** A farm with more than this many pages (10 000 rows) of one entity is not a v1 case; fail loudly instead of looping. */
const MAX_PAGES = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
export const TASK_WINDOW_DAYS = 30;

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function lower(...parts: unknown[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string')
    .join(' ')
    .toLowerCase();
}
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** The working set cached for offline reading (ADR-006 section 7). Tasks use a window of +-30 days around `now`. */
export function buildPullSpecs(now: number): PullSpec[] {
  return [
    {
      entity: 'sheds',
      path: '/sheds',
      paged: false,
      project(row) {
        const id = str(row.id);
        if (!id || row.deletedAt) return null;
        return {
          id,
          search: lower(row.name, row.code),
          data: { id, name: row.name ?? null, code: row.code ?? null, purpose: row.purpose ?? null, capacity: num(row.capacity) },
        };
      },
    },
    {
      entity: 'milkTanks',
      path: '/inventory/milk-tanks',
      paged: false,
      project(row) {
        const id = str(row.id);
        if (!id || row.deletedAt) return null;
        return {
          id,
          search: lower(row.name),
          data: {
            id,
            name: row.name ?? null,
            tankType: row.tankType ?? null,
            totalCapacityL: num(row.totalCapacityL),
            currentVolumeL: num(row.currentVolumeL),
            isPrimary: row.isPrimary === true,
          },
        };
      },
    },
    {
      entity: 'cattle',
      path: '/cattle',
      query: { limit: PAGE_LIMIT, sortOrder: 'asc', includeDeleted: false },
      paged: true,
      project(row) {
        const id = str(row.id);
        if (!id || row.deletedAt) return null;
        return {
          id,
          search: lower(row.tagNumber, row.name),
          data: {
            id,
            tagNumber: row.tagNumber ?? null,
            name: row.name ?? null,
            gender: row.gender ?? null,
            herdStatus: row.herdStatus ?? null,
            shedId: row.shedId ?? null,
            productionStatus: row.productionStatus ?? null,
            healthStatus: row.healthStatus ?? null,
            animalCategory: row.animalCategory ?? null,
            reproductiveStatus: row.reproductiveStatus ?? null,
            dateOfBirth: row.dateOfBirth ?? null,
            breedName: str(record(row.breed)?.name),
            updatedAt: row.updatedAt ?? null,
          },
        };
      },
    },
    {
      entity: 'tasks',
      path: '/tasks',
      query: {
        limit: PAGE_LIMIT,
        dueFrom: new Date(now - TASK_WINDOW_DAYS * DAY_MS).toISOString(),
        dueTo: new Date(now + TASK_WINDOW_DAYS * DAY_MS).toISOString(),
      },
      paged: true,
      project(row) {
        const id = str(row.id);
        if (!id) return null;
        return {
          id,
          search: lower(row.name, row.reference),
          data: {
            id,
            reference: row.reference ?? null,
            name: row.name ?? null,
            category: row.category ?? null,
            priority: row.priority ?? null,
            status: row.status ?? null,
            dueAt: row.dueAt ?? null,
            assignedToId: row.assignedToId ?? null,
            relatedCattleId: row.relatedCattleId ?? null,
            completedAt: row.completedAt ?? null,
            recurring: row.recurring === true,
          },
        };
      },
    },
  ];
}

/**
 * Fetch every page of one entity, then replace the farm's cached rows for it inside one transaction. A failure at any
 * page (network, parse) throws before the transaction starts, so the previous cache is kept whole: never a partial wipe.
 * Rows missing from the answer disappear from the cache, which is how a deletion on the server reaches the device.
 */
export async function pullEntity(api: ApiGetter, db: SqlDb, farmId: string, spec: PullSpec, now: number): Promise<number> {
  const rows: ProjectedRow[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const res = await api.get<unknown>(spec.path, { query: { ...spec.query, ...(cursor ? { cursor } : {}) } });
    if (!Array.isArray(res.data)) throw new Error(`Unexpected ${spec.entity} response`);
    for (const item of res.data as unknown[]) {
      const rec = record(item);
      const projected = rec ? spec.project(rec) : null;
      if (projected) rows.push(projected);
    }
    const hasNext = spec.paged && res.meta?.hasNextPage === true;
    cursor = hasNext ? (str(res.meta?.endCursor) ?? undefined) : undefined;
    pages += 1;
    if (cursor && pages >= MAX_PAGES) throw new Error(`Too many pages of ${spec.entity}`);
  } while (cursor);

  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM cache_rows WHERE farm_id = ? AND entity = ?', [farmId, spec.entity]);
    for (const row of rows) {
      await tx.run(
        'INSERT OR REPLACE INTO cache_rows (farm_id, entity, id, search, data) VALUES (?, ?, ?, ?, ?)',
        [farmId, spec.entity, row.id, row.search, JSON.stringify(row.data)],
      );
    }
    await tx.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [
      pulledAtKey(farmId, spec.entity),
      String(now),
    ]);
  });
  return rows.length;
}

export function pulledAtKey(farmId: string, entity: CacheEntity): string {
  return `pulled_at:${farmId}:${entity}`;
}

/** Newest successful pull time for a farm, or null when nothing was ever pulled. */
export async function lastPulledAt(db: SqlDb, farmId: string): Promise<number | null> {
  const rows = await db.all<{ value: string }>('SELECT value FROM meta WHERE key LIKE ?', [`pulled_at:${farmId}:%`]);
  const times = rows.map((r) => Number(r.value)).filter((n) => Number.isFinite(n));
  return times.length ? Math.max(...times) : null;
}

/** Read cached rows for an offline screen. `search` matches the lower-cased search text (tag number, name). */
export async function readCache(
  db: SqlDb,
  farmId: string,
  entity: CacheEntity,
  options: { search?: string; limit?: number } = {},
): Promise<Record<string, unknown>[]> {
  const needle = options.search?.trim().toLowerCase();
  const rows = needle
    ? await db.all<{ data: string }>(
        "SELECT data FROM cache_rows WHERE farm_id = ? AND entity = ? AND search LIKE ? ESCAPE '\\' ORDER BY search LIMIT ?",
        [farmId, entity, `%${needle.replace(/[\\%_]/g, (c) => `\\${c}`)}%`, options.limit ?? 500],
      )
    : await db.all<{ data: string }>('SELECT data FROM cache_rows WHERE farm_id = ? AND entity = ? ORDER BY search LIMIT ?', [
        farmId,
        entity,
        options.limit ?? 500,
      ]);
  return rows.map((r) => JSON.parse(r.data) as Record<string, unknown>);
}

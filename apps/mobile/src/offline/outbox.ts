import type { SqlDb } from './sql-db.ts';

export type OutboxStatus = 'pending' | 'sending' | 'failed' | 'conflict' | 'done';
export type OutboxMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** More open rows than this and a new queued write is refused with a clear message (ADR-006, open point 3). */
export const OUTBOX_CAP = 500;
/** Finished rows stay this long so the UI can show "saved", then are deleted. */
export const DONE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export const DEPENDS_ON_FAILED = 'depends on a failed entry';

export interface OutboxRow {
  /** Local order of creation; defines send order (never the device clock). */
  seq: number;
  /** UUID, doubles as the `Idempotency-Key` on every attempt. */
  localId: string;
  farmId: string;
  userId: string;
  /** Stable route name, e.g. `milk.saveLog` (matches the server's idempotency scope). */
  endpoint: string;
  method: OutboxMethod;
  path: string;
  body: unknown;
  dependsOn: string | null;
  status: OutboxStatus;
  /** Device clock, for display only. */
  queuedAt: number;
  attempts: number;
  nextAttemptAt: number | null;
  lastError: string | null;
  /** Server version(s) that were not overwritten, when `status` is `conflict`. */
  conflict: unknown;
  /** The server's answer once done (or the partial answer of a conflicted write). */
  result: unknown;
  doneAt: number | null;
}

export interface EnqueueInput {
  farmId: string;
  userId: string;
  endpoint: string;
  method: OutboxMethod;
  path: string;
  body?: unknown;
  /** `localId` of a row that must be done first (milk submit after its save). */
  dependsOn?: string | null;
}

export interface OutboxCounts {
  /** Pending or being sent. */
  waiting: number;
  failed: number;
  conflict: number;
}

export type NextSend = { row: OutboxRow; waitMs: 0 } | { row: null; waitMs: number | null };

export class OutboxFullError extends Error {
  readonly cap: number;
  constructor(cap: number) {
    super(`The offline queue is full (${cap} entries). Connect to send them before adding more.`);
    this.name = 'OutboxFullError';
    this.cap = cap;
  }
}

interface RawRow {
  seq: number;
  local_id: string;
  farm_id: string;
  user_id: string;
  endpoint: string;
  method: string;
  path: string;
  body: string;
  depends_on: string | null;
  status: string;
  queued_at: number;
  attempts: number;
  next_attempt_at: number | null;
  last_error: string | null;
  conflict: string | null;
  result: string | null;
  done_at: number | null;
}

function parseJson(text: string | null): unknown {
  if (text === null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function toRow(r: RawRow): OutboxRow {
  return {
    seq: r.seq,
    localId: r.local_id,
    farmId: r.farm_id,
    userId: r.user_id,
    endpoint: r.endpoint,
    method: r.method as OutboxMethod,
    path: r.path,
    body: parseJson(r.body),
    dependsOn: r.depends_on,
    status: r.status as OutboxStatus,
    queuedAt: r.queued_at,
    attempts: r.attempts,
    nextAttemptAt: r.next_attempt_at,
    lastError: r.last_error,
    conflict: parseJson(r.conflict),
    result: parseJson(r.result),
    doneAt: r.done_at,
  };
}

export interface OutboxOptions {
  newId: () => string;
  now?: () => number;
}

/**
 * The durable write queue (ADR-006 sections 3 to 5). Every transition is one SQL statement or one transaction, so a
 * kill or reboot at any point leaves each row in exactly one state. `sending` rows found at start-up are put back to
 * `pending`: the retry carries the same key, so the server answers it as a replay if the first attempt got through.
 */
export function createOutbox(db: SqlDb, options: OutboxOptions) {
  const now = options.now ?? Date.now;

  async function get(localId: string): Promise<OutboxRow | null> {
    const raw = await db.get<RawRow>('SELECT * FROM outbox WHERE local_id = ?', [localId]);
    return raw ? toRow(raw) : null;
  }

  async function enqueue(input: EnqueueInput): Promise<OutboxRow> {
    const localId = options.newId();
    await db.transaction(async (tx) => {
      const open = await tx.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM outbox WHERE status IN ('pending', 'sending', 'failed', 'conflict')",
      );
      if ((open?.n ?? 0) >= OUTBOX_CAP) throw new OutboxFullError(OUTBOX_CAP);
      await tx.run(
        `INSERT INTO outbox (local_id, farm_id, user_id, endpoint, method, path, body, depends_on, status, queued_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          localId,
          input.farmId,
          input.userId,
          input.endpoint,
          input.method,
          input.path,
          JSON.stringify(input.body ?? null),
          input.dependsOn ?? null,
          now(),
        ],
      );
    });
    return (await get(localId))!;
  }

  /** Mark failed, and every row waiting on it. Failed rows are never dropped silently. */
  async function fail(localId: string, message: string): Promise<void> {
    await db.run(
      "UPDATE outbox SET status = 'failed', last_error = ?, next_attempt_at = NULL WHERE local_id = ? AND status IN ('pending', 'sending')",
      [message, localId],
    );
    const children = await db.all<{ local_id: string }>(
      "SELECT local_id FROM outbox WHERE depends_on = ? AND status IN ('pending', 'sending')",
      [localId],
    );
    for (const child of children) await fail(child.local_id, DEPENDS_ON_FAILED);
  }

  /**
   * The next row this user may send, in strict `seq` order. A row waiting out a backoff holds everything behind it
   * (`waitMs`), because order matters; a row whose parent is in conflict is skipped (it waits for the user), and a row
   * whose parent failed or was discarded fails with it.
   */
  async function nextForSending(scope: { userId: string; farmId: string; now: number }): Promise<NextSend> {
    const rows = await db.all<RawRow>(
      "SELECT * FROM outbox WHERE status = 'pending' AND user_id = ? AND farm_id = ? ORDER BY seq",
      [scope.userId, scope.farmId],
    );
    for (const raw of rows) {
      if (raw.depends_on) {
        const parent = await db.get<{ status: string }>('SELECT status FROM outbox WHERE local_id = ?', [raw.depends_on]);
        if (!parent || parent.status === 'failed') {
          await fail(raw.local_id, DEPENDS_ON_FAILED);
          continue;
        }
        if (parent.status !== 'done') continue;
      }
      if (raw.next_attempt_at !== null && raw.next_attempt_at > scope.now) {
        return { row: null, waitMs: raw.next_attempt_at - scope.now };
      }
      return { row: toRow(raw), waitMs: 0 };
    }
    return { row: null, waitMs: null };
  }

  return {
    enqueue,
    get,
    fail,
    nextForSending,

    async list(scope: { userId: string; statuses?: readonly OutboxStatus[] }): Promise<OutboxRow[]> {
      const statuses = scope.statuses ?? ['pending', 'sending', 'failed', 'conflict', 'done'];
      const marks = statuses.map(() => '?').join(', ');
      const rows = await db.all<RawRow>(
        `SELECT * FROM outbox WHERE user_id = ? AND status IN (${marks}) ORDER BY seq`,
        [scope.userId, ...statuses],
      );
      return rows.map(toRow);
    },

    async counts(scope: { userId: string }): Promise<OutboxCounts> {
      const rows = await db.all<{ status: string; n: number }>(
        'SELECT status, COUNT(*) AS n FROM outbox WHERE user_id = ? GROUP BY status',
        [scope.userId],
      );
      const by = new Map(rows.map((r) => [r.status, r.n]));
      return {
        waiting: (by.get('pending') ?? 0) + (by.get('sending') ?? 0),
        failed: by.get('failed') ?? 0,
        conflict: by.get('conflict') ?? 0,
      };
    },

    /** pending -> sending, attempts + 1. False when the row is no longer pending (discarded meanwhile). */
    async beginSending(localId: string): Promise<boolean> {
      const { changes } = await db.run(
        "UPDATE outbox SET status = 'sending', attempts = attempts + 1 WHERE local_id = ? AND status = 'pending'",
        [localId],
      );
      return changes > 0;
    },

    async complete(localId: string, result: unknown): Promise<void> {
      await db.run(
        "UPDATE outbox SET status = 'done', done_at = ?, result = ?, last_error = NULL, next_attempt_at = NULL, conflict = NULL WHERE local_id = ?",
        [now(), JSON.stringify(result ?? null), localId],
      );
    },

    /** Back to pending, to be tried again at `nextAttemptAt` (null = as soon as the loop runs). */
    async retryLater(localId: string, error: string, nextAttemptAt: number | null): Promise<void> {
      await db.run(
        "UPDATE outbox SET status = 'pending', last_error = ?, next_attempt_at = ? WHERE local_id = ?",
        [error, nextAttemptAt, localId],
      );
    },

    /** The server kept a newer version of some entries: needs the user (ADR-006 section 6). */
    async markConflict(localId: string, conflict: unknown, result: unknown): Promise<void> {
      await db.run(
        "UPDATE outbox SET status = 'conflict', conflict = ?, result = ?, last_error = NULL, next_attempt_at = NULL WHERE local_id = ?",
        [JSON.stringify(conflict ?? null), JSON.stringify(result ?? null), localId],
      );
    },

    /** The user chose to keep the server's version: the row counts as done, so rows waiting on it can go. */
    async resolveConflict(localId: string, resolution: string): Promise<boolean> {
      const { changes } = await db.run(
        "UPDATE outbox SET status = 'done', done_at = ?, result = ?, conflict = NULL WHERE local_id = ? AND status = 'conflict'",
        [now(), JSON.stringify({ resolved: resolution }), localId],
      );
      return changes > 0;
    },

    /**
     * The user chose "Use mine": creates a new outbox row with newLocalId, baseUpdatedAt set to the server
     * version from the conflict, resolves the old row as done ('used-mine'), and repoints dependent rows.
     */
    async resolveUseMine(localId: string, newLocalId: string): Promise<OutboxRow | null> {
      const row = await get(localId);
      if (!row || row.status !== 'conflict') return null;

      let newBody: unknown = row.body;
      if (row.endpoint === 'milk.saveLog' && row.body && Array.isArray(row.conflict)) {
        const parsedBody = JSON.parse(JSON.stringify(row.body)) as {
          date: string;
          session: string;
          entries: Array<{
            cattleId: string;
            yieldL: number;
            anomalyNote?: string;
            tankId?: string | null;
            baseUpdatedAt?: string | null;
          }>;
        };
        const conflicts = row.conflict as Array<{
          cattleId: string;
          server?: { updatedAt?: string };
        }>;
        const serverVersionByCow = new Map(
          conflicts
            .filter((c) => c.cattleId && c.server?.updatedAt)
            .map((c) => [c.cattleId, c.server!.updatedAt!]),
        );
        parsedBody.entries = (parsedBody.entries || []).map((entry) => {
          const serverUpdated = serverVersionByCow.get(entry.cattleId);
          if (serverUpdated) {
            return { ...entry, baseUpdatedAt: serverUpdated };
          }
          return entry;
        });
        newBody = parsedBody;
      }

      let created: OutboxRow | null = null;
      await db.transaction(async (tx) => {
        await tx.run(
          "UPDATE outbox SET status = 'done', done_at = ?, result = ?, conflict = NULL WHERE local_id = ?",
          [now(), JSON.stringify({ resolved: 'used-mine', replacedBy: newLocalId }), localId],
        );

        await tx.run(
          'UPDATE outbox SET depends_on = ? WHERE depends_on = ?',
          [newLocalId, localId],
        );

        await tx.run(
          'INSERT INTO outbox (local_id, farm_id, user_id, endpoint, method, path, body, depends_on, status, queued_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            newLocalId,
            row.farmId,
            row.userId,
            row.endpoint,
            row.method,
            row.path,
            JSON.stringify(newBody ?? null),
            row.dependsOn,
            'pending',
            now(),
          ],
        );

        const fresh = await tx.get<RawRow>('SELECT * FROM outbox WHERE local_id = ?', [newLocalId]);
        if (fresh) created = toRow(fresh);
      });

      return created;
    },

    /** A failed row, and the rows that failed because of it, go back to pending with a fresh attempt count. */
    async retryNow(localId: string): Promise<boolean> {
      const { changes } = await db.run(
        "UPDATE outbox SET status = 'pending', attempts = 0, next_attempt_at = NULL, last_error = NULL WHERE local_id = ? AND status = 'failed'",
        [localId],
      );
      if (changes === 0) return false;
      const revive = async (parentId: string): Promise<void> => {
        const children = await db.all<{ local_id: string }>(
          "SELECT local_id FROM outbox WHERE depends_on = ? AND status = 'failed' AND last_error = ?",
          [parentId, DEPENDS_ON_FAILED],
        );
        for (const child of children) {
          await db.run(
            "UPDATE outbox SET status = 'pending', attempts = 0, next_attempt_at = NULL, last_error = NULL WHERE local_id = ?",
            [child.local_id],
          );
          await revive(child.local_id);
        }
      };
      await revive(localId);
      return true;
    },

    /** Delete a row the user no longer wants. A row being sent right now cannot be discarded. */
    async discard(localId: string): Promise<boolean> {
      const { changes } = await db.run("DELETE FROM outbox WHERE local_id = ? AND status <> 'sending'", [localId]);
      return changes > 0;
    },

    /** After a kill mid-send: `sending` -> `pending` (same key, so the server answers a replay). */
    async recoverInterrupted(): Promise<number> {
      const { changes } = await db.run("UPDATE outbox SET status = 'pending' WHERE status = 'sending'");
      return changes;
    },

    async purgeDone(): Promise<number> {
      const { changes } = await db.run("DELETE FROM outbox WHERE status = 'done' AND done_at < ?", [now() - DONE_RETENTION_MS]);
      return changes;
    },
  };
}

export type Outbox = ReturnType<typeof createOutbox>;

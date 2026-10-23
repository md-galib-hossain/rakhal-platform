/**
 * Thin Prisma read layer for the milk metrics. Uses ONLY the `ReportDb` from the context (the
 * snapshot transaction client), never another client. All queries are farm-scoped.
 */
import { MilkSession } from '@prisma/client';
import { dayKey } from '../../../../../common/farm-time/farm-time';
import type { ReportDb } from '../metric-context';
import type { MilkRow } from './milk-aggregation';

const DEFAULT_SESSIONS: MilkSession[] = [
  MilkSession.MORNING,
  MilkSession.EVENING,
];

/** Submitted rows only (decision 7). `from`/`to` are inclusive farm-local dates. */
export async function fetchSubmittedMilkRows(
  db: ReportDb,
  args: {
    farmId: string;
    cattleIds: readonly string[];
    from: string;
    to: string;
  },
): Promise<MilkRow[]> {
  if (args.cattleIds.length === 0) return [];
  const rows = await db.milkLogEntry.findMany({
    where: {
      farmId: args.farmId,
      cattleId: { in: [...args.cattleIds] },
      logDate: { gte: dayKey(args.from), lte: dayKey(args.to) },
      submitted: true,
    },
    select: {
      cattleId: true,
      logDate: true,
      session: true,
      yieldL: true,
      disposition: true,
      submitted: true,
    },
    orderBy: [{ logDate: 'asc' }, { id: 'asc' }],
  });
  return rows;
}

/** Number of unsubmitted drafts in the period (excluded from every figure; surfaced as a flag). */
export async function countUnsubmittedDrafts(
  db: ReportDb,
  args: {
    farmId: string;
    cattleIds: readonly string[];
    from: string;
    to: string;
  },
): Promise<number> {
  if (args.cattleIds.length === 0) return 0;
  return db.milkLogEntry.count({
    where: {
      farmId: args.farmId,
      cattleId: { in: [...args.cattleIds] },
      logDate: { gte: dayKey(args.from), lte: dayKey(args.to) },
      submitted: false,
    },
  });
}

/**
 * The farm's configured collection sessions (stored lowercase). The settings row is created
 * lazily, so a missing row means the schema defaults (morning + evening).
 */
export async function fetchExpectedSessions(
  db: ReportDb,
  farmId: string,
): Promise<MilkSession[]> {
  const s = await db.farmModuleSettings.findUnique({
    where: { farmId },
    select: { milkActiveSessions: true },
  });
  if (!s) return DEFAULT_SESSIONS;
  const valid = new Set<string>(Object.values(MilkSession));
  return s.milkActiveSessions
    .map((x) => x.toUpperCase())
    .filter((x) => valid.has(x)) as MilkSession[];
}

/** Mirrors the backend `ActivityLogModule` Prisma enum (`activity-log.service.ts`). */
export type ActivityModule =
  | "COW_MANAGEMENT"
  | "MILK_PRODUCTION"
  | "HEALTH_SAFETY"
  | "FINANCE"
  | "BREEDING"
  | "INVENTORY"
  | "GENERAL";

/**
 * `GET /activity-log` row, as presented by `ActivityLogService#present`. `actionDetails` is a
 * plain string where the writer wraps the "chip-worthy" tokens in `[brackets]` (e.g.
 * `"New [Heifer] [Shundori] added to [Shed A]."` — the real convention used across every module's
 * `activityLog.record(...)` call, not a frontend invention) — parsed by `parseActionDetails`.
 */
export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  module: ActivityModule;
  moduleLabel: string;
  eventTitle: string;
  actionDetails: string;
  aqrImpact: number | null;
  financialImpact: number | null;
  actor: { id: string | null; name: string };
  actorType: "user" | "system";
  /** `yyyy-MM-dd`, used to group entries under a date divider. */
  dateGroup: string;
  /** `sha256(canonical(fields) + prevHash)` (`activity-log.service.ts#computeHash`) — this entry's
   * link in the farm's hash chain. Every row carries one (`present()` spreads the full Prisma row);
   * not previously typed on the frontend. */
  hash: string;
  /** Set when this event concerns one specific animal (`relatedCattleId` on the write side) — lets
   * the card deep-link to `/animals/:id`. `null` for entries with no single-animal subject. */
  relatedCattleId: string | null;
}

export interface ActivityListFilters {
  module?: ActivityModule;
  from?: string;
  to?: string;
  aqrImpactOnly?: boolean;
  financialImpactOnly?: boolean;
}

/** `GET /activity-log/verify-chain` (`ActivityLogService#verifyChain`) — recomputes the farm's
 * hash chain and reports the first broken link, if any. Read-only integrity check (PRD §19.3:
 * tamper-evident, not just tamper-resistant). */
export interface ChainIntegrityResult {
  valid: boolean;
  entries: number;
  brokenAt: string | null;
}

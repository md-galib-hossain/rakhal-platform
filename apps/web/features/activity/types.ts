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
}

export interface ActivityListFilters {
  module?: ActivityModule;
  from?: string;
  to?: string;
  aqrImpactOnly?: boolean;
  financialImpactOnly?: boolean;
}

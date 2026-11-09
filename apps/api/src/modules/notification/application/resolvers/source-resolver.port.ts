/**
 * Source resolvers (RAKHAL-493, docs/EPIC_NOTIFICATIONS_V2.md §3.3 steps 3-4). The `notification` module imports no
 * domain module: Task / Health / ... implement this port in their own module and register in `onModuleInit` via
 * `SourceResolverRegistry`. The schedule never copies source state; the worker asks the resolver at fire time.
 */
export type ResolverSourceType = 'TASK' | 'HEALTH_STEP';
export type ResolverAnchorType = 'ANIMAL_EVENT' | 'TASK' | 'HEALTH_STEP';

export interface ResolveContext {
  farmId: string;
  sourceKey: string;
  /** Farm IANA timezone. */
  timezone: string;
  now: Date;
  /** The occurrence being fired (for copy: upcoming vs due). */
  leadMinutes: number;
  anchorAt: Date;
}

export type SourceResolution =
  /** The source no longer needs a notice (completed, cancelled, deleted, case closed). -> CANCELLED SOURCE_GONE */
  | { state: 'GONE' }
  /** Every animal in the group left the herd. -> CANCELLED ANIMALS_GONE */
  | { state: 'ANIMALS_GONE' }
  | {
      state: 'OK';
      /** Users the source itself names (task assignee ...); merged with `roles` members, else Owner + Manager. */
      userIds: string[];
      /** Extra role names; default none (audience falls back to Owner + Manager when nobody resolves). */
      roles?: string[];
      /** Catalogue copy params, e.g. `{ label, animals, date, days }`. */
      params: Record<string, string | number>;
      /** English fallback copy if the catalogue key is missing. */
      title: string;
      message: string;
      link?: string;
      data?: Record<string, unknown>;
    };

export interface SourceResolver {
  readonly sourceType: ResolverSourceType;
  /** Fire-time (and `refreshSource`) re-read of the source group. Must be farm-scoped. */
  resolve(ctx: ResolveContext): Promise<SourceResolution>;
}

/** Existence check for the entity a manual BEFORE/AFTER schedule is anchored on (fire-time re-check). */
export interface AnchorChecker {
  readonly anchorType: ResolverAnchorType;
  exists(farmId: string, anchorId: string): Promise<boolean>;
}

import type { ReportScopeKind } from './enums';

/**
 * Which cows a report covers. Discriminated on `kind`.
 * Decision 2 (EPIC_REPORTS section 5): group membership is CURRENT ONLY (no history exists), so a
 * GROUP scope records `membershipAsOf` and the report labels members "as of generation".
 */
export type ReportScope =
  | { kind: Extract<ReportScopeKind, 'SINGLE_COW'>; cattleId: string }
  | {
      kind: Extract<ReportScopeKind, 'GROUP'>;
      groupId: string;
      /** ISO instant the membership was read. Not the period end. */
      membershipAsOf: string;
    }
  | { kind: Extract<ReportScopeKind, 'ALL_ELIGIBLE'> };

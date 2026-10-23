import type { ReportScope } from '../contracts/scope';
import type { AbsentReason, EntrySource } from './cow-presence';

export interface PresentCow {
  id: string;
  entrySource: EntrySource;
}

/** Cows already filtered through presence; `absent` explains why others were dropped. */
export interface ScopeInputCows {
  present: PresentCow[];
  absent?: Record<string, AbsentReason>;
}

export type EmptyReason =
  | 'cow_not_present_in_period'
  | 'cow_not_found'
  | 'group_has_no_present_members'
  | 'no_eligible_cows';

export interface ResolvedScope {
  cattleIds: string[];
  isEmpty: boolean;
  emptyReason: EmptyReason | null;
  /** Detail for cow_not_present_in_period. */
  absentReason: AbsentReason | null;
  /** True when any included cow used createdAt as a proxy for herd entry. */
  usesCreatedAtProxy: boolean;
  /** GROUP only: ISO instant membership was read ("members as of generation"). */
  membershipAsOf: string | null;
  groupMembershipCurrentOnly: boolean;
}

export function resolveScopeCattleIds(
  scope: ReportScope,
  cows: ScopeInputCows,
  groupMemberIds: readonly string[] = [],
): ResolvedScope {
  let chosen: PresentCow[];
  let membershipAsOf: string | null = null;
  let emptyReason: EmptyReason | null = null;
  let absentReason: AbsentReason | null = null;

  switch (scope.kind) {
    case 'SINGLE_COW': {
      chosen = cows.present.filter((c) => c.id === scope.cattleId);
      if (chosen.length === 0) {
        const why = cows.absent?.[scope.cattleId];
        emptyReason = why ? 'cow_not_present_in_period' : 'cow_not_found';
        absentReason = why ?? null;
      }
      break;
    }
    case 'GROUP': {
      const members = new Set(groupMemberIds);
      chosen = cows.present.filter((c) => members.has(c.id));
      membershipAsOf = scope.membershipAsOf;
      if (chosen.length === 0) emptyReason = 'group_has_no_present_members';
      break;
    }
    case 'ALL_ELIGIBLE': {
      chosen = [...cows.present];
      if (chosen.length === 0) emptyReason = 'no_eligible_cows';
      break;
    }
  }
  return {
    cattleIds: Array.from(new Set(chosen.map((c) => c.id))),
    isEmpty: chosen.length === 0,
    emptyReason,
    absentReason,
    usesCreatedAtProxy: chosen.some((c) => c.entrySource === 'createdAt'),
    membershipAsOf,
    groupMembershipCurrentOnly: scope.kind === 'GROUP',
  };
}

import type { ReportScope } from '../contracts/scope';
import type { AbsentReason, EntrySource } from './cow-presence';
export interface PresentCow {
    id: string;
    entrySource: EntrySource;
}
export interface ScopeInputCows {
    present: PresentCow[];
    absent?: Record<string, AbsentReason>;
}
export type EmptyReason = 'cow_not_present_in_period' | 'cow_not_found' | 'group_has_no_present_members' | 'no_eligible_cows';
export interface ResolvedScope {
    cattleIds: string[];
    isEmpty: boolean;
    emptyReason: EmptyReason | null;
    absentReason: AbsentReason | null;
    usesCreatedAtProxy: boolean;
    membershipAsOf: string | null;
    groupMembershipCurrentOnly: boolean;
}
export declare function resolveScopeCattleIds(scope: ReportScope, cows: ScopeInputCows, groupMemberIds?: readonly string[]): ResolvedScope;

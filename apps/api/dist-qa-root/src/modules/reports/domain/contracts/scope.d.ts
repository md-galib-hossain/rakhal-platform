import type { ReportScopeKind } from './enums';
export type ReportScope = {
    kind: Extract<ReportScopeKind, 'SINGLE_COW'>;
    cattleId: string;
} | {
    kind: Extract<ReportScopeKind, 'GROUP'>;
    groupId: string;
    membershipAsOf: string;
} | {
    kind: Extract<ReportScopeKind, 'ALL_ELIGIBLE'>;
};

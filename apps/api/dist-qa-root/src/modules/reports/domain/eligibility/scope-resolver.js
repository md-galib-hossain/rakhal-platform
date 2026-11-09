"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveScopeCattleIds = resolveScopeCattleIds;
function resolveScopeCattleIds(scope, cows, groupMemberIds = []) {
    let chosen;
    let membershipAsOf = null;
    let emptyReason = null;
    let absentReason = null;
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
            if (chosen.length === 0)
                emptyReason = 'group_has_no_present_members';
            break;
        }
        case 'ALL_ELIGIBLE': {
            chosen = [...cows.present];
            if (chosen.length === 0)
                emptyReason = 'no_eligible_cows';
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
//# sourceMappingURL=scope-resolver.js.map
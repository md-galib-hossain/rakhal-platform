"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_RECIPIENTS = exports.DEFAULT_SOURCE_ROLES = void 0;
exports.resolveAudience = resolveAudience;
exports.validateManualAudience = validateManualAudience;
exports.DEFAULT_SOURCE_ROLES = ['Owner', 'Manager'];
exports.MAX_RECIPIENTS = 100;
function membersWithRoles(members, roles) {
    const wanted = new Set(roles);
    return members
        .filter((m) => m.active && m.roles.some((r) => wanted.has(r)))
        .map((m) => m.userId);
}
function resolveAudience(spec, members) {
    const activeIds = new Set(members.filter((m) => m.active).map((m) => m.userId));
    const keepActive = (ids) => ids.filter((id) => activeIds.has(id));
    let result;
    switch (spec.mode) {
        case 'USER':
            result = keepActive(spec.userIds.slice(0, 1));
            break;
        case 'USERS':
            result = keepActive(spec.userIds);
            break;
        case 'ROLES':
            result = membersWithRoles(members, spec.roles);
            break;
        case 'SOURCE':
            result = [
                ...keepActive(spec.sourceUserIds ?? []),
                ...membersWithRoles(members, spec.roles),
            ];
            if (result.length === 0) {
                result = membersWithRoles(members, exports.DEFAULT_SOURCE_ROLES);
            }
            break;
    }
    return [...new Set(result)].sort();
}
function validateManualAudience(spec, actorUserId, canManage) {
    switch (spec.mode) {
        case 'SOURCE':
            return 'AUDIENCE_SOURCE_NOT_ALLOWED';
        case 'USER':
            if (spec.userIds.length !== 1)
                return 'AUDIENCE_USER_REQUIRED';
            if (!canManage && spec.userIds[0] !== actorUserId) {
                return 'AUDIENCE_FORBIDDEN';
            }
            return null;
        case 'USERS':
            if (spec.userIds.length === 0)
                return 'AUDIENCE_USERS_REQUIRED';
            if (spec.userIds.length > exports.MAX_RECIPIENTS)
                return 'AUDIENCE_TOO_MANY';
            return canManage ? null : 'AUDIENCE_FORBIDDEN';
        case 'ROLES':
            if (spec.roles.length === 0)
                return 'AUDIENCE_ROLES_REQUIRED';
            return canManage ? null : 'AUDIENCE_FORBIDDEN';
    }
}
//# sourceMappingURL=audience.js.map
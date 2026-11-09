"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoleGrants = adminRoleGrants;
exports.adminRoleHasPermission = adminRoleHasPermission;
const ADMIN_ROLE_GRANTS = {
    SUPER_ADMIN: ['*'],
    SUPPORT_ADMIN: [
        'feedback.*',
        'user.*',
        'farm.read',
        'audit.read',
        'coupon.read',
        'referral.read',
        'plan.read',
        'system.read',
        'config.read',
        'analytics.read',
        'security.read',
    ],
    BILLING_ADMIN: [
        'coupon.*',
        'referral.*',
        'reconciliation.*',
        'plan.manage',
        'subscription.manage',
        'analytics.read',
        'export.farms',
        'farm.read',
        'plan.read',
        'audit.read',
    ],
    CONTENT_ADMIN: ['audit.read', 'feed-ingredient.*', 'requirement-preset.*'],
};
function matches(grant, required) {
    if (grant === '*')
        return true;
    if (grant === required)
        return true;
    if (grant.endsWith('.*')) {
        return required.startsWith(grant.slice(0, -1));
    }
    return false;
}
function adminRoleGrants(role) {
    return [...(ADMIN_ROLE_GRANTS[role] ?? [])];
}
function adminRoleHasPermission(role, required) {
    const grants = ADMIN_ROLE_GRANTS[role] ?? [];
    return grants.some((grant) => matches(grant, required));
}
//# sourceMappingURL=admin-permission-matrix.js.map
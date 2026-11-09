"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_AUDIT_ACTIONS = void 0;
exports.redactAuditPayload = redactAuditPayload;
exports.ADMIN_AUDIT_ACTIONS = [
    'LOGIN',
    'LOGIN_FAILED',
    'LOGOUT',
    'SESSION_REVOKED',
    'SESSIONS_REVOKED_ALL',
    'SESSION_REUSE_DETECTED',
    'TWO_FACTOR_ENABLED',
    'TWO_FACTOR_RESET',
    'PASSWORD_CHANGED',
    'PASSWORD_RESET',
    'ADMIN_CREATED',
    'ADMIN_UPDATED',
    'ADMIN_ROLE_CHANGED',
    'ADMIN_DEACTIVATED',
    'ADMIN_ACTIVATED',
    'USER_SESSIONS_REVOKED',
    'USER_BLOCKED',
    'USER_UNBLOCKED',
    'USER_PASSWORD_RESET_SENT',
    'FARM_SUSPENDED',
    'FARM_REACTIVATED',
    'QUEUE_JOB_RETRIED',
    'FEATURE_FLAG_CREATED',
    'FEATURE_FLAG_UPDATED',
    'FEATURE_FLAG_DELETED',
    'PLATFORM_SETTING_SET',
    'PLAN_UPDATED',
    'PLAN_FEATURE_SET',
    'SUBSCRIPTION_ACTIVATED',
    'SUBSCRIPTION_COMPED',
    'SUBSCRIPTION_EXTENDED',
    'SUBSCRIPTION_CANCELLED',
    'EXPORT_GENERATED',
    'COUPON_ISSUED',
    'COUPON_DISABLED',
    'RECONCILIATION_RUN',
    'RECONCILIATION_RESOLVED',
    'FEED_INGREDIENT_CREATED',
    'FEED_INGREDIENT_UPDATED',
    'FEED_INGREDIENT_ARCHIVED',
    'FEED_INGREDIENT_RESTORED',
    'REQUIREMENT_PRESET_CREATED',
    'REQUIREMENT_PRESET_UPDATED',
    'REQUIREMENT_PRESET_ACTIVATED',
    'FEEDBACK_UPDATED',
    'COMMUNICATION_SENT',
];
const SENSITIVE_KEY = /pass(word)?|secret|token|hash|totp|otp|authorization/i;
function redactAuditPayload(value, depth = 0) {
    if (depth > 6 || value === null || typeof value !== 'object')
        return value;
    if (value instanceof Date)
        return value;
    if (Array.isArray(value)) {
        return value.map((item) => redactAuditPayload(item, depth + 1));
    }
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
        out[key] = SENSITIVE_KEY.test(key)
            ? '[REDACTED]'
            : redactAuditPayload(inner, depth + 1);
    }
    return out;
}
//# sourceMappingURL=admin-audit-actions.js.map
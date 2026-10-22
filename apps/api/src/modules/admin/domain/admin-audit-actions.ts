/**
 * Every action a platform admin can leave in the audit trail (P2-04). Typed in
 * code, stored as text in `PlatformAdminAuditLog.action`, so adding an action
 * is a code change only — and `AdminAuditService.record` rejects typos at
 * compile time.
 */
export const ADMIN_AUDIT_ACTIONS = [
  // authentication & sessions
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
  // admin lifecycle
  'ADMIN_CREATED',
  'ADMIN_UPDATED',
  'ADMIN_ROLE_CHANGED',
  'ADMIN_DEACTIVATED',
  'ADMIN_ACTIVATED',
  // platform operations
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
] as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

export type AdminAuditOutcome = 'SUCCESS' | 'FAILURE';

const SENSITIVE_KEY = /pass(word)?|secret|token|hash|totp|otp|authorization/i;

/**
 * Recursively masks sensitive keys before anything is persisted or logged, so a
 * careless `before`/`after`/`metadata` payload can never write a credential into
 * the trail. Depth-limited; non-plain values pass through as-is.
 */
export function redactAuditPayload(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditPayload(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key)
      ? '[REDACTED]'
      : redactAuditPayload(inner, depth + 1);
  }
  return out;
}

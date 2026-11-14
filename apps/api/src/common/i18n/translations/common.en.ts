/**
 * Common API error copy (RAKHAL-107). Only the *generic* messages our own
 * guards/filter emit verbatim get a translation entry — custom business
 * messages (`throw new ConflictException('...')` with domain-specific text)
 * are intentionally left as authored English; translating those safely needs
 * a per-call-site key, tracked as follow-up (see TECH_DEBT RD-032).
 */
export const commonEn = {
  unauthorized: 'Unauthorized',
  sessionNotActive: 'Session is not active',
  sessionPermissionsStale: 'Session permissions are stale',
  invalidCredentials: 'Invalid credentials',
  forbiddenResource: 'Forbidden resource',
  rateLimited: 'Too many requests — please slow down and try again shortly',
  notFound: 'Not found',
  internalError: 'An unexpected error occurred',
};

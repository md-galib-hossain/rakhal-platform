// src/config/env/auth.config.ts

import { registerAs } from '@nestjs/config';
import { env } from './env';

export const authConfig = registerAs('auth', () => ({
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,

  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,

  password: {
    argon2MemoryCost: env.ARGON2_MEMORY_COST,
    argon2TimeCost: env.ARGON2_TIME_COST,
    argon2Parallelism: env.ARGON2_PARALLELISM,
  },

  refreshCookie: {
    name: env.AUTH_REFRESH_COOKIE_NAME,
    domain: env.AUTH_REFRESH_COOKIE_DOMAIN,
    path: env.AUTH_REFRESH_COOKIE_PATH,
    sameSite: env.AUTH_REFRESH_COOKIE_SAME_SITE,
    secure: env.AUTH_REFRESH_COOKIE_SECURE ?? env.NODE_ENV === 'production',
    httpOnly: true,
  },

  csrf: {
    cookieName: env.AUTH_CSRF_COOKIE_NAME,
    headerName: env.AUTH_CSRF_HEADER_NAME,
    secret: env.AUTH_CSRF_SECRET,
    cookiePath: env.AUTH_CSRF_COOKIE_PATH,
    cookieSameSite: env.AUTH_CSRF_COOKIE_SAME_SITE,
    cookieSecure: env.AUTH_CSRF_COOKIE_SECURE ?? env.NODE_ENV === 'production',
  },

  rateLimit: {
    ttlSeconds: env.RATE_LIMIT_TTL_SECONDS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    // Aggregate, route-independent ceiling — the `default` throttler below is
    // keyed per handler, so it alone can never cap total API traffic.
    globalMaxRequests: env.RATE_LIMIT_GLOBAL_MAX_REQUESTS,
    login: {
      ttlSeconds: env.AUTH_LOGIN_RATE_LIMIT_TTL_SECONDS,
      maxRequests: env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS,
    },
    refresh: {
      ttlSeconds: env.AUTH_REFRESH_RATE_LIMIT_TTL_SECONDS,
      maxRequests: env.AUTH_REFRESH_RATE_LIMIT_MAX_REQUESTS,
    },
  },

  lockout: {
    maxFailedAttempts: env.AUTH_LOCKOUT_MAX_FAILED_ATTEMPTS,
    windowSeconds: env.AUTH_LOCKOUT_WINDOW_SECONDS,
    durationSeconds: env.AUTH_LOCKOUT_DURATION_SECONDS,
  },
}));

// src/config/env/env.schema.ts

import { z } from 'zod';

const stringBoolean = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  }

  return value;
}, z.boolean());

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.coerce.number().default(5000),

  APP_NAME: z.string().default('rakhal-api'),
  APP_VERSION: z.string().default('1.0.0'),

  API_PREFIX: z.string().default('api/v1'),

  DATABASE_URL: z.string(),

  JWT_ACCESS_SECRET: z.string().min(32),

  JWT_REFRESH_SECRET: z.string().min(32),

  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),

  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  REDIS_HOST: z.string(),

  REDIS_PORT: z.coerce.number(),

  REDIS_USERNAME: z.string().optional(),

  REDIS_PASSWORD: z.string().optional(),

  REDIS_DATABASE: z.coerce.number().int().nonnegative().default(0),

  REDIS_TLS_ENABLED: stringBoolean.default(false),

  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),

  ARGON2_MEMORY_COST: z.coerce.number().int().positive().default(19456),

  ARGON2_TIME_COST: z.coerce.number().int().positive().default(2),

  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),

  AUTH_REFRESH_COOKIE_NAME: z.string().default('rakhal_refresh'),

  AUTH_REFRESH_COOKIE_DOMAIN: z.string().optional(),

  AUTH_REFRESH_COOKIE_PATH: z.string().default('/api/v1/auth'),

  AUTH_REFRESH_COOKIE_SAME_SITE: z
    .enum(['strict', 'lax', 'none'])
    .default('lax'),

  AUTH_REFRESH_COOKIE_SECURE: z.coerce.boolean().optional(),

  AUTH_CSRF_COOKIE_NAME: z.string().default('rakhal_csrf'),

  AUTH_CSRF_HEADER_NAME: z.string().default('x-csrf-token'),

  AUTH_CSRF_COOKIE_PATH: z.string().default('/api/v1/auth'),

  AUTH_CSRF_COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),

  AUTH_CSRF_COOKIE_SECURE: z.coerce.boolean().optional(),

  AUTH_CSRF_SECRET: z.string().min(32).optional(),

  RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  AUTH_LOGIN_RATE_LIMIT_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),

  AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS: z.coerce
    .number()
    .int()
    .positive()
    .default(5),

  AUTH_REFRESH_RATE_LIMIT_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),

  AUTH_REFRESH_RATE_LIMIT_MAX_REQUESTS: z.coerce
    .number()
    .int()
    .positive()
    .default(10),

  AUTH_LOCKOUT_MAX_FAILED_ATTEMPTS: z.coerce
    .number()
    .int()
    .positive()
    .default(5),

  AUTH_LOCKOUT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),

  AUTH_LOCKOUT_DURATION_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(900),

  // Logging configuration
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug', 'verbose'])
    .default('info'),

  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  ENABLE_REQUEST_LOGGING: z.coerce.boolean().default(true),

  ENABLE_DB_LOGGING: z.coerce.boolean().default(false),

  ENABLE_HTTP_LOGGING: z.coerce.boolean().default(true),

  EMAIL_PROVIDER: z.enum(['resend', 'smtp']).default('resend'),
  EMAIL_FROM: z.string().email(),
  EMAIL_VERIFICATION_BASE_URL: z.string(),
  EMAIL_PASSWORD_RESET_BASE_URL: z.string(),
  EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(1440),
  RESEND_API_KEY: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  SENTRY_ENABLED: z.coerce.boolean().default(false),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
});

export type Env = z.infer<typeof envSchema>;

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

  // RD-041: comma-separated allowlist for CORS `Access-Control-Allow-Origin`
  // (e.g. "https://app.rakhal.com,https://admin.rakhal.com"). Required in
  // production — `main.ts` refuses to boot without it once `NODE_ENV` is
  // `production`, since the previous `origin: true` behavior (reflecting
  // any caller's `Origin` back with `credentials: true`) let any website a
  // logged-in user visits drive the API as that user. Optional outside
  // production so local dev/CI stay unaffected.
  ALLOWED_ORIGINS: z.string().optional(),

  // RD-042/053: `/metrics` is unauthenticated by design (Prometheus scrape,
  // no bearer support) — the real fix is a reverse-proxy IP allowlist
  // (`docs/infrastructure/10-nginx-reverse-proxy.md`), out of scope for this
  // backend. This is the belt-and-braces half: when set, `GET /metrics`
  // requires `Authorization: Bearer <METRICS_TOKEN>`; unset keeps today's
  // open behavior so a farm/dev deployment with no reverse-proxy scrape auth
  // isn't broken by default.
  METRICS_TOKEN: z.string().optional(),

  // P2-06: optional allowlist for every `/admin/*` route (admin-api). Comma
  // separated exact IPs (v4/v6) or IPv4 CIDRs, e.g. "203.0.113.7,10.0.0.0/8".
  // Unset/empty = off (the nginx IP allowlist stays the primary control; this
  // is the in-app second layer). Matches `req.ip`, so TRUST_PROXY_HOPS must be
  // set correctly behind a proxy or every request looks like the proxy.
  ADMIN_IP_ALLOWLIST: z.string().optional(),

  DATABASE_URL: z.string(),

  JWT_ACCESS_SECRET: z.string().min(32),

  JWT_REFRESH_SECRET: z.string().min(32),

  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),

  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Platform-admin identity (RAKHAL-224, ADR-019). A **separate** secret from
  // the farm JWTs is the enforcement that a farm access token can never
  // authenticate as an admin (and vice-versa). Required + fail-closed like the
  // farm secrets — no default, so a misconfigured deploy refuses to boot.
  JWT_ADMIN_SECRET: z.string().min(32),

  JWT_ADMIN_EXPIRES_IN: z.string().default('1h'),

  // OTP / verification (RAKHAL-215/216). Delivery channel is swappable —
  // `email` now (MimSMS creds pending), `sms` drops in when the SMS provider
  // is configured. In non-production the code is returned in the API response
  // for testing (never in production).
  OTP_CHANNEL: z.enum(['email', 'sms']).default('email'),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),

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

  // Number of reverse-proxy hops in front of the app (Nginx on the same box = 1;
  // 2 if Cloudflare's proxy is ever enabled). Drives `app.set('trust proxy', n)`.
  // NEVER express this as a boolean: Nginx *appends* to X-Forwarded-For, so
  // `trust proxy: true` makes Express walk to the leftmost (client-supplied)
  // value — an attacker rotates the header per request and rate limiting,
  // which keys on req.ip, becomes a no-op. A hop count reads from the right.
  // 0 (the default) leaves trust proxy off, correct for local/dev with no proxy.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

  RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  // Route-independent aggregate ceiling per identity. The `default` throttler is
  // keyed per handler (sha256(Class-handler-name-tracker)), so on its own it
  // grants a fresh budget on every one of ~200 endpoints — no API-wide cap.
  RATE_LIMIT_GLOBAL_MAX_REQUESTS: z.coerce
    .number()
    .int()
    .positive()
    .default(300),

  // NOTE: the former AUTH_LOGIN_RATE_LIMIT_* / AUTH_REFRESH_RATE_LIMIT_* vars
  // were removed with the `login`/`refresh` named throttlers (RAKHAL-111).
  // Those limits now live in src/common/decorators/throttle-tiers.ts —
  // `@ThrottleAuth()` (5/min + 15-min block) and the per-route override on
  // /auth/refresh. Deliberately constants, not env: they are a security
  // posture, not a deployment tunable.

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
  /** Team-invite accept link (RAKHAL-030 email delivery). Defaults off the
   * verification URL's origin + `/invite` so a single deploy needs no new var. */
  EMAIL_INVITE_BASE_URL: z.string().optional(),
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

  // Object storage / image uploads (RAKHAL-009). Cloudflare R2 (S3-compatible),
  // **private** bucket — files are served only via short-lived presigned GET URLs.
  // In test (`NODE_ENV=test`) the in-memory adapter is always used, so the suite
  // never touches the real bucket. In production `STORAGE_PROVIDER=r2` requires the
  // R2_* creds (fail-closed at boot); dev without creds falls back to memory.
  STORAGE_PROVIDER: z.enum(['r2', 'memory']).default('memory'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
  R2_PRESIGN_EXPIRY_SECONDS: z.coerce.number().int().positive().default(900),
  MEDIA_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(8 * 1024 * 1024),

  // Tax-ready invoicing (RAKHAL-237, PRD §36.2). VAT is OFF at launch — Rakhal
  // is not VAT-registered, so receipts carry no VAT line until `VAT_ENABLED=true`
  // + a `VAT_RATE` (Mushak is 15% in BD). Toggling it on only affects invoices
  // issued afterwards (TAX-04 — never retro-mutates past receipts). The seller
  // identity is snapshotted onto each invoice at issue time.
  VAT_ENABLED: stringBoolean.default(false),
  VAT_RATE: z.coerce.number().min(0).max(100).default(0),
  INVOICE_NUMBER_PREFIX: z.string().default('INV'),
  INVOICE_SELLER_NAME: z.string().default('Rakhal'),
  INVOICE_SELLER_ADDRESS: z.string().default('Dhaka, Bangladesh'),
  INVOICE_SELLER_BIN: z.string().optional(),
  INVOICE_PLACE_OF_SUPPLY: z.string().default('Bangladesh'),

  // Active payment gateway (RAKHAL-221). Explicit toggle: `none` = billing runs
  // gateway-less (৳0/Free flows only); `bkash` = use the bKash adapter (its
  // BKASH_* creds must then be complete — fail-closed at boot). Tests always run
  // gateway-less regardless (deterministic; the bkash finalize logic is covered
  // by a stub-provider e2e).
  PAYMENT_PROVIDER: z.enum(['none', 'bkash']).default('none'),

  // bKash Tokenized Checkout (RAKHAL-221). Base URL defaults to sandbox; set the
  // BKASH_* creds + `PAYMENT_PROVIDER=bkash` to activate. Sandbox creds are public
  // (see the bKash sandbox guide); live creds come from the Merchant Portal.
  BKASH_BASE_URL: z
    .string()
    .default('https://tokenized.sandbox.bka.sh/v1.2.0-beta'),
  BKASH_APP_KEY: z.string().optional(),
  BKASH_APP_SECRET: z.string().optional(),
  BKASH_USERNAME: z.string().optional(),
  BKASH_PASSWORD: z.string().optional(),
  /** Public URL bKash redirects the payer's browser back to after approval. */
  BKASH_CALLBACK_URL: z.string().optional(),
  /** Frontend page to send the user to after we finalize (with ?status=). */
  BKASH_RETURN_URL: z.string().default('/'),

  // Telegram channel provider (RAKHAL-257, PRD §20.1/§28.3). Optional like the
  // FCM push channel: unset token → `isConfigured() === false`, channel just
  // defers (in-app still delivers). Webhook secret is the value passed to
  // Telegram's `setWebhook` call and checked against the
  // `X-Telegram-Bot-Api-Secret-Token` header on every incoming webhook call.
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

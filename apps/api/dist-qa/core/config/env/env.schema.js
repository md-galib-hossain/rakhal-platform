"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
const zod_1 = require("zod");
const stringBoolean = zod_1.z.preprocess((value) => {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on'].includes(normalized))
            return true;
        if (['false', '0', 'no', 'n', 'off'].includes(normalized))
            return false;
    }
    return value;
}, zod_1.z.boolean());
exports.envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z
        .enum(['development', 'production', 'test'])
        .default('development'),
    PORT: zod_1.z.coerce.number().default(5000),
    APP_NAME: zod_1.z.string().default('rakhal-api'),
    APP_VERSION: zod_1.z.string().default('1.0.0'),
    API_PREFIX: zod_1.z.string().default('api/v1'),
    ALLOWED_ORIGINS: zod_1.z.string().optional(),
    METRICS_TOKEN: zod_1.z.string().optional(),
    NV2_ENABLED: stringBoolean.default(false),
    ADMIN_IP_ALLOWLIST: zod_1.z.string().optional(),
    DATABASE_URL: zod_1.z.string(),
    JWT_ACCESS_SECRET: zod_1.z.string().min(32),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('30d'),
    JWT_ADMIN_SECRET: zod_1.z.string().min(32),
    JWT_ADMIN_EXPIRES_IN: zod_1.z.string().default('1h'),
    OTP_CHANNEL: zod_1.z.enum(['email', 'sms']).default('email'),
    OTP_TTL_SECONDS: zod_1.z.coerce.number().int().positive().default(300),
    OTP_MAX_ATTEMPTS: zod_1.z.coerce.number().int().positive().default(5),
    OTP_RESEND_COOLDOWN_SECONDS: zod_1.z.coerce.number().int().positive().default(60),
    REDIS_HOST: zod_1.z.string(),
    REDIS_PORT: zod_1.z.coerce.number(),
    REDIS_USERNAME: zod_1.z.string().optional(),
    REDIS_PASSWORD: zod_1.z.string().optional(),
    REDIS_DATABASE: zod_1.z.coerce.number().int().nonnegative().default(0),
    REDIS_TLS_ENABLED: stringBoolean.default(false),
    REDIS_CONNECT_TIMEOUT_MS: zod_1.z.coerce.number().int().positive().default(10000),
    ARGON2_MEMORY_COST: zod_1.z.coerce.number().int().positive().default(19456),
    ARGON2_TIME_COST: zod_1.z.coerce.number().int().positive().default(2),
    ARGON2_PARALLELISM: zod_1.z.coerce.number().int().positive().default(1),
    AUTH_REFRESH_COOKIE_NAME: zod_1.z.string().default('rakhal_refresh'),
    AUTH_REFRESH_COOKIE_DOMAIN: zod_1.z.string().optional(),
    AUTH_REFRESH_COOKIE_PATH: zod_1.z.string().default('/api/v1/auth'),
    AUTH_REFRESH_COOKIE_SAME_SITE: zod_1.z
        .enum(['strict', 'lax', 'none'])
        .default('lax'),
    AUTH_REFRESH_COOKIE_SECURE: zod_1.z.coerce.boolean().optional(),
    AUTH_CSRF_COOKIE_NAME: zod_1.z.string().default('rakhal_csrf'),
    AUTH_CSRF_HEADER_NAME: zod_1.z.string().default('x-csrf-token'),
    AUTH_CSRF_COOKIE_PATH: zod_1.z.string().default('/api/v1/auth'),
    AUTH_CSRF_COOKIE_SAME_SITE: zod_1.z.enum(['strict', 'lax', 'none']).default('lax'),
    AUTH_CSRF_COOKIE_SECURE: zod_1.z.coerce.boolean().optional(),
    AUTH_CSRF_SECRET: zod_1.z.string().min(32).optional(),
    TRUST_PROXY_HOPS: zod_1.z.coerce.number().int().min(0).max(5).default(0),
    RATE_LIMIT_TTL_SECONDS: zod_1.z.coerce.number().int().positive().default(60),
    RATE_LIMIT_MAX_REQUESTS: zod_1.z.coerce.number().int().positive().default(100),
    RATE_LIMIT_GLOBAL_MAX_REQUESTS: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .default(300),
    AUTH_LOCKOUT_MAX_FAILED_ATTEMPTS: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .default(5),
    AUTH_LOCKOUT_WINDOW_SECONDS: zod_1.z.coerce.number().int().positive().default(900),
    AUTH_LOCKOUT_DURATION_SECONDS: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .default(900),
    LOG_LEVEL: zod_1.z
        .enum(['error', 'warn', 'info', 'debug', 'verbose'])
        .default('info'),
    LOG_FORMAT: zod_1.z.enum(['json', 'pretty']).default('json'),
    ENABLE_REQUEST_LOGGING: zod_1.z.coerce.boolean().default(true),
    ENABLE_DB_LOGGING: zod_1.z.coerce.boolean().default(false),
    ENABLE_HTTP_LOGGING: zod_1.z.coerce.boolean().default(true),
    EMAIL_PROVIDER: zod_1.z.enum(['resend', 'smtp']).default('resend'),
    EMAIL_FROM: zod_1.z.string().email(),
    EMAIL_VERIFICATION_BASE_URL: zod_1.z.string(),
    EMAIL_PASSWORD_RESET_BASE_URL: zod_1.z.string(),
    EMAIL_INVITE_BASE_URL: zod_1.z.string().optional(),
    EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .default(1440),
    RESEND_API_KEY: zod_1.z.string().optional(),
    SENTRY_DSN: zod_1.z.string().optional(),
    SENTRY_ENABLED: zod_1.z.coerce.boolean().default(false),
    SENTRY_ENVIRONMENT: zod_1.z.string().optional(),
    SENTRY_RELEASE: zod_1.z.string().optional(),
    SENTRY_TRACES_SAMPLE_RATE: zod_1.z.coerce.number().min(0).max(1).default(0),
    STORAGE_PROVIDER: zod_1.z.enum(['r2', 'memory']).default('memory'),
    R2_ACCOUNT_ID: zod_1.z.string().optional(),
    R2_ACCESS_KEY_ID: zod_1.z.string().optional(),
    R2_SECRET_ACCESS_KEY: zod_1.z.string().optional(),
    R2_BUCKET: zod_1.z.string().optional(),
    R2_PUBLIC_BASE_URL: zod_1.z
        .string()
        .optional()
        .transform((v) => (v && v.trim() ? v.trim() : undefined)),
    R2_PRESIGN_EXPIRY_SECONDS: zod_1.z.coerce.number().int().positive().default(900),
    MEDIA_MAX_UPLOAD_BYTES: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .default(8 * 1024 * 1024),
    VAT_ENABLED: stringBoolean.default(false),
    VAT_RATE: zod_1.z.coerce.number().min(0).max(100).default(0),
    INVOICE_NUMBER_PREFIX: zod_1.z.string().default('INV'),
    INVOICE_SELLER_NAME: zod_1.z.string().default('Rakhal'),
    INVOICE_SELLER_ADDRESS: zod_1.z.string().default('Dhaka, Bangladesh'),
    INVOICE_SELLER_BIN: zod_1.z.string().optional(),
    INVOICE_PLACE_OF_SUPPLY: zod_1.z.string().default('Bangladesh'),
    PAYMENT_PROVIDER: zod_1.z.enum(['none', 'bkash']).default('none'),
    BKASH_BASE_URL: zod_1.z
        .string()
        .default('https://tokenized.sandbox.bka.sh/v1.2.0-beta'),
    BKASH_APP_KEY: zod_1.z.string().optional(),
    BKASH_APP_SECRET: zod_1.z.string().optional(),
    BKASH_USERNAME: zod_1.z.string().optional(),
    BKASH_PASSWORD: zod_1.z.string().optional(),
    BKASH_CALLBACK_URL: zod_1.z.string().optional(),
    BKASH_RETURN_URL: zod_1.z.string().default('/'),
    TELEGRAM_BOT_TOKEN: zod_1.z.string().optional(),
    TELEGRAM_BOT_USERNAME: zod_1.z.string().optional(),
    TELEGRAM_WEBHOOK_SECRET: zod_1.z.string().optional(),
});
//# sourceMappingURL=env.schema.js.map
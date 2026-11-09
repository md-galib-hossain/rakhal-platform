"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authConfig = void 0;
const config_1 = require("@nestjs/config");
const env_1 = require("./env");
exports.authConfig = (0, config_1.registerAs)('auth', () => ({
    accessSecret: env_1.env.JWT_ACCESS_SECRET,
    refreshSecret: env_1.env.JWT_REFRESH_SECRET,
    accessExpiresIn: env_1.env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env_1.env.JWT_REFRESH_EXPIRES_IN,
    password: {
        argon2MemoryCost: env_1.env.ARGON2_MEMORY_COST,
        argon2TimeCost: env_1.env.ARGON2_TIME_COST,
        argon2Parallelism: env_1.env.ARGON2_PARALLELISM,
    },
    refreshCookie: {
        name: env_1.env.AUTH_REFRESH_COOKIE_NAME,
        domain: env_1.env.AUTH_REFRESH_COOKIE_DOMAIN,
        path: env_1.env.AUTH_REFRESH_COOKIE_PATH,
        sameSite: env_1.env.AUTH_REFRESH_COOKIE_SAME_SITE,
        secure: env_1.env.AUTH_REFRESH_COOKIE_SECURE ?? env_1.env.NODE_ENV === 'production',
        httpOnly: true,
    },
    csrf: {
        cookieName: env_1.env.AUTH_CSRF_COOKIE_NAME,
        headerName: env_1.env.AUTH_CSRF_HEADER_NAME,
        secret: env_1.env.AUTH_CSRF_SECRET,
        cookiePath: env_1.env.AUTH_CSRF_COOKIE_PATH,
        cookieSameSite: env_1.env.AUTH_CSRF_COOKIE_SAME_SITE,
        cookieSecure: env_1.env.AUTH_CSRF_COOKIE_SECURE ?? env_1.env.NODE_ENV === 'production',
    },
    rateLimit: {
        ttlSeconds: env_1.env.RATE_LIMIT_TTL_SECONDS,
        maxRequests: env_1.env.RATE_LIMIT_MAX_REQUESTS,
        globalMaxRequests: env_1.env.RATE_LIMIT_GLOBAL_MAX_REQUESTS,
    },
    lockout: {
        maxFailedAttempts: env_1.env.AUTH_LOCKOUT_MAX_FAILED_ATTEMPTS,
        windowSeconds: env_1.env.AUTH_LOCKOUT_WINDOW_SECONDS,
        durationSeconds: env_1.env.AUTH_LOCKOUT_DURATION_SECONDS,
    },
}));
//# sourceMappingURL=auth.config.js.map
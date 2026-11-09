"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sentryConfig = void 0;
const config_1 = require("@nestjs/config");
exports.sentryConfig = (0, config_1.registerAs)('sentry', () => ({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE ?? process.env.APP_VERSION ?? 'dev',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    enabled: process.env.SENTRY_ENABLED === 'true',
}));
//# sourceMappingURL=sentry.config.js.map
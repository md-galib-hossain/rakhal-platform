"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConfig = void 0;
const config_1 = require("@nestjs/config");
const env_1 = require("./env");
exports.appConfig = (0, config_1.registerAs)('app', () => ({
    name: env_1.env.APP_NAME,
    port: env_1.env.PORT,
    nodeEnv: env_1.env.NODE_ENV,
    apiPrefix: env_1.env.API_PREFIX,
    isProduction: env_1.env.NODE_ENV === 'production',
    appVersion: env_1.env.APP_VERSION,
    trustProxyHops: env_1.env.TRUST_PROXY_HOPS,
    swaggerEnabled: env_1.env.NODE_ENV !== 'production',
    allowedOrigins: env_1.env.ALLOWED_ORIGINS
        ? env_1.env.ALLOWED_ORIGINS.split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : [],
    metricsToken: env_1.env.METRICS_TOKEN,
}));
//# sourceMappingURL=app.config.js.map
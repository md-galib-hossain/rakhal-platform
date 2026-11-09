"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConfig = void 0;
const config_1 = require("@nestjs/config");
const env_1 = require("./env");
exports.redisConfig = (0, config_1.registerAs)('redis', () => ({
    host: env_1.env.REDIS_HOST,
    port: env_1.env.REDIS_PORT,
    username: env_1.env.REDIS_USERNAME,
    password: env_1.env.REDIS_PASSWORD,
    database: env_1.env.REDIS_DATABASE,
    tlsEnabled: env_1.env.REDIS_TLS_ENABLED,
    connectTimeoutMs: env_1.env.REDIS_CONNECT_TIMEOUT_MS,
    url: buildRedisUrl(),
}));
function buildRedisUrl() {
    const protocol = env_1.env.REDIS_TLS_ENABLED ? 'rediss' : 'redis';
    const credentials = [env_1.env.REDIS_USERNAME, env_1.env.REDIS_PASSWORD]
        .filter((value) => Boolean(value))
        .map(encodeURIComponent)
        .join(':');
    const auth = credentials ? `${credentials}@` : '';
    return `${protocol}://${auth}${env_1.env.REDIS_HOST}:${env_1.env.REDIS_PORT}/${env_1.env.REDIS_DATABASE}`;
}
//# sourceMappingURL=redis.config.js.map
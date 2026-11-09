"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggingConfig = void 0;
const config_1 = require("@nestjs/config");
const env_1 = require("./env");
exports.loggingConfig = (0, config_1.registerAs)('logging', () => ({
    level: env_1.env.LOG_LEVEL,
    format: env_1.env.LOG_FORMAT,
    requestLogging: env_1.env.ENABLE_REQUEST_LOGGING,
    dbLogging: env_1.env.ENABLE_DB_LOGGING,
    httpLogging: env_1.env.ENABLE_HTTP_LOGGING,
}));
//# sourceMappingURL=logging.config.js.map
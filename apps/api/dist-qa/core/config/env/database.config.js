"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = void 0;
const config_1 = require("@nestjs/config");
const env_1 = require("./env");
exports.databaseConfig = (0, config_1.registerAs)('database', () => ({
    url: env_1.env.DATABASE_URL,
}));
//# sourceMappingURL=database.config.js.map
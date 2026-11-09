"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramConfig = void 0;
const config_1 = require("@nestjs/config");
const env_1 = require("./env");
exports.telegramConfig = (0, config_1.registerAs)('telegram', () => ({
    botToken: env_1.env.TELEGRAM_BOT_TOKEN,
    botUsername: env_1.env.TELEGRAM_BOT_USERNAME,
    webhookSecret: env_1.env.TELEGRAM_WEBHOOK_SECRET,
}));
//# sourceMappingURL=telegram.config.js.map
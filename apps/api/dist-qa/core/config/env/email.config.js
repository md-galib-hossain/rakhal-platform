"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailConfig = void 0;
const config_1 = require("@nestjs/config");
const env_1 = require("./env");
exports.emailConfig = (0, config_1.registerAs)('email', () => ({
    provider: env_1.env.EMAIL_PROVIDER,
    from: env_1.env.EMAIL_FROM,
    verificationBaseUrl: env_1.env.EMAIL_VERIFICATION_BASE_URL,
    passwordResetBaseUrl: env_1.env.EMAIL_PASSWORD_RESET_BASE_URL ?? env_1.env.EMAIL_VERIFICATION_BASE_URL,
    inviteBaseUrl: env_1.env.EMAIL_INVITE_BASE_URL ??
        `${new URL(env_1.env.EMAIL_VERIFICATION_BASE_URL).origin}/invite`,
    verificationTokenTtlMinutes: env_1.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES,
    resendApiKey: env_1.env.RESEND_API_KEY,
}));
//# sourceMappingURL=email.config.js.map
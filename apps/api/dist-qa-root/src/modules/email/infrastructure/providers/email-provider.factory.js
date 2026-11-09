"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailProviderFactory = void 0;
const common_1 = require("@nestjs/common");
const env_1 = require("src/core/config/env");
const resend_email_provider_1 = require("./resend-email.provider");
const smtp_email_provider_1 = require("./smtp-email.provider");
let EmailProviderFactory = class EmailProviderFactory {
    config;
    resendProvider;
    smtpProvider;
    constructor(config, resendProvider, smtpProvider) {
        this.config = config;
        this.resendProvider = resendProvider;
        this.smtpProvider = smtpProvider;
    }
    getProvider() {
        switch (this.config.provider) {
            case 'smtp':
                return this.smtpProvider;
            case 'resend':
            default:
                return this.resendProvider;
        }
    }
};
exports.EmailProviderFactory = EmailProviderFactory;
exports.EmailProviderFactory = EmailProviderFactory = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(env_1.emailConfig.KEY)),
    __metadata("design:paramtypes", [void 0, resend_email_provider_1.ResendEmailProvider,
        smtp_email_provider_1.SmtpEmailProvider])
], EmailProviderFactory);
//# sourceMappingURL=email-provider.factory.js.map
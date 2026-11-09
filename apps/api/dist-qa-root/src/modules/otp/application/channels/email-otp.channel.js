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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailOtpChannel = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const email_service_1 = require("src/modules/email/application/services/email.service");
const email_template_enum_1 = require("src/modules/email/domain/enums/email-template.enum");
let EmailOtpChannel = class EmailOtpChannel {
    email;
    channel = 'email';
    constructor(email) {
        this.email = email;
    }
    async send(request) {
        await this.email.queue({
            to: request.email,
            subject: 'Your Rakhal verification code',
            template: email_template_enum_1.EmailTemplate.OTP_VERIFICATION,
            templateData: {
                name: request.name,
                code: request.code,
                minutes: Math.round(request.ttlSeconds / 60),
            },
            tenantId: request.userId,
            farmId: null,
            userId: request.userId,
            correlationId: (0, node_crypto_1.randomUUID)(),
            locale: request.locale,
        });
    }
};
exports.EmailOtpChannel = EmailOtpChannel;
exports.EmailOtpChannel = EmailOtpChannel = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [email_service_1.EmailService])
], EmailOtpChannel);
//# sourceMappingURL=email-otp.channel.js.map
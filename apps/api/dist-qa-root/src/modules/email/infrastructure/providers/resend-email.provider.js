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
exports.ResendEmailProvider = void 0;
const common_1 = require("@nestjs/common");
const resend_1 = require("resend");
const env_1 = require("src/core/config/env");
let ResendEmailProvider = class ResendEmailProvider {
    config;
    client;
    constructor(config) {
        this.config = config;
        this.client = new resend_1.Resend(this.config.resendApiKey);
    }
    async sendEmail(input) {
        await this.client.emails.send({
            from: this.config.from,
            to: input.to,
            subject: input.subject,
            html: input.html,
            attachments: input.attachments?.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content,
            })),
        });
    }
};
exports.ResendEmailProvider = ResendEmailProvider;
exports.ResendEmailProvider = ResendEmailProvider = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(env_1.emailConfig.KEY)),
    __metadata("design:paramtypes", [void 0])
], ResendEmailProvider);
//# sourceMappingURL=resend-email.provider.js.map
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
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const queue_email_use_case_1 = require("../use-cases/queue-email.use-case");
let EmailService = class EmailService {
    queueEmailUseCase;
    constructor(queueEmailUseCase) {
        this.queueEmailUseCase = queueEmailUseCase;
    }
    async queue(input) {
        const emailId = (0, crypto_1.randomUUID)();
        await this.queueEmailUseCase.execute({
            ...input,
            emailId,
        });
        return emailId;
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [queue_email_use_case_1.QueueEmailUseCase])
], EmailService);
//# sourceMappingURL=email.service.js.map
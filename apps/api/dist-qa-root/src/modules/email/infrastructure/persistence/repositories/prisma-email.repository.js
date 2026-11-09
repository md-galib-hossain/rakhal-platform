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
exports.PrismaEmailRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const email_status_enum_1 = require("src/modules/email/domain/enums/email-status.enum");
let PrismaEmailRepository = class PrismaEmailRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        const result = await this.prisma.emailLog.create({
            data: {
                id: data.id,
                to: data.to,
                subject: data.subject,
                tenantId: data.tenantId,
                farmId: data.farmId,
                userId: data.userId,
                correlationId: data.correlationId,
                template: data.template,
                status: email_status_enum_1.EmailStatus.QUEUED,
                scheduledAt: data.scheduledAt,
                idempotencyKey: data.idempotencyKey,
            },
        });
        return result;
    }
    async markProcessing(emailId) {
        const result = await this.prisma.emailLog.update({
            where: { id: emailId },
            data: { status: email_status_enum_1.EmailStatus.PROCESSING },
        });
        return result;
    }
    async markSent(emailId, provider) {
        const result = await this.prisma.emailLog.update({
            where: { id: emailId },
            data: {
                status: email_status_enum_1.EmailStatus.SENT,
                provider,
                sentAt: new Date(),
            },
        });
        return result;
    }
    async markFailed(emailId, errorMessage, retries) {
        const result = await this.prisma.emailLog.update({
            where: { id: emailId },
            data: {
                status: email_status_enum_1.EmailStatus.FAILED,
                errorMessage,
                retries,
            },
        });
        return result;
    }
};
exports.PrismaEmailRepository = PrismaEmailRepository;
exports.PrismaEmailRepository = PrismaEmailRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PrismaEmailRepository);
//# sourceMappingURL=prisma-email.repository.js.map
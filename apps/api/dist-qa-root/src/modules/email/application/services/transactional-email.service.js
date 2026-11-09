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
var TransactionalEmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionalEmailService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const email_service_1 = require("./email.service");
let TransactionalEmailService = TransactionalEmailService_1 = class TransactionalEmailService {
    prisma;
    email;
    log;
    constructor(prisma, email, logger) {
        this.prisma = prisma;
        this.email = email;
        this.log = logger.setContext(TransactionalEmailService_1.name);
    }
    async sendOnce(input) {
        const existing = await this.prisma.emailLog.findFirst({
            where: { idempotencyKey: input.idempotencyKey },
            select: { id: true },
        });
        if (existing) {
            this.log.info('Transactional email deduped', {
                idempotencyKey: input.idempotencyKey,
                template: input.template,
            });
            return { sent: false };
        }
        try {
            await this.email.queue({
                to: input.to,
                subject: input.subject,
                template: input.template,
                templateData: input.templateData,
                tenantId: input.tenantId,
                farmId: input.farmId,
                userId: input.userId,
                idempotencyKey: input.idempotencyKey,
                locale: input.locale,
            });
            return { sent: true };
        }
        catch (err) {
            if (err.code === 'P2002') {
                return { sent: false };
            }
            throw err;
        }
    }
};
exports.TransactionalEmailService = TransactionalEmailService;
exports.TransactionalEmailService = TransactionalEmailService = TransactionalEmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService,
        logger_service_1.LoggerService])
], TransactionalEmailService);
//# sourceMappingURL=transactional-email.service.js.map
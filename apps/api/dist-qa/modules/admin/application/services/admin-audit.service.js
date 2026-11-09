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
var AdminAuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const logger_context_1 = require("src/core/logger/logger/logger.context");
const admin_audit_actions_1 = require("../../domain/admin-audit-actions");
let AdminAuditService = AdminAuditService_1 = class AdminAuditService {
    prisma;
    requestContext;
    log;
    constructor(prisma, requestContext, logger) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.log = logger.setContext(AdminAuditService_1.name);
    }
    async record(data) {
        const ctx = this.requestContext.get();
        const metadata = (0, admin_audit_actions_1.redactAuditPayload)(data.metadata ?? null);
        const before = (0, admin_audit_actions_1.redactAuditPayload)(data.before ?? null);
        const after = (0, admin_audit_actions_1.redactAuditPayload)(data.after ?? null);
        this.log.audit(`admin.${data.action}`, {
            actorUserId: data.adminId ?? null,
            entityType: data.entityType,
            entityId: data.entityId ?? null,
            outcome: data.outcome ?? 'SUCCESS',
            metadata,
        });
        await this.prisma.platformAdminAuditLog.create({
            data: {
                adminId: data.adminId ?? null,
                action: data.action,
                entityType: data.entityType,
                entityId: data.entityId ?? null,
                metadata: (metadata ?? undefined),
                before: (before ?? undefined),
                after: (after ?? undefined),
                outcome: data.outcome ?? 'SUCCESS',
                actorEmail: data.actorEmail?.slice(0, 254) ?? null,
                ipAddress: data.ipAddress ?? ctx?.['ipAddress'] ?? null,
                userAgent: (data.userAgent ??
                    ctx?.['userAgent'] ??
                    null)?.slice(0, 255) ?? null,
                sessionId: data.sessionId ?? ctx?.sessionId ?? null,
                requestId: data.requestId ?? ctx?.requestId ?? null,
            },
        });
    }
    async list(query) {
        const rows = await this.prisma.platformAdminAuditLog.findMany({
            where: {
                adminId: query.adminId,
                action: query.action,
            },
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
};
exports.AdminAuditService = AdminAuditService;
exports.AdminAuditService = AdminAuditService = AdminAuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_context_1.LoggerContext,
        logger_service_1.LoggerService])
], AdminAuditService);
//# sourceMappingURL=admin-audit.service.js.map
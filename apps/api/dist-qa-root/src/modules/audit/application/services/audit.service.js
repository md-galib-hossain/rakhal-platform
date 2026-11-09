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
var AuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
let AuditService = AuditService_1 = class AuditService {
    prisma;
    logger;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.logger = logger;
        this.log = this.logger.setContext(AuditService_1.name);
    }
    record(data) {
        this.log.audit(data.action, {
            actorUserId: data.actorUserId,
            entityType: data.entityType,
            entityId: data.entityId ?? null,
            farmId: data.farmId ?? null,
            metadata: data.metadata ?? null,
        });
        return this.prisma.auditLog.create({
            data: {
                actorUserId: data.actorUserId,
                action: data.action,
                entityType: data.entityType,
                entityId: data.entityId ?? null,
                farmId: data.farmId ?? null,
                metadata: (data.metadata ?? undefined),
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
            },
        });
    }
    logLogin(data) {
        return this.record({
            actorUserId: data.actorUserId,
            action: client_1.AuditAction.LOGIN,
            entityType: 'Session',
            entityId: data.sessionId,
            farmId: data.farmId ?? null,
            metadata: data.metadata ?? null,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
        });
    }
    logLogout(data) {
        return this.record({
            actorUserId: data.actorUserId,
            action: client_1.AuditAction.LOGOUT,
            entityType: 'Session',
            entityId: data.sessionId,
            farmId: data.farmId ?? null,
            metadata: data.metadata ?? null,
        });
    }
    logSessionRevoked(data) {
        return this.record({
            actorUserId: data.actorUserId,
            action: client_1.AuditAction.SESSION_REVOKED,
            entityType: 'Session',
            entityId: data.sessionId,
            farmId: data.farmId ?? null,
            metadata: data.metadata ?? null,
        });
    }
    logPasswordChanged(data) {
        return this.record({
            actorUserId: data.actorUserId,
            action: client_1.AuditAction.PASSWORD_CHANGED,
            entityType: 'User',
            entityId: data.actorUserId,
            metadata: data.metadata ?? null,
        });
    }
    logRefreshReuse(data) {
        return this.record({
            actorUserId: data.actorUserId,
            action: client_1.AuditAction.SUSPICIOUS_ACTIVITY,
            entityType: 'Session',
            entityId: data.sessionId,
            farmId: data.farmId ?? null,
            metadata: {
                event: 'refresh-token-reuse',
                ...data.metadata,
            },
        });
    }
    logRoleChanged(data) {
        return this.record({
            actorUserId: data.actorUserId,
            action: client_1.AuditAction.ROLE_UPDATED,
            entityType: 'Role',
            entityId: data.entityId ?? data.actorUserId,
            farmId: data.farmId ?? null,
            metadata: data.metadata ?? null,
        });
    }
    logMembershipChanged(data) {
        return this.record({
            actorUserId: data.actorUserId,
            action: client_1.AuditAction.MEMBER_REMOVED,
            entityType: 'FarmMember',
            entityId: data.entityId ?? data.actorUserId,
            farmId: data.farmId ?? null,
            metadata: data.metadata ?? null,
        });
    }
    logSubscriptionChanged(data) {
        return this.record({
            actorUserId: data.actorUserId,
            action: client_1.AuditAction.SUBSCRIPTION_UPDATED,
            entityType: 'FarmSubscription',
            entityId: data.entityId ?? data.actorUserId,
            farmId: data.farmId ?? null,
            metadata: data.metadata ?? null,
        });
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = AuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], AuditService);
//# sourceMappingURL=audit.service.js.map
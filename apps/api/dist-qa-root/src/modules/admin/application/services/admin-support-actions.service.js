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
exports.AdminSupportActionsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const auth_service_1 = require("src/modules/auth/application/services/auth.service");
const admin_audit_service_1 = require("./admin-audit.service");
let AdminSupportActionsService = class AdminSupportActionsService {
    prisma;
    auth;
    audit;
    constructor(prisma, auth, audit) {
        this.prisma = prisma;
        this.auth = auth;
        this.audit = audit;
    }
    suspendFarm(actorId, id, dto) {
        return this.setFarmStatus(actorId, id, dto, 'SUSPENDED');
    }
    reactivateFarm(actorId, id, dto) {
        return this.setFarmStatus(actorId, id, dto, 'ACTIVE');
    }
    async setFarmStatus(actorId, id, dto, target) {
        const farm = await this.prisma.farm.findFirst({
            where: { id, deletedAt: null },
            select: { id: true, name: true, status: true },
        });
        if (!farm)
            throw new common_1.NotFoundException('Farm not found');
        this.assertConfirm(dto.confirm, farm.name, 'farm name');
        if (farm.status === client_1.FarmStatus.ARCHIVED) {
            throw new common_1.ConflictException('An archived farm cannot be changed');
        }
        if (farm.status === target)
            return { id, status: farm.status, changed: false };
        await this.prisma.farm.update({ where: { id }, data: { status: target } });
        await this.audit.record({
            adminId: actorId,
            action: target === 'SUSPENDED' ? 'FARM_SUSPENDED' : 'FARM_REACTIVATED',
            entityType: 'Farm',
            entityId: id,
            before: { status: farm.status },
            after: { status: target },
            metadata: { reason: dto.reason, farmName: farm.name },
        });
        return { id, status: target, changed: true };
    }
    async blockUser(actorId, id, dto) {
        const user = await this.getUser(id);
        this.assertConfirm(dto.confirm, user.email, 'user email');
        if (user.isBlocked)
            return { id, isBlocked: true, changed: false };
        await this.prisma.user.update({
            where: { id },
            data: { isBlocked: true },
        });
        const revoked = await this.auth.logoutAllSessions(id);
        await this.audit.record({
            adminId: actorId,
            action: 'USER_BLOCKED',
            entityType: 'User',
            entityId: id,
            before: { isBlocked: false },
            after: { isBlocked: true },
            metadata: {
                reason: dto.reason,
                email: user.email,
                revokedSessions: revoked.revokedSessions,
            },
        });
        return { id, isBlocked: true, changed: true };
    }
    async unblockUser(actorId, id, dto) {
        const user = await this.getUser(id);
        this.assertConfirm(dto.confirm, user.email, 'user email');
        if (!user.isBlocked)
            return { id, isBlocked: false, changed: false };
        await this.prisma.user.update({
            where: { id },
            data: { isBlocked: false, failedLoginAttempts: 0, lockedUntil: null },
        });
        await this.audit.record({
            adminId: actorId,
            action: 'USER_UNBLOCKED',
            entityType: 'User',
            entityId: id,
            before: { isBlocked: true },
            after: { isBlocked: false },
            metadata: { reason: dto.reason, email: user.email },
        });
        return { id, isBlocked: false, changed: true };
    }
    async sendPasswordReset(actorId, id, dto) {
        const user = await this.getUser(id);
        this.assertConfirm(dto.confirm, user.email, 'user email');
        await this.auth.forgotPassword(user.email);
        let revokedSessions = 0;
        if (dto.revokeSessions) {
            revokedSessions = (await this.auth.logoutAllSessions(id)).revokedSessions;
        }
        await this.audit.record({
            adminId: actorId,
            action: 'USER_PASSWORD_RESET_SENT',
            entityType: 'User',
            entityId: id,
            metadata: {
                reason: dto.reason,
                email: user.email,
                revokeSessions: !!dto.revokeSessions,
                revokedSessions,
            },
        });
        return { id, sent: true, revokedSessions };
    }
    async revokeUserSessions(actorId, id, dto) {
        const user = await this.getUser(id);
        this.assertConfirm(dto.confirm, user.email, 'user email');
        const result = await this.auth.logoutAllSessions(id);
        await this.audit.record({
            adminId: actorId,
            action: 'USER_SESSIONS_REVOKED',
            entityType: 'User',
            entityId: id,
            metadata: {
                reason: dto.reason,
                email: user.email,
                revokedSessions: result.revokedSessions,
                revokedRefreshTokens: result.revokedRefreshTokens,
            },
        });
        return result;
    }
    async getUser(id) {
        const user = await this.prisma.user.findFirst({
            where: { id, deletedAt: null },
            select: { id: true, email: true, isBlocked: true },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    assertConfirm(provided, expected, what) {
        if (provided.trim() !== expected) {
            throw new common_1.BadRequestException(`Confirmation does not match the ${what}`);
        }
    }
};
exports.AdminSupportActionsService = AdminSupportActionsService;
exports.AdminSupportActionsService = AdminSupportActionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_service_1.AuthService,
        admin_audit_service_1.AdminAuditService])
], AdminSupportActionsService);
//# sourceMappingURL=admin-support-actions.service.js.map
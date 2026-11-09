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
exports.AdminManagementService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const pagination_1 = require("src/common/pagination");
const password_service_1 = require("src/modules/auth/application/services/password.service");
const admin_password_policy_1 = require("../../domain/admin-password-policy");
const admin_audit_service_1 = require("./admin-audit.service");
const admin_session_service_1 = require("./admin-session.service");
const SAFE_ADMIN_SELECT = {
    id: true,
    email: true,
    name: true,
    role: true,
    isActive: true,
    totpEnabled: true,
    mustChangePassword: true,
    passwordChangedAt: true,
    lastLoginAt: true,
    lastLoginIp: true,
    createdAt: true,
    updatedAt: true,
};
function snapshot(admin) {
    return {
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isActive: admin.isActive,
        totpEnabled: admin.totpEnabled,
        mustChangePassword: admin.mustChangePassword,
    };
}
let AdminManagementService = class AdminManagementService {
    prisma;
    passwords;
    sessions;
    audit;
    constructor(prisma, passwords, sessions, audit) {
        this.prisma = prisma;
        this.passwords = passwords;
        this.sessions = sessions;
        this.audit = audit;
    }
    async list(query) {
        const rows = await this.prisma.platformAdmin.findMany({
            select: SAFE_ADMIN_SELECT,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async get(id) {
        const admin = await this.prisma.platformAdmin.findUnique({
            where: { id },
            select: SAFE_ADMIN_SELECT,
        });
        if (!admin)
            throw new common_1.NotFoundException('Admin not found');
        return admin;
    }
    async create(actorId, input) {
        const temporaryPassword = (0, admin_password_policy_1.generateTemporaryAdminPassword)();
        let admin;
        try {
            admin = await this.prisma.platformAdmin.create({
                data: {
                    email: input.email.trim().toLowerCase(),
                    name: input.name.trim(),
                    role: input.role,
                    passwordHash: await this.passwords.hashPassword(temporaryPassword),
                    mustChangePassword: true,
                },
                select: SAFE_ADMIN_SELECT,
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                throw new common_1.ConflictException('An admin with this email already exists');
            }
            throw err;
        }
        await this.audit.record({
            adminId: actorId,
            action: 'ADMIN_CREATED',
            entityType: 'PlatformAdmin',
            entityId: admin.id,
            after: snapshot(admin),
        });
        return { admin, temporaryPassword };
    }
    async update(actorId, id, input) {
        const before = await this.getEntity(id);
        const roleChanges = input.role !== undefined && input.role !== before.role;
        if (roleChanges) {
            if (id === actorId) {
                throw new common_1.BadRequestException('You cannot change your own role');
            }
            if (before.role === 'SUPER_ADMIN')
                await this.assertNotLastSuper(id);
        }
        const admin = await this.prisma.platformAdmin.update({
            where: { id },
            data: {
                ...(input.name !== undefined ? { name: input.name.trim() } : {}),
                ...(input.role !== undefined ? { role: input.role } : {}),
            },
            select: SAFE_ADMIN_SELECT,
        });
        await this.audit.record({
            adminId: actorId,
            action: roleChanges ? 'ADMIN_ROLE_CHANGED' : 'ADMIN_UPDATED',
            entityType: 'PlatformAdmin',
            entityId: id,
            before: snapshot(before),
            after: snapshot(admin),
        });
        return admin;
    }
    async deactivate(actorId, id) {
        if (id === actorId) {
            throw new common_1.BadRequestException('You cannot deactivate yourself');
        }
        const before = await this.getEntity(id);
        if (!before.isActive)
            return this.get(id);
        if (before.role === 'SUPER_ADMIN')
            await this.assertNotLastSuper(id);
        const admin = await this.prisma.platformAdmin.update({
            where: { id },
            data: { isActive: false },
            select: SAFE_ADMIN_SELECT,
        });
        await this.sessions.revokeAll(id, 'ADMIN_DEACTIVATED');
        await this.audit.record({
            adminId: actorId,
            action: 'ADMIN_DEACTIVATED',
            entityType: 'PlatformAdmin',
            entityId: id,
            before: snapshot(before),
            after: snapshot(admin),
        });
        return admin;
    }
    async activate(actorId, id) {
        const before = await this.getEntity(id);
        if (before.isActive)
            return this.get(id);
        const admin = await this.prisma.platformAdmin.update({
            where: { id },
            data: { isActive: true },
            select: SAFE_ADMIN_SELECT,
        });
        await this.audit.record({
            adminId: actorId,
            action: 'ADMIN_ACTIVATED',
            entityType: 'PlatformAdmin',
            entityId: id,
            before: snapshot(before),
            after: snapshot(admin),
        });
        return admin;
    }
    async resetTwoFactor(actorId, id) {
        if (id === actorId) {
            throw new common_1.BadRequestException('You cannot reset your own 2FA');
        }
        const before = await this.getEntity(id);
        const admin = await this.prisma.platformAdmin.update({
            where: { id },
            data: { totpEnabled: false, totpSecret: null },
            select: SAFE_ADMIN_SELECT,
        });
        await this.sessions.revokeAll(id, 'TWO_FACTOR_RESET');
        await this.audit.record({
            adminId: actorId,
            action: 'TWO_FACTOR_RESET',
            entityType: 'PlatformAdmin',
            entityId: id,
            before: snapshot(before),
            after: snapshot(admin),
        });
        return admin;
    }
    async resetPassword(actorId, id) {
        if (id === actorId) {
            throw new common_1.BadRequestException('Use change-password to change your own password');
        }
        const before = await this.getEntity(id);
        const temporaryPassword = (0, admin_password_policy_1.generateTemporaryAdminPassword)();
        const admin = await this.prisma.platformAdmin.update({
            where: { id },
            data: {
                passwordHash: await this.passwords.hashPassword(temporaryPassword),
                mustChangePassword: true,
            },
            select: SAFE_ADMIN_SELECT,
        });
        await this.sessions.revokeAll(id, 'PASSWORD_RESET');
        await this.audit.record({
            adminId: actorId,
            action: 'PASSWORD_RESET',
            entityType: 'PlatformAdmin',
            entityId: id,
            before: snapshot(before),
            after: snapshot(admin),
        });
        return { admin, temporaryPassword };
    }
    async getEntity(id) {
        const admin = await this.prisma.platformAdmin.findUnique({ where: { id } });
        if (!admin)
            throw new common_1.NotFoundException('Admin not found');
        return admin;
    }
    async assertNotLastSuper(id) {
        const others = await this.prisma.platformAdmin.count({
            where: { role: 'SUPER_ADMIN', isActive: true, id: { not: id } },
        });
        if (others === 0) {
            throw new common_1.ConflictException('At least one active SUPER_ADMIN must remain');
        }
    }
};
exports.AdminManagementService = AdminManagementService;
exports.AdminManagementService = AdminManagementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        password_service_1.PasswordService,
        admin_session_service_1.AdminSessionService,
        admin_audit_service_1.AdminAuditService])
], AdminManagementService);
//# sourceMappingURL=admin-management.service.js.map
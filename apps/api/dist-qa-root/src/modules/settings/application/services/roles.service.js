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
var RolesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const permission_service_1 = require("src/modules/permission/application/services/permission.service");
const audit_service_1 = require("src/modules/audit/application/services/audit.service");
const permission_catalogue_1 = require("src/modules/permission/domain/permission-catalogue");
const permission_matrix_1 = require("../../domain/permission-matrix");
const BASE_ROLE_NAME = {
    owner: permission_catalogue_1.SYSTEM_ROLES.OWNER,
    manager: permission_catalogue_1.SYSTEM_ROLES.MANAGER,
    worker: permission_catalogue_1.SYSTEM_ROLES.WORKER,
};
let RolesService = RolesService_1 = class RolesService {
    prisma;
    permissionService;
    audit;
    log;
    constructor(prisma, permissionService, audit, logger) {
        this.prisma = prisma;
        this.permissionService = permissionService;
        this.audit = audit;
        this.log = logger.setContext(RolesService_1.name);
    }
    getCatalogue() {
        return { permissions: (0, permission_matrix_1.buildCatalogue)() };
    }
    async listRoles(farmId) {
        const roles = await this.prisma.role.findMany({
            where: {
                OR: [
                    { farmId },
                    { farmId: null, isSystemRole: true, name: permission_catalogue_1.SYSTEM_ROLES.OWNER },
                ],
            },
            include: {
                permissions: { select: { permission: { select: { key: true } } } },
                _count: { select: { members: { where: { farmId } } } },
            },
            orderBy: [{ isSystemRole: 'desc' }, { name: 'asc' }],
        });
        return {
            roles: roles.map((r) => {
                const keys = r.permissions
                    .map((p) => p.permission.key)
                    .sort((a, b) => a.localeCompare(b));
                return {
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    is_system: r.isSystemRole,
                    editable: !r.isSystemRole,
                    member_count: r._count.members,
                    permission_keys: keys,
                    matrix: (0, permission_matrix_1.toMatrix)(keys),
                };
            }),
            catalogue: (0, permission_matrix_1.buildCatalogue)(),
        };
    }
    async createRole(farmId, userId, dto) {
        if (this.isSystemRoleName(dto.name)) {
            throw new common_1.ConflictException(`"${dto.name}" is a reserved system role name`);
        }
        const keys = dto.permission_keys
            ? this.validateKeys(dto.permission_keys)
            : await this.baseRoleKeys(dto.base_role ?? 'worker');
        const permissionIds = await this.keysToIds(keys);
        try {
            const role = await this.prisma.role.create({
                data: {
                    farmId,
                    name: dto.name,
                    description: dto.description,
                    isSystemRole: false,
                    permissions: {
                        create: permissionIds.map((permissionId) => ({ permissionId })),
                    },
                },
            });
            await this.audit.record({
                actorUserId: userId,
                action: client_1.AuditAction.ROLE_CREATED,
                entityType: 'Role',
                entityId: role.id,
                farmId,
                metadata: { name: role.name, permission_keys: keys },
            });
            this.log.info('Custom role created', { roleId: role.id, farmId });
            return this.detail(farmId, role.id);
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002') {
                throw new common_1.ConflictException(`A role named "${dto.name}" already exists`);
            }
            throw e;
        }
    }
    async updateRolePermissions(farmId, userId, roleId, dto) {
        const role = await this.getCustomRoleOrThrow(farmId, roleId);
        const keys = this.validateKeys(dto.permission_keys);
        const permissionIds = await this.keysToIds(keys);
        await this.prisma.$transaction([
            this.prisma.rolePermission.deleteMany({ where: { roleId } }),
            this.prisma.rolePermission.createMany({
                data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
                skipDuplicates: true,
            }),
        ]);
        await this.invalidateMembers(farmId, roleId);
        await this.audit.record({
            actorUserId: userId,
            action: client_1.AuditAction.PERMISSION_UPDATED,
            entityType: 'Role',
            entityId: roleId,
            farmId,
            metadata: { name: role.name, permission_keys: keys },
        });
        this.log.info('Role permissions updated', { roleId, farmId });
        return this.detail(farmId, roleId);
    }
    async deleteRole(farmId, userId, roleId) {
        const role = await this.getCustomRoleOrThrow(farmId, roleId);
        const memberCount = await this.prisma.farmMember.count({
            where: { roleId, farmId },
        });
        if (memberCount > 0) {
            throw new common_1.BadRequestException(`Cannot delete role — ${memberCount} member(s) are still assigned. Reassign them first.`);
        }
        await this.prisma.$transaction([
            this.prisma.rolePermission.deleteMany({ where: { roleId } }),
            this.prisma.role.delete({ where: { id: roleId } }),
        ]);
        await this.audit.record({
            actorUserId: userId,
            action: client_1.AuditAction.ROLE_UPDATED,
            entityType: 'Role',
            entityId: roleId,
            farmId,
            metadata: { name: role.name, deleted: true },
        });
        this.log.info('Custom role deleted', { roleId, farmId });
        return { id: roleId, deleted: true };
    }
    async detail(farmId, roleId) {
        const { roles } = await this.listRoles(farmId);
        const role = roles.find((r) => r.id === roleId);
        if (!role)
            throw new common_1.NotFoundException('Role not found');
        return role;
    }
    async getCustomRoleOrThrow(farmId, roleId) {
        const role = await this.prisma.role.findFirst({
            where: {
                id: roleId,
                OR: [{ farmId }, { farmId: null, isSystemRole: true }],
            },
            select: { id: true, name: true, farmId: true, isSystemRole: true },
        });
        if (!role)
            throw new common_1.NotFoundException('Role not found');
        if (role.isSystemRole || role.farmId !== farmId) {
            throw new common_1.ForbiddenException('System roles are read-only. Create a custom role to customise permissions.');
        }
        return role;
    }
    validateKeys(keys) {
        const unknown = (0, permission_matrix_1.invalidKeys)(keys);
        if (unknown.length > 0) {
            throw new common_1.BadRequestException(`Unknown permission key(s): ${unknown.join(', ')}`);
        }
        return [...new Set(keys)];
    }
    async baseRoleKeys(base) {
        const name = BASE_ROLE_NAME[base];
        const role = await this.prisma.role.findFirst({
            where: { name, farmId: null, isSystemRole: true },
            select: {
                permissions: { select: { permission: { select: { key: true } } } },
            },
        });
        if (!role) {
            throw new common_1.BadRequestException(`Base role "${base}" is not available`);
        }
        return role.permissions.map((p) => p.permission.key);
    }
    async keysToIds(keys) {
        if (keys.length === 0)
            return [];
        const perms = await this.prisma.permission.findMany({
            where: { key: { in: keys } },
            select: { id: true },
        });
        if (perms.length !== new Set(keys).size) {
            throw new common_1.BadRequestException('One or more permission keys are not registered');
        }
        return perms.map((p) => p.id);
    }
    async invalidateMembers(farmId, roleId) {
        const members = await this.prisma.farmMember.findMany({
            where: { roleId, farmId },
            select: { userId: true },
        });
        await Promise.all(members.map((m) => this.permissionService.invalidateForFarm(m.userId, farmId)));
    }
    isSystemRoleName(name) {
        const lowered = name.trim().toLowerCase();
        return Object.values(permission_catalogue_1.SYSTEM_ROLES).some((r) => r.toLowerCase() === lowered);
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = RolesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        permission_service_1.PermissionService,
        audit_service_1.AuditService,
        logger_service_1.LoggerService])
], RolesService);
//# sourceMappingURL=roles.service.js.map
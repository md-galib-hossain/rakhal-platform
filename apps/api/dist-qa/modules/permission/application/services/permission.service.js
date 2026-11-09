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
var PermissionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const redis_constants_1 = require("src/core/redis/redis.constants");
const logger_service_1 = require("src/core/logger/logger/logger.service");
let PermissionService = PermissionService_1 = class PermissionService {
    prisma;
    redis;
    logger;
    log;
    constructor(prisma, redis, logger) {
        this.prisma = prisma;
        this.redis = redis;
        this.logger = logger;
        this.log = this.logger.setContext(PermissionService_1.name);
    }
    async resolvePermissions(userId, farmId, permissionsVersion) {
        const cacheKey = this.cacheKey(userId, farmId, permissionsVersion);
        try {
            const cached = await this.redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        catch {
        }
        const membership = await this.prisma.farmMember.findUnique({
            where: {
                farmId_userId: { farmId, userId },
            },
            select: {
                role: {
                    select: {
                        permissions: {
                            select: {
                                permission: {
                                    select: {
                                        key: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!membership) {
            throw new common_1.ForbiddenException('Permission denied');
        }
        const permissions = membership.role.permissions.map((rolePermission) => rolePermission.permission.key);
        try {
            await this.redis.set(cacheKey, JSON.stringify(permissions), {
                EX: 300,
            });
        }
        catch {
        }
        return permissions;
    }
    async hasPermission(userId, farmId, permissionsVersion, requiredPermissions) {
        const permissions = await this.resolvePermissions(userId, farmId, permissionsVersion);
        return requiredPermissions.every((permission) => this.matchesPermission(permissions, permission));
    }
    async assertPermissions(userId, farmId, permissionsVersion, requiredPermissions) {
        const allowed = await this.hasPermission(userId, farmId, permissionsVersion, requiredPermissions);
        if (!allowed) {
            this.log.warn('Permission denied', {
                userId,
                farmId,
                requiredPermissions,
            });
            throw new common_1.ForbiddenException('Permission denied');
        }
    }
    async invalidateForFarm(userId, farmId) {
        try {
            const keys = await this.redis.keys(`auth:permissions:${userId}:${farmId}:*`);
            if (keys.length > 0) {
                await this.redis.del(keys);
            }
        }
        catch {
        }
    }
    async invalidateForUser(userId) {
        try {
            const keys = await this.redis.keys(`auth:permissions:${userId}:*`);
            if (keys.length > 0) {
                await this.redis.del(keys);
            }
        }
        catch {
        }
    }
    cacheKey(userId, farmId, permissionsVersion) {
        return `auth:permissions:${userId}:${farmId}:${permissionsVersion}`;
    }
    matchesPermission(grantedPermissions, requiredPermission) {
        if (grantedPermissions.includes('*')) {
            return true;
        }
        if (grantedPermissions.includes(requiredPermission)) {
            return true;
        }
        const [resource] = requiredPermission.split('.');
        if (!resource) {
            return false;
        }
        return grantedPermissions.includes(`${resource}.*`);
    }
};
exports.PermissionService = PermissionService;
exports.PermissionService = PermissionService = PermissionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object, logger_service_1.LoggerService])
], PermissionService);
//# sourceMappingURL=permission.service.js.map
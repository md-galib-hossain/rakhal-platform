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
var TenantAccessService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantAccessService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const cache_service_1 = require("src/core/cache/cache.service");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
let TenantAccessService = TenantAccessService_1 = class TenantAccessService {
    prisma;
    logger;
    cache;
    log;
    constructor(prisma, logger, cache) {
        this.prisma = prisma;
        this.logger = logger;
        this.cache = cache;
        this.log = this.logger.setContext(TenantAccessService_1.name);
    }
    async resolveFarmContext(userId, farmId) {
        return this.cache.getOrSet(`tenant:farm-context:${userId}:${farmId}`, 300, async () => {
            const farm = await this.prisma.farm.findUnique({
                where: { id: farmId },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    status: true,
                    deletedAt: true,
                },
            });
            if (!farm || farm.deletedAt) {
                throw new common_1.NotFoundException('Farm not found');
            }
            if (farm.status !== client_1.FarmStatus.ACTIVE) {
                throw new common_1.ForbiddenException('Farm is not accessible');
            }
            const membership = await this.prisma.farmMember.findUnique({
                where: {
                    farmId_userId: {
                        farmId,
                        userId,
                    },
                },
                select: {
                    id: true,
                    roleId: true,
                    role: {
                        select: {
                            id: true,
                            name: true,
                            isSystemRole: true,
                        },
                    },
                },
            });
            if (!membership) {
                this.log.warn('Rejected farm access without membership', {
                    userId,
                    farmId,
                });
                throw new common_1.ForbiddenException('Farm access denied');
            }
            return {
                farmId: farm.id,
                farmName: farm.name,
                farmSlug: farm.slug,
                farmStatus: farm.status,
                membershipId: membership.id,
                roleId: membership.roleId,
                roleName: membership.role.name,
                isSystemRole: membership.role.isSystemRole,
            };
        });
    }
};
exports.TenantAccessService = TenantAccessService;
exports.TenantAccessService = TenantAccessService = TenantAccessService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        cache_service_1.CacheService])
], TenantAccessService);
//# sourceMappingURL=tenant-access.service.js.map
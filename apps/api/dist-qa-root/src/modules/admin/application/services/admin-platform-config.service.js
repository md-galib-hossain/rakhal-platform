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
exports.AdminPlatformConfigService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const platform_config_1 = require("../../domain/platform-config");
const admin_audit_service_1 = require("./admin-audit.service");
const snapshot = (f) => ({
    enabled: f.enabled,
    description: f.description,
    farmIds: f.farmIds,
});
let AdminPlatformConfigService = class AdminPlatformConfigService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async isEnabled(key, farmId) {
        const flag = await this.prisma.platformFeatureFlag.findUnique({
            where: { key },
            select: { enabled: true, farmIds: true },
        });
        return (0, platform_config_1.isFeatureEnabled)(flag, farmId);
    }
    listFlags() {
        return this.prisma.platformFeatureFlag.findMany({
            orderBy: { key: 'asc' },
        });
    }
    async createFlag(actorId, dto) {
        try {
            const flag = await this.prisma.platformFeatureFlag.create({
                data: {
                    key: dto.key,
                    description: dto.description ?? '',
                    enabled: dto.enabled ?? false,
                    farmIds: dto.farmIds ?? [],
                    updatedById: actorId,
                },
            });
            await this.audit.record({
                adminId: actorId,
                action: 'FEATURE_FLAG_CREATED',
                entityType: 'PlatformFeatureFlag',
                entityId: flag.key,
                after: snapshot(flag),
                metadata: { reason: dto.reason },
            });
            return flag;
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                throw new common_1.ConflictException('A flag with this key already exists');
            }
            throw err;
        }
    }
    async updateFlag(actorId, key, dto) {
        const before = await this.getFlag(key);
        const flag = await this.prisma.platformFeatureFlag.update({
            where: { key },
            data: {
                ...(dto.description !== undefined
                    ? { description: dto.description }
                    : {}),
                ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
                ...(dto.farmIds !== undefined ? { farmIds: dto.farmIds } : {}),
                updatedById: actorId,
            },
        });
        await this.audit.record({
            adminId: actorId,
            action: 'FEATURE_FLAG_UPDATED',
            entityType: 'PlatformFeatureFlag',
            entityId: key,
            before: snapshot(before),
            after: snapshot(flag),
            metadata: { reason: dto.reason },
        });
        return flag;
    }
    async deleteFlag(actorId, key, reason) {
        const before = await this.getFlag(key);
        await this.prisma.platformFeatureFlag.delete({ where: { key } });
        await this.audit.record({
            adminId: actorId,
            action: 'FEATURE_FLAG_DELETED',
            entityType: 'PlatformFeatureFlag',
            entityId: key,
            before: snapshot(before),
            metadata: { reason },
        });
        return { key, deleted: true };
    }
    listSettings() {
        return this.prisma.platformSetting.findMany({ orderBy: { key: 'asc' } });
    }
    async setSetting(actorId, key, dto) {
        if ((0, platform_config_1.looksLikeSecretKey)(key)) {
            throw new common_1.BadRequestException('Platform settings are not for credentials; use environment configuration');
        }
        const problem = (0, platform_config_1.settingValueProblem)(dto.value);
        if (problem)
            throw new common_1.BadRequestException(problem);
        const before = await this.prisma.platformSetting.findUnique({
            where: { key },
        });
        const value = dto.value;
        const setting = await this.prisma.platformSetting.upsert({
            where: { key },
            create: {
                key,
                value,
                description: dto.description ?? '',
                updatedById: actorId,
            },
            update: {
                value,
                ...(dto.description !== undefined
                    ? { description: dto.description }
                    : {}),
                updatedById: actorId,
            },
        });
        await this.audit.record({
            adminId: actorId,
            action: 'PLATFORM_SETTING_SET',
            entityType: 'PlatformSetting',
            entityId: key,
            before: before ? { value: before.value } : null,
            after: { value: setting.value },
            metadata: { reason: dto.reason, created: !before },
        });
        return setting;
    }
    async getFlag(key) {
        const flag = await this.prisma.platformFeatureFlag.findUnique({
            where: { key },
        });
        if (!flag)
            throw new common_1.NotFoundException('Flag not found');
        return flag;
    }
};
exports.AdminPlatformConfigService = AdminPlatformConfigService;
exports.AdminPlatformConfigService = AdminPlatformConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        admin_audit_service_1.AdminAuditService])
], AdminPlatformConfigService);
//# sourceMappingURL=admin-platform-config.service.js.map
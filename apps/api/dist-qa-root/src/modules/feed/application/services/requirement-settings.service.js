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
var RequirementSettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirementSettingsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const base_exception_1 = require("src/common/exceptions/base.exception");
const exception_codes_enum_1 = require("src/common/exceptions/exception-codes.enum");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const cache_1 = require("src/core/cache");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const audit_service_1 = require("src/modules/audit/application/services/audit.service");
const requirement_settings_1 = require("../../domain/requirement-settings");
const CACHE_PREFIX = 'feed:requirement-settings:';
const CACHE_TTL_SECONDS = 300;
let RequirementSettingsService = RequirementSettingsService_1 = class RequirementSettingsService {
    prisma;
    cache;
    audit;
    log;
    constructor(prisma, cache, audit, logger) {
        this.prisma = prisma;
        this.cache = cache;
        this.audit = audit;
        this.log = logger.setContext(RequirementSettingsService_1.name);
    }
    async resolve(farmId) {
        const cached = await this.cache.get(this.cacheKey(farmId));
        if (cached)
            return cached;
        const resolved = (await this.load(farmId)).effective;
        await this.cache.set(this.cacheKey(farmId), resolved, CACHE_TTL_SECONDS);
        return resolved;
    }
    async describe(farmId) {
        const { effective, preset, farmChanges } = await this.load(farmId);
        return {
            effective,
            defaults: requirement_settings_1.DEFAULT_REQUIREMENT_SETTINGS,
            preset: preset
                ? {
                    id: preset.id,
                    name: preset.name,
                    version: preset.version,
                    effective_from: preset.effectiveFrom,
                }
                : null,
            farm_changes: farmChanges,
            sources: this.buildSources(preset?.settings ?? null, farmChanges),
            fields: requirement_settings_1.REQUIREMENT_SETTING_FIELDS,
        };
    }
    async saveFarmChanges(farmId, userId, changes, notes) {
        const issues = (0, requirement_settings_1.validateSettings)(changes);
        if (issues.length > 0) {
            const summary = issues
                .map((issue) => `${issue.field} ${issue.message}`)
                .join('; ');
            throw new base_exception_1.BaseException({
                code: exception_codes_enum_1.ExceptionCode.VALIDATION_ERROR,
                statusCode: common_1.HttpStatus.BAD_REQUEST,
                message: `Invalid requirement settings: ${summary}`,
                details: { issues },
            });
        }
        const activePreset = await this.activePreset();
        await this.prisma.farmRequirementSettings.upsert({
            where: { farmId },
            create: {
                farmId,
                presetId: activePreset?.id ?? null,
                changes: changes,
                notes,
                updatedBy: userId,
            },
            update: {
                presetId: activePreset?.id ?? null,
                changes: changes,
                notes,
                updatedBy: userId,
                deletedAt: null,
            },
        });
        await this.invalidateFarm(farmId);
        await this.audit.record({
            actorUserId: userId,
            action: client_1.AuditAction.FARM_UPDATED,
            entityType: 'FarmRequirementSettings',
            entityId: farmId,
            farmId,
            metadata: { changed_fields: Object.keys(changes), notes: notes ?? null },
        });
        this.log.info('Farm requirement settings updated', {
            farmId,
            fields: Object.keys(changes).length,
        });
        return this.describe(farmId);
    }
    async resetFarmChanges(farmId, userId) {
        await this.prisma.farmRequirementSettings.deleteMany({ where: { farmId } });
        await this.invalidateFarm(farmId);
        await this.audit.record({
            actorUserId: userId,
            action: client_1.AuditAction.FARM_UPDATED,
            entityType: 'FarmRequirementSettings',
            entityId: farmId,
            farmId,
            metadata: { reset: true },
        });
        this.log.info('Farm requirement settings reset', { farmId });
        return this.describe(farmId);
    }
    async invalidateFarm(farmId) {
        await this.cache.delete(this.cacheKey(farmId));
    }
    async invalidateAll() {
        await this.cache.deleteByPrefix(CACHE_PREFIX);
    }
    async listPresets() {
        const presets = await this.prisma.requirementPreset.findMany({
            where: { deletedAt: null },
            orderBy: [{ isActive: 'desc' }, { effectiveFrom: 'desc' }],
        });
        return {
            presets: presets.map((p) => this.mapPreset(p)),
            built_in_defaults: requirement_settings_1.DEFAULT_REQUIREMENT_SETTINGS,
            fields: requirement_settings_1.REQUIREMENT_SETTING_FIELDS,
        };
    }
    async createPreset(adminId, input) {
        this.assertValid(input.settings);
        const previous = await this.prisma.requirementPreset.findFirst({
            where: { name: input.name },
            orderBy: { version: 'desc' },
            select: { version: true },
        });
        const preset = await this.prisma.requirementPreset.create({
            data: {
                name: input.name,
                description: input.description,
                version: (previous?.version ?? 0) + 1,
                settings: input.settings,
                effectiveFrom: input.effectiveFrom ?? new Date(),
                isActive: false,
                createdByAdminId: adminId,
            },
        });
        this.log.info('Requirement preset created', {
            presetId: preset.id,
            version: preset.version,
        });
        return this.mapPreset(preset);
    }
    async updatePreset(adminId, presetId, input) {
        const existing = await this.getPresetOrThrow(presetId);
        if (existing.isActive) {
            throw new base_exception_1.BaseException({
                code: exception_codes_enum_1.ExceptionCode.CONFLICT,
                statusCode: common_1.HttpStatus.CONFLICT,
                message: 'An active preset cannot be edited. Create a new version and activate that instead.',
            });
        }
        if (input.settings)
            this.assertValid(input.settings);
        const preset = await this.prisma.requirementPreset.update({
            where: { id: presetId },
            data: {
                name: input.name,
                description: input.description,
                settings: input.settings
                    ? input.settings
                    : undefined,
            },
        });
        this.log.info('Requirement preset updated', { presetId, adminId });
        return this.mapPreset(preset);
    }
    async activatePreset(adminId, presetId) {
        const preset = await this.getPresetOrThrow(presetId);
        await this.prisma.$transaction([
            this.prisma.requirementPreset.updateMany({
                where: { isActive: true },
                data: { isActive: false },
            }),
            this.prisma.requirementPreset.update({
                where: { id: presetId },
                data: { isActive: true },
            }),
        ]);
        await this.invalidateAll();
        this.log.info('Requirement preset activated', {
            presetId,
            version: preset.version,
            adminId,
        });
        return this.mapPreset({ ...preset, isActive: true });
    }
    async farmSettingsForAdmin(farmId) {
        return this.describe(farmId);
    }
    assertValid(settings) {
        const issues = (0, requirement_settings_1.validateSettings)(settings);
        if (issues.length > 0) {
            const summary = issues
                .map((issue) => `${issue.field} ${issue.message}`)
                .join('; ');
            throw new base_exception_1.BaseException({
                code: exception_codes_enum_1.ExceptionCode.VALIDATION_ERROR,
                statusCode: common_1.HttpStatus.BAD_REQUEST,
                message: `Invalid requirement settings: ${summary}`,
                details: { issues },
            });
        }
    }
    async getPresetOrThrow(presetId) {
        const preset = await this.prisma.requirementPreset.findFirst({
            where: { id: presetId, deletedAt: null },
        });
        if (!preset) {
            throw new base_exception_1.BaseException({
                code: exception_codes_enum_1.ExceptionCode.NOT_FOUND,
                statusCode: common_1.HttpStatus.NOT_FOUND,
                message: 'Requirement preset not found',
            });
        }
        return preset;
    }
    mapPreset(preset) {
        return {
            id: preset.id,
            name: preset.name,
            description: preset.description,
            version: preset.version,
            settings: preset.settings,
            effective: (0, requirement_settings_1.parseSettings)(preset.settings, requirement_settings_1.DEFAULT_REQUIREMENT_SETTINGS),
            is_active: preset.isActive,
            effective_from: preset.effectiveFrom,
            created_by_admin_id: preset.createdByAdminId,
            created_at: preset.createdAt,
        };
    }
    cacheKey(farmId) {
        return `${CACHE_PREFIX}${farmId}`;
    }
    activePreset() {
        return this.prisma.requirementPreset.findFirst({
            where: { isActive: true, deletedAt: null },
            orderBy: { effectiveFrom: 'desc' },
        });
    }
    async load(farmId) {
        const [preset, farmRow] = await Promise.all([
            this.activePreset(),
            this.prisma.farmRequirementSettings.findFirst({
                where: { farmId, deletedAt: null },
            }),
        ]);
        const base = preset
            ? (0, requirement_settings_1.parseSettings)(preset.settings, requirement_settings_1.DEFAULT_REQUIREMENT_SETTINGS)
            : requirement_settings_1.DEFAULT_REQUIREMENT_SETTINGS;
        const farmChanges = farmRow
            ? this.cleanChanges(farmRow.changes)
            : {};
        return {
            effective: (0, requirement_settings_1.mergeSettings)(base, farmChanges),
            preset,
            farmChanges,
        };
    }
    cleanChanges(stored) {
        if (typeof stored !== 'object' ||
            stored === null ||
            Array.isArray(stored)) {
            return {};
        }
        const rejected = new Set((0, requirement_settings_1.validateSettings)(stored).map((issue) => issue.field.split(/[.[]/)[0]));
        const clean = {};
        for (const [field, value] of Object.entries(stored)) {
            if (!rejected.has(field))
                clean[field] = value;
        }
        return clean;
    }
    buildSources(presetSettings, farmChanges) {
        const presetFields = typeof presetSettings === 'object' &&
            presetSettings !== null &&
            !Array.isArray(presetSettings)
            ? new Set(Object.keys(presetSettings))
            : new Set();
        const sources = {};
        for (const field of Object.keys(requirement_settings_1.DEFAULT_REQUIREMENT_SETTINGS)) {
            if (field in farmChanges)
                sources[field] = 'farm';
            else if (presetFields.has(field))
                sources[field] = 'preset';
            else
                sources[field] = 'default';
        }
        return sources;
    }
};
exports.RequirementSettingsService = RequirementSettingsService;
exports.RequirementSettingsService = RequirementSettingsService = RequirementSettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_1.CacheService,
        audit_service_1.AuditService,
        logger_service_1.LoggerService])
], RequirementSettingsService);
//# sourceMappingURL=requirement-settings.service.js.map
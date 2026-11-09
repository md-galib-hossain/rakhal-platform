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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRequirementPresetController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const requirement_settings_service_1 = require("src/modules/feed/application/services/requirement-settings.service");
const requirement_preset_dto_1 = require("../dto/requirement-preset.dto");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const current_admin_decorator_1 = require("../decorators/current-admin.decorator");
const admin_audit_service_1 = require("../../application/services/admin-audit.service");
let AdminRequirementPresetController = class AdminRequirementPresetController {
    settings;
    audit;
    constructor(settings, audit) {
        this.settings = settings;
        this.audit = audit;
    }
    list() {
        return this.settings.listPresets();
    }
    async create(admin, dto, req) {
        const preset = await this.settings.createPreset(admin.id, {
            name: dto.name,
            description: dto.description,
            settings: dto.settings,
            effectiveFrom: dto.effectiveFrom
                ? new Date(dto.effectiveFrom)
                : undefined,
        });
        await this.audit.record({
            adminId: admin.id,
            action: 'REQUIREMENT_PRESET_CREATED',
            entityType: 'RequirementPreset',
            entityId: preset.id,
            metadata: {
                name: preset.name,
                version: preset.version,
                changed_fields: Object.keys(dto.settings),
            },
            ipAddress: req.ip,
        });
        return preset;
    }
    async update(admin, id, dto, req) {
        const preset = await this.settings.updatePreset(admin.id, id, dto);
        await this.audit.record({
            adminId: admin.id,
            action: 'REQUIREMENT_PRESET_UPDATED',
            entityType: 'RequirementPreset',
            entityId: preset.id,
            metadata: {
                name: preset.name,
                version: preset.version,
                changed_fields: dto.settings ? Object.keys(dto.settings) : [],
            },
            ipAddress: req.ip,
        });
        return preset;
    }
    async activate(admin, id, req) {
        const preset = await this.settings.activatePreset(admin.id, id);
        await this.audit.record({
            adminId: admin.id,
            action: 'REQUIREMENT_PRESET_ACTIVATED',
            entityType: 'RequirementPreset',
            entityId: preset.id,
            metadata: { name: preset.name, version: preset.version },
            ipAddress: req.ip,
        });
        return preset;
    }
    farmSettings(farmId) {
        return this.settings.farmSettingsForAdmin(farmId);
    }
};
exports.AdminRequirementPresetController = AdminRequirementPresetController;
__decorate([
    (0, common_1.Get)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('requirement-preset.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminRequirementPresetController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('requirement-preset.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, requirement_preset_dto_1.CreateRequirementPresetDto, Object]),
    __metadata("design:returntype", Promise)
], AdminRequirementPresetController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('requirement-preset.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, requirement_preset_dto_1.UpdateRequirementPresetDto, Object]),
    __metadata("design:returntype", Promise)
], AdminRequirementPresetController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/activate'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('requirement-preset.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminRequirementPresetController.prototype, "activate", null);
__decorate([
    (0, common_1.Get)('farms/:farmId'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('requirement-preset.read'),
    __param(0, (0, common_1.Param)('farmId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminRequirementPresetController.prototype, "farmSettings", null);
exports.AdminRequirementPresetController = AdminRequirementPresetController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Requirement Presets'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin/requirement-presets'),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [requirement_settings_service_1.RequirementSettingsService,
        admin_audit_service_1.AdminAuditService])
], AdminRequirementPresetController);
//# sourceMappingURL=admin-requirement-preset.controller.js.map
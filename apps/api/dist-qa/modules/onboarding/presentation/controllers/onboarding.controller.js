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
exports.OnboardingController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const import_cattle_dto_1 = require("src/modules/cattle/presentation/dto/import-cattle.dto");
const onboarding_service_1 = require("../../application/services/onboarding.service");
const accept_invite_dto_1 = require("../dto/accept-invite.dto");
const configure_onboarding_dto_1 = require("../dto/configure-onboarding.dto");
const swagger_1 = require("@nestjs/swagger");
const CSV_MAX_BYTES = 5 * 1024 * 1024;
let OnboardingController = class OnboardingController {
    onboarding;
    constructor(onboarding) {
        this.onboarding = onboarding;
    }
    status(farmId) {
        return this.onboarding.status(farmId);
    }
    configure(farmId, dto) {
        return this.onboarding.configure(farmId, dto);
    }
    complete(farmId) {
        return this.onboarding.complete(farmId);
    }
    importCattlePreview(farmId, file, dto) {
        return this.onboarding.importCattlePreview(farmId, file, dto.mapping);
    }
    importCattleConfirm(farmId, userId, dto) {
        return this.onboarding.importCattleConfirm(farmId, userId, dto);
    }
    previewInvite(token) {
        return this.onboarding.previewInvite(token);
    }
    acceptInvite(userId, dto) {
        return this.onboarding.acceptInvite(userId, dto.token);
    }
};
exports.OnboardingController = OnboardingController;
__decorate([
    (0, common_1.Get)('status'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard),
    (0, require_permission_decorator_1.RequirePermission)('settings.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OnboardingController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('configure'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard),
    (0, require_permission_decorator_1.RequirePermission)('settings.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, configure_onboarding_dto_1.ConfigureOnboardingDto]),
    __metadata("design:returntype", void 0)
], OnboardingController.prototype, "configure", null);
__decorate([
    (0, common_1.Post)('complete'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard),
    (0, require_permission_decorator_1.RequirePermission)('settings.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OnboardingController.prototype, "complete", null);
__decorate([
    (0, common_1.Post)('cattle/import'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard),
    (0, require_permission_decorator_1.RequirePermission)('cattle.create'),
    (0, decorators_1.ThrottleUpload)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: CSV_MAX_BYTES } })),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, import_cattle_dto_1.ImportPreviewDto]),
    __metadata("design:returntype", void 0)
], OnboardingController.prototype, "importCattlePreview", null);
__decorate([
    (0, common_1.Post)('cattle/import/confirm'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard),
    (0, require_permission_decorator_1.RequirePermission)('cattle.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, import_cattle_dto_1.ImportConfirmDto]),
    __metadata("design:returntype", void 0)
], OnboardingController.prototype, "importCattleConfirm", null);
__decorate([
    (0, common_1.Get)('invites/:token'),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OnboardingController.prototype, "previewInvite", null);
__decorate([
    (0, common_1.Post)('accept-invite'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard),
    __param(0, (0, decorators_1.CurrentUserId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, accept_invite_dto_1.AcceptInviteDto]),
    __metadata("design:returntype", void 0)
], OnboardingController.prototype, "acceptInvite", null);
exports.OnboardingController = OnboardingController = __decorate([
    (0, swagger_1.ApiTags)('Onboarding'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('onboarding'),
    __metadata("design:paramtypes", [onboarding_service_1.OnboardingService])
], OnboardingController);
//# sourceMappingURL=onboarding.controller.js.map
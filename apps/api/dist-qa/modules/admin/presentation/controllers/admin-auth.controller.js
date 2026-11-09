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
exports.AdminAuthController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const swagger_1 = require("@nestjs/swagger");
const admin_auth_service_1 = require("../../application/services/admin-auth.service");
const admin_session_service_1 = require("../../application/services/admin-session.service");
const admin_login_dto_1 = require("../dto/admin-login.dto");
const admin_permission_matrix_1 = require("../../domain/admin-permission-matrix");
const admin_refresh_dto_1 = require("../dto/admin-refresh.dto");
const admin_lifecycle_dto_1 = require("../dto/admin-lifecycle.dto");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
const admin_enable_2fa_dto_1 = require("../dto/admin-enable-2fa.dto");
const admin_two_factor_setup_guard_1 = require("../guards/admin-two-factor-setup.guard");
const current_admin_decorator_1 = require("../decorators/current-admin.decorator");
function clientOf(req) {
    return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}
let AdminAuthController = class AdminAuthController {
    adminAuth;
    sessions;
    constructor(adminAuth, sessions) {
        this.adminAuth = adminAuth;
        this.sessions = sessions;
    }
    login(dto, req) {
        return this.adminAuth.login(dto.email, dto.password, dto.code, clientOf(req));
    }
    refresh(dto, req) {
        return this.adminAuth.refresh(dto.refreshToken, clientOf(req));
    }
    async logout(admin, req) {
        await this.sessions.revoke(admin.id, admin.sessionId, 'LOGOUT', req.ip);
        return { loggedOut: true };
    }
    changePassword(admin, dto) {
        return this.adminAuth.changePassword(admin.id, admin.sessionId, dto.currentPassword, dto.newPassword);
    }
    async logoutOthers(admin, req) {
        const revoked = await this.sessions.revokeAll(admin.id, 'LOGOUT_OTHERS', admin.sessionId, req.ip);
        return { revoked };
    }
    me(admin) {
        return {
            id: admin.id,
            email: admin.email,
            role: admin.role,
            mustChangePassword: admin.mustChangePassword ?? false,
            permissions: (0, admin_permission_matrix_1.adminRoleGrants)(admin.role),
        };
    }
    async listSessions(admin) {
        const sessions = await this.sessions.listActive(admin.id);
        return sessions.map((s) => ({ ...s, current: s.id === admin.sessionId }));
    }
    async revokeSession(admin, id, req) {
        const revoked = await this.sessions.revoke(admin.id, id, 'REVOKED_BY_ADMIN', req.ip);
        if (!revoked)
            throw new common_1.NotFoundException('Session not found');
        return { revoked: true };
    }
    setupTwoFactor(admin) {
        return this.adminAuth.beginTwoFactorSetup(admin.id);
    }
    enableTwoFactor(admin, dto, req) {
        return this.adminAuth.enableTwoFactor(admin.id, dto.code, req.ip);
    }
};
exports.AdminAuthController = AdminAuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, decorators_1.ThrottleAuth)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_login_dto_1.AdminLoginDto, Object]),
    __metadata("design:returntype", void 0)
], AdminAuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(200),
    (0, decorators_1.ThrottleAuth)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_refresh_dto_1.AdminRefreshDto, Object]),
    __metadata("design:returntype", void 0)
], AdminAuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminAuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('change-password'),
    (0, decorators_1.ThrottleAuth)(),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, admin_lifecycle_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", void 0)
], AdminAuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Post)('logout-others'),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminAuthController.prototype, "logoutOthers", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminAuthController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('sessions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminAuthController.prototype, "listSessions", null);
__decorate([
    (0, common_1.Delete)('sessions/:id'),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminAuthController.prototype, "revokeSession", null);
__decorate([
    (0, common_1.Post)('2fa/setup'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(admin_two_factor_setup_guard_1.AdminTwoFactorSetupGuard),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminAuthController.prototype, "setupTwoFactor", null);
__decorate([
    (0, common_1.Post)('2fa/enable'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(admin_two_factor_setup_guard_1.AdminTwoFactorSetupGuard),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, admin_enable_2fa_dto_1.AdminEnableTwoFactorDto, Object]),
    __metadata("design:returntype", void 0)
], AdminAuthController.prototype, "enableTwoFactor", null);
exports.AdminAuthController = AdminAuthController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Auth'),
    (0, common_1.Controller)('admin/auth'),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard),
    __metadata("design:paramtypes", [admin_auth_service_1.AdminAuthService,
        admin_session_service_1.AdminSessionService])
], AdminAuthController);
//# sourceMappingURL=admin-auth.controller.js.map
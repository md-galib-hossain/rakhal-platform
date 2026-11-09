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
exports.AdminSupportActionsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const admin_support_actions_service_1 = require("../../application/services/admin-support-actions.service");
const current_admin_decorator_1 = require("../decorators/current-admin.decorator");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const admin_support_action_dto_1 = require("../dto/admin-support-action.dto");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
let AdminSupportActionsController = class AdminSupportActionsController {
    actions;
    constructor(actions) {
        this.actions = actions;
    }
    suspendFarm(admin, id, dto) {
        return this.actions.suspendFarm(admin.id, id, dto);
    }
    reactivateFarm(admin, id, dto) {
        return this.actions.reactivateFarm(admin.id, id, dto);
    }
    blockUser(admin, id, dto) {
        return this.actions.blockUser(admin.id, id, dto);
    }
    unblockUser(admin, id, dto) {
        return this.actions.unblockUser(admin.id, id, dto);
    }
    sendPasswordReset(admin, id, dto) {
        return this.actions.sendPasswordReset(admin.id, id, dto);
    }
    revokeSessions(admin, id, dto) {
        return this.actions.revokeUserSessions(admin.id, id, dto);
    }
};
exports.AdminSupportActionsController = AdminSupportActionsController;
__decorate([
    (0, common_1.Post)('farms/:id/suspend'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('farm.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_support_action_dto_1.AdminSupportActionDto]),
    __metadata("design:returntype", void 0)
], AdminSupportActionsController.prototype, "suspendFarm", null);
__decorate([
    (0, common_1.Post)('farms/:id/reactivate'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('farm.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_support_action_dto_1.AdminSupportActionDto]),
    __metadata("design:returntype", void 0)
], AdminSupportActionsController.prototype, "reactivateFarm", null);
__decorate([
    (0, common_1.Post)('users/:id/block'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('user.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_support_action_dto_1.AdminSupportActionDto]),
    __metadata("design:returntype", void 0)
], AdminSupportActionsController.prototype, "blockUser", null);
__decorate([
    (0, common_1.Post)('users/:id/unblock'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('user.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_support_action_dto_1.AdminSupportActionDto]),
    __metadata("design:returntype", void 0)
], AdminSupportActionsController.prototype, "unblockUser", null);
__decorate([
    (0, common_1.Post)('users/:id/send-password-reset'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('user.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_support_action_dto_1.AdminSendPasswordResetDto]),
    __metadata("design:returntype", void 0)
], AdminSupportActionsController.prototype, "sendPasswordReset", null);
__decorate([
    (0, common_1.Post)('users/:id/revoke-sessions'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('user.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_support_action_dto_1.AdminSupportActionDto]),
    __metadata("design:returntype", void 0)
], AdminSupportActionsController.prototype, "revokeSessions", null);
exports.AdminSupportActionsController = AdminSupportActionsController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Support actions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin'),
    (0, decorators_1.ThrottleWrite)(),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [admin_support_actions_service_1.AdminSupportActionsService])
], AdminSupportActionsController);
//# sourceMappingURL=admin-support-actions.controller.js.map
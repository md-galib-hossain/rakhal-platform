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
exports.AdminCommunicationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const admin_communications_service_1 = require("../../application/services/admin-communications.service");
const current_admin_decorator_1 = require("../decorators/current-admin.decorator");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const admin_communication_dto_1 = require("../dto/admin-communication.dto");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
let AdminCommunicationsController = class AdminCommunicationsController {
    communications;
    constructor(communications) {
        this.communications = communications;
    }
    getChannelStats() {
        return this.communications.getChannelStats();
    }
    sendMessageToUser(admin, userId, dto) {
        return this.communications.sendDirectMessage(admin.id, userId, dto);
    }
    broadcast(admin, dto) {
        return this.communications.broadcast(admin.id, dto);
    }
};
exports.AdminCommunicationsController = AdminCommunicationsController;
__decorate([
    (0, common_1.Get)('stats'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('user.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminCommunicationsController.prototype, "getChannelStats", null);
__decorate([
    (0, common_1.Post)('users/:id/message'),
    (0, common_1.HttpCode)(200),
    (0, decorators_1.ThrottleWrite)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('user.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_communication_dto_1.AdminSendMessageDto]),
    __metadata("design:returntype", void 0)
], AdminCommunicationsController.prototype, "sendMessageToUser", null);
__decorate([
    (0, common_1.Post)('broadcast'),
    (0, common_1.HttpCode)(200),
    (0, decorators_1.ThrottleWrite)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('user.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, admin_communication_dto_1.AdminBroadcastMessageDto]),
    __metadata("design:returntype", void 0)
], AdminCommunicationsController.prototype, "broadcast", null);
exports.AdminCommunicationsController = AdminCommunicationsController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Communications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin/communications'),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [admin_communications_service_1.AdminCommunicationsService])
], AdminCommunicationsController);
//# sourceMappingURL=admin-communications.controller.js.map